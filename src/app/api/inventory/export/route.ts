import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/db';
import { resolveSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authUser = await resolveSession(req);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Sesi login diperlukan untuk export data' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim() || '';
    const onlyActive = searchParams.get('onlyActive') === 'true';
    const minusStock = searchParams.get('minusStock') === 'true';
    const sortField = searchParams.get('sortField') || 'id';
    const sortOrder = (searchParams.get('sortOrder') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();

    // 1. Build where query based on filters
    const where: any = {};
    if (q) {
      where.OR = [
        { inventoryNo: { contains: q, mode: 'insensitive' as const } },
        { inventoryName: { contains: q, mode: 'insensitive' as const } },
        { barcode: { contains: q, mode: 'insensitive' as const } },
      ];
    }
    if (onlyActive) {
      where.isActive = true;
    }
    if (minusStock) {
      where.stock = { lt: 0 };
    }

    // 2. Determine sorting
    let orderBy: any = { id: sortOrder };
    if (['inventoryNo', 'barcode', 'inventoryName', 'price', 'stock'].includes(sortField)) {
      orderBy = { [sortField]: sortOrder };
    }

    // 3. Count matching items
    const totalCount = await prisma.inventory.count({ where });
    if (totalCount === 0) {
      return NextResponse.json(
        {
          success: false,
          isEmpty: true,
          count: 0,
          error: 'Tidak ada data barang yang sesuai dengan kriteria filter saat ini',
        },
        { status: 404 }
      );
    }

    // Limit bounded export to avoid server memory exhaustion (max 20,000)
    const MAX_EXPORT_LIMIT = 20000;
    if (totalCount > MAX_EXPORT_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Jumlah data (${totalCount}) melebihi batas maksimum export satu kali (${MAX_EXPORT_LIMIT}). Harap persempit filter pencarian.`,
        },
        { status: 400 }
      );
    }

    // 4. Fetch all matching records
    const items = await prisma.inventory.findMany({
      where,
      orderBy,
      include: {
        brand: true,
        category: true,
        uom: true,
      },
    });

    // 5. Re-check permissions immediately before workbook generation (defense against mid-generation revocation)
    const currentSessionUser = await resolveSession(req);
    if (!currentSessionUser) {
      return NextResponse.json(
        { success: false, error: 'Sesi pengguna tidak valid saat mempersiapkan dokumen export' },
        { status: 401 }
      );
    }
    const canViewHpp = Boolean(currentSessionUser.hasHpp);

    const timestampStr = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date());

    const fileDateStr = new Date().toISOString().slice(0, 10);

    // CSV format handling
    if (format === 'csv') {
      const csvHeaders = [
        'No',
        'Kode Barang',
        'Barcode',
        'Nama Barang',
        'Brand',
        'Kategori',
        'Satuan',
        'Harga Retail (Rp)',
        ...(canViewHpp ? ['HPP Modal (Rp)'] : []),
        'Grosir 1 (Rp)',
        'Grosir 2 (Rp)',
        'Grosir 3 (Rp)',
        'Stok Akhir',
        'Status',
      ];

      const rows: string[] = [csvHeaders.join(',')];

      items.forEach((item, idx) => {
        // Guard against formula injection: prepend single quote if text starts with formula triggers (=, +, -, @)
        const sanitizeText = (val: string | null | undefined) => {
          if (!val) return '""';
          let str = String(val).replace(/"/g, '""');
          if (/^[=+\-@]/.test(str)) {
            str = `'${str}`;
          }
          return `"${str}"`;
        };

        const line = [
          idx + 1,
          sanitizeText(item.inventoryNo),
          sanitizeText(item.barcode),
          sanitizeText(item.inventoryName),
          sanitizeText(item.brand?.brandName || '-'),
          sanitizeText(item.category?.categoryName || '-'),
          sanitizeText(item.uom?.uomName || 'Pcs'),
          Number(item.price || 0),
          ...(canViewHpp ? [item.hpp !== null && item.hpp !== undefined ? Number(item.hpp) : ''] : []),
          Number(item.grosir1 || 0),
          Number(item.grosir2 || 0),
          Number(item.grosir3 || 0),
          Number(item.stock || 0),
          item.isActive ? '"AKTIF"' : '"NON-AKTIF"',
        ];
        rows.push(line.join(','));
      });

      const csvContent = '\uFEFF' + rows.join('\r\n');
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="Master_Barang_${fileDateStr}.csv"`,
          'X-Export-Count': items.length.toString(),
        },
      });
    }

    // 6. XLSX generation with ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Harmony Kitchenware ERP';
    workbook.lastModifiedBy = currentSessionUser.fullName || currentSessionUser.username;
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet('Master Data Barang', {
      views: [{ state: 'frozen', ySplit: 5 }],
    });

    // Metadata title block
    sheet.mergeCells('A1:H1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'HARMONY KITCHENWARE - MASTER DATA BARANG';
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle' };

    sheet.mergeCells('A2:H2');
    const metaCell = sheet.getCell('A2');
    metaCell.value = `Tanggal Export: ${timestampStr} WIB | Total: ${items.length} Barang | Filter: ${q ? `"${q}"` : 'Semua'} | Status: ${onlyActive ? 'Hanya Aktif' : 'Semua'} | Stok: ${minusStock ? 'Minus' : 'Semua'}`;
    metaCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF64748B' } };

    // Empty separator row at row 3
    sheet.getRow(3).height = 8;

    // Define table columns
    const columns: Partial<ExcelJS.Column>[] = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Kode Barang', key: 'inventoryNo', width: 16 },
      { header: 'Barcode', key: 'barcode', width: 18 },
      { header: 'Nama Barang', key: 'inventoryName', width: 38 },
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Kategori', key: 'category', width: 16 },
      { header: 'Satuan', key: 'uom', width: 10 },
      { header: 'Harga Retail (Rp)', key: 'price', width: 18 },
    ];

    if (canViewHpp) {
      columns.push({ header: 'HPP Modal (Rp)', key: 'hpp', width: 18 });
    }

    columns.push(
      { header: 'Grosir 1 (Rp)', key: 'grosir1', width: 16 },
      { header: 'Grosir 2 (Rp)', key: 'grosir2', width: 16 },
      { header: 'Grosir 3 (Rp)', key: 'grosir3', width: 16 },
      { header: 'Stok Akhir', key: 'stock', width: 12 },
      { header: 'Status', key: 'status', width: 14 }
    );

    // Header row at row 4
    const headerRow = sheet.getRow(4);
    headerRow.values = columns.map((c) => (Array.isArray(c.header) ? c.header.join(' ') : String(c.header || '')));
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Dark slate
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'medium', color: { argb: 'FF475569' } },
        left: { style: 'thin', color: { argb: 'FF94A3B8' } },
        right: { style: 'thin', color: { argb: 'FF94A3B8' } },
      };
    });

    // Populate data rows starting at row 5
    items.forEach((item, idx) => {
      const rowIndex = 5 + idx;
      const dataRow = sheet.getRow(rowIndex);

      // Sanitize formula triggers: if user-entered string starts with '=', '+', '-', '@', treat as literal text
      const cleanString = (val: string | null | undefined) => {
        if (!val) return '';
        const str = String(val);
        if (/^[=+\-@]/.test(str)) {
          return `'${str}`;
        }
        return str;
      };

      const rowValues: any[] = [
        idx + 1,
        cleanString(item.inventoryNo),
        cleanString(item.barcode),
        cleanString(item.inventoryName),
        cleanString(item.brand?.brandName || '-'),
        cleanString(item.category?.categoryName || '-'),
        cleanString(item.uom?.uomName || 'Pcs'),
        Number(item.price || 0),
      ];

      if (canViewHpp) {
        rowValues.push(item.hpp !== null && item.hpp !== undefined ? Number(item.hpp) : null);
      }

      rowValues.push(
        Number(item.grosir1 || 0),
        Number(item.grosir2 || 0),
        Number(item.grosir3 || 0),
        Number(item.stock || 0),
        item.isActive ? 'AKTIF' : 'NON-AKTIF'
      );

      dataRow.values = rowValues;

      // Apply formatting to cells
      // Column 1: No
      dataRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      dataRow.getCell(1).numFmt = '#,##0';

      // Column 2: Inventory No (Strict text with leading zeroes preserved)
      dataRow.getCell(2).numFmt = '@';
      dataRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      // Column 3: Barcode (Strict text with leading zeroes preserved)
      dataRow.getCell(3).numFmt = '@';
      dataRow.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

      // Column 4: Inventory Name (Wrap text, literal string)
      dataRow.getCell(4).alignment = { wrapText: true, vertical: 'middle' };

      // Column 5: Brand
      dataRow.getCell(5).alignment = { vertical: 'middle' };

      // Column 6: Category
      dataRow.getCell(6).alignment = { vertical: 'middle' };

      // Column 7: UoM
      dataRow.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };

      // Currency columns
      let currColIdx = 8;
      // Price
      dataRow.getCell(currColIdx).numFmt = '#,##0';
      dataRow.getCell(currColIdx).alignment = { horizontal: 'right', vertical: 'middle' };
      currColIdx++;

      if (canViewHpp) {
        const hppCell = dataRow.getCell(currColIdx);
        if (hppCell.value !== null && hppCell.value !== undefined) {
          hppCell.numFmt = '#,##0';
        }
        hppCell.alignment = { horizontal: 'right', vertical: 'middle' };
        currColIdx++;
      }

      // Grosir 1
      dataRow.getCell(currColIdx).numFmt = '#,##0';
      dataRow.getCell(currColIdx).alignment = { horizontal: 'right', vertical: 'middle' };
      currColIdx++;

      // Grosir 2
      dataRow.getCell(currColIdx).numFmt = '#,##0';
      dataRow.getCell(currColIdx).alignment = { horizontal: 'right', vertical: 'middle' };
      currColIdx++;

      // Grosir 3
      dataRow.getCell(currColIdx).numFmt = '#,##0';
      dataRow.getCell(currColIdx).alignment = { horizontal: 'right', vertical: 'middle' };
      currColIdx++;

      // Stock
      dataRow.getCell(currColIdx).numFmt = '#,##0';
      dataRow.getCell(currColIdx).alignment = { horizontal: 'center', vertical: 'middle' };
      currColIdx++;

      // Status
      dataRow.getCell(currColIdx).alignment = { horizontal: 'center', vertical: 'middle' };

      // Row height and borders
      dataRow.height = 20;
      dataRow.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    // Set column widths
    columns.forEach((col, idx) => {
      if (col.width) {
        sheet.getColumn(idx + 1).width = col.width;
      }
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Master_Barang_${fileDateStr}.xlsx"`,
        'X-Export-Count': items.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Inventory export error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal menghasilkan file export' },
      { status: 500 }
    );
  }
}
