import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const noTx = searchParams.get('noTx');
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    if (noTx) {
      const header = await prisma.opnameHeader.findUnique({
        where: { opnameNo: noTx },
        include: { details: true },
      });

      if (!header) return NextResponse.json({ success: false, error: 'Opname tidak ditemukan' }, { status: 404 });

      // Fetch prices and inventory details
      const barcodes = header.details.map((d) => d.barcode).filter(Boolean);
      const inventoryNoList = header.details.map((d) => d.inventoryNo).filter(Boolean);

      const inventories = await prisma.inventory.findMany({
        where: {
          OR: [
            { barcode: { in: barcodes } },
            { inventoryNo: { in: inventoryNoList } },
          ],
        },
        select: { id: true, barcode: true, inventoryNo: true, price: true },
      });

      const invMap = new Map<string, { id: number; price: number }>();
      inventories.forEach((inv) => {
        if (inv.barcode) invMap.set(inv.barcode, { id: inv.id, price: inv.price });
        if (inv.inventoryNo) invMap.set(inv.inventoryNo, { id: inv.id, price: inv.price });
      });

      const items = header.details.map((d) => {
        const matched = invMap.get(d.barcode) || invMap.get(d.inventoryNo);
        return {
          id: String(d.id),
          inventoryId: matched?.id || d.id,
          barcode: d.barcode,
          inventoryNo: d.inventoryNo,
          inventory_no: d.inventoryNo,
          inventoryName: d.inventoryName,
          inventory_name: d.inventoryName,
          systemQty: d.systemQty,
          system_qty: d.systemQty,
          physicalQty: d.physicalQty,
          physical_qty: d.physicalQty,
          diffQty: d.diffQty,
          diff_qty: d.diffQty,
          qty: d.physicalQty,
          price: matched?.price || 0,
          description: d.diffQty === 0 ? 'Sesuai (Klop)' : d.diffQty > 0 ? `Surplus (+${d.diffQty})` : `Defisit (${d.diffQty})`,
        };
      });

      return NextResponse.json({
        success: true,
        data: items,
        header: {
          noTransaction: header.opnameNo,
          no_tx: header.opnameNo,
          opnameNo: header.opnameNo,
          date: header.opnameDate,
          whName: header.whName,
          items,
        },
      });
    }

    const where = q
      ? {
          OR: [
            { opnameNo: { contains: q, mode: 'insensitive' as const } },
            { whName: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const [total, opnames] = await Promise.all([
      prisma.opnameHeader.count({ where }),
      prisma.opnameHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = opnames.map((o) => ({
      id: String(o.id),
      noTransaction: o.opnameNo,
      opname_no: o.opnameNo,
      opnameNo: o.opnameNo,
      opnameDate: o.opnameDate,
      opname_date: o.opnameDate,
      whName: o.whName,
      wh_name: o.whName,
      totalItems: o.details.length,
      total_items: o.details.length,
      created_at: o.createdAt,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/inventory/opname:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let no_tx = body.no_tx || body.noTransaction || body.opnameNo;
    const date = body.date || body.opnameDate;
    const wh_name = body.wh_name || body.whName || body.warehouse;
    let items = body.items;

    // Support single-item payload from MasterBarangManager modal
    if (!items && body.inventoryId !== undefined) {
      const inv = await prisma.inventory.findUnique({ where: { id: Number(body.inventoryId) } });
      if (inv) {
        no_tx = no_tx || `OPN-SINGLE-${Date.now()}`;
        const physQty = Number(body.qtyOpname ?? body.qty ?? body.physicalQty ?? inv.stock);
        items = [{
          inventoryId: inv.id,
          barcode: inv.barcode || '',
          inventoryNo: inv.inventoryNo || '',
          inventoryName: inv.inventoryName || '',
          systemQty: inv.stock,
          physicalQty: physQty,
          qty: physQty,
          diffQty: physQty - inv.stock,
        }];
      }
    }

    if (!no_tx || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. Opname dan detail barang wajib diisi' }, { status: 400 });
    }

    // Upsert or Create Opname Header
    const existing = await prisma.opnameHeader.findUnique({
      where: { opnameNo: no_tx },
    });

    let header;
    if (existing) {
      // Delete existing details and recreate for clean update
      await prisma.opnameDetail.deleteMany({
        where: { headerId: existing.id },
      });
      header = await prisma.opnameHeader.update({
        where: { id: existing.id },
        data: {
          opnameDate: date ? new Date(date) : new Date(),
          whName: wh_name || 'Gudang Utama',
          details: {
            create: items.map((it: any) => {
              const sysQty = Number(it.systemQty ?? it.system_qty ?? 0);
              const physQty = Number(it.qty ?? it.physicalQty ?? it.physical_qty ?? 0);
              const diffQty = Number(it.diffQty ?? it.diff_qty ?? (physQty - sysQty));
              return {
                barcode: it.barcode || '',
                inventoryNo: it.inventoryNo || it.inventory_no || '',
                inventoryName: it.inventoryName || it.inventory_name || '',
                systemQty: sysQty,
                physicalQty: physQty,
                diffQty: diffQty,
              };
            }),
          },
        },
        include: { details: true },
      });
    } else {
      header = await prisma.opnameHeader.create({
        data: {
          opnameNo: no_tx,
          opnameDate: date ? new Date(date) : new Date(),
          whName: wh_name || 'Gudang Utama',
          details: {
            create: items.map((it: any) => {
              const sysQty = Number(it.systemQty ?? it.system_qty ?? 0);
              const physQty = Number(it.qty ?? it.physicalQty ?? it.physical_qty ?? 0);
              const diffQty = Number(it.diffQty ?? it.diff_qty ?? (physQty - sysQty));
              return {
                barcode: it.barcode || '',
                inventoryNo: it.inventoryNo || it.inventory_no || '',
                inventoryName: it.inventoryName || it.inventory_name || '',
                systemQty: sysQty,
                physicalQty: physQty,
                diffQty: diffQty,
              };
            }),
          },
        },
        include: { details: true },
      });
    }

    // Adjust inventory physical stock in Database
    for (const it of items) {
      const physQty = Number(it.qty ?? it.physicalQty ?? it.physical_qty ?? 0);
      if (it.inventoryId) {
        await prisma.inventory.update({
          where: { id: Number(it.inventoryId) },
          data: { stock: physQty },
        }).catch(async () => {
          if (it.barcode) {
            await prisma.inventory.updateMany({
              where: { barcode: it.barcode },
              data: { stock: physQty },
            }).catch(() => {});
          }
        });
      } else if (it.barcode) {
        await prisma.inventory.updateMany({
          where: { barcode: it.barcode },
          data: { stock: physQty },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Stock Opname berhasil disimpan & stok inventori telah diperbarui',
      data: header,
    });
  } catch (error: any) {
    console.error('Error in POST /api/inventory/opname:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

