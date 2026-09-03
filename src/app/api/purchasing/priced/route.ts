import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where = {
      isPriced: true,
      ...(q
        ? {
            OR: [
              { mrNo: { contains: q, mode: 'insensitive' as const } },
              { supplierName: { contains: q, mode: 'insensitive' as const } },
              { poNo: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, receives] = await Promise.all([
      prisma.materialReceiveHeader.count({ where }),
      prisma.materialReceiveHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = receives.map((mr) => {
      const totalQty = mr.details.reduce((sum, d) => sum + Number(d.qty), 0);
      const totalAmount = mr.details.reduce((sum, d) => sum + Number(d.subtotal || 0), 0);
      const formattedDate = mr.mrDate ? new Date(mr.mrDate).toLocaleDateString('id-ID') : '-';

      return {
        id: mr.id,
        mrNo: mr.mrNo,
        mr_no: mr.mrNo,
        mrDate: formattedDate,
        mr_date: formattedDate,
        poNo: mr.poNo || '-',
        po_no: mr.poNo || '-',
        supplierName: mr.supplierName,
        supplier_name: mr.supplierName,
        whName: 'Gudang Utama',
        description: '-',
        totalQty: totalQty,
        total_qty: totalQty,
        totalAmount: totalAmount,
        total_amount: totalAmount,
        items: mr.details.map((d) => ({
          id: d.id,
          barcode: d.barcode,
          inventoryNo: d.inventoryNo,
          inventory_no: d.inventoryNo,
          inventoryName: d.inventoryName,
          inventory_name: d.inventoryName,
          qty: d.qty,
          unitPrice: d.unitPrice,
          unit_price: d.unitPrice,
          subtotal: d.subtotal,
        })),
        createdAt: mr.createdAt,
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/priced:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mrNo = body.mrNo || body.mr_no;
    const mrDate = body.mrDate || body.mr_date;
    const poNo = body.poNo || body.po_no || body.doNo;
    const supplierName = body.supplierName || body.supplier_name;
    const items = body.items;

    if (!mrNo || !supplierName || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. MR, Supplier, dan detail item barang wajib diisi' }, { status: 400 });
    }

    const created = await prisma.materialReceiveHeader.create({
      data: {
        mrNo: mrNo,
        mrDate: mrDate ? new Date(mrDate) : new Date(),
        poNo: poNo || null,
        supplierName: supplierName,
        isPriced: true,
        details: {
          create: items.map((it: any) => {
            const qty = Number(it.qty || 0);
            const unitPrice = Number(it.price || it.unitPrice || it.unit_price || 0);
            const discPercentage = Number(it.discPercentage || 0);
            const subtotal = Number(it.subtotal || (qty * unitPrice * (1 - discPercentage / 100)));
            return {
              barcode: it.barcode || '',
              inventoryNo: it.inventoryNo || it.inventory_no || '',
              inventoryName: it.inventoryName || it.inventory_name || '',
              qty: qty,
              unitPrice: unitPrice,
              subtotal: subtotal,
            };
          }),
        },
      },
      include: { details: true },
    });

    const grandTotal = created.details.reduce((sum, d) => sum + Number(d.subtotal || 0), 0);

    // Update HPP and increment stock in PostgreSQL
    for (const it of items) {
      const invId = it.inventoryId ? Number(it.inventoryId) : undefined;
      const qty = Number(it.qty || 0);
      const unitPrice = Number(it.price || it.unitPrice || it.unit_price || 0);

      if (invId) {
        await prisma.inventory.update({
          where: { id: invId },
          data: {
            hpp: unitPrice > 0 ? unitPrice : undefined,
            stock: { increment: qty },
          },
        }).catch(async () => {
          if (it.barcode) {
            await prisma.inventory.updateMany({
              where: { barcode: it.barcode },
              data: {
                hpp: unitPrice > 0 ? unitPrice : undefined,
                stock: { increment: qty },
              },
            }).catch(() => {});
          }
        });
      } else if (it.barcode) {
        await prisma.inventory.updateMany({
          where: { barcode: it.barcode },
          data: {
            hpp: unitPrice > 0 ? unitPrice : undefined,
            stock: { increment: qty },
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Penerimaan Barang dengan Harga berhasil disimpan & stok inventori serta HPP telah diperbarui',
      id: created.id,
      mrNo: created.mrNo,
      grandTotal: grandTotal,
      data: created,
    });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/priced:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
