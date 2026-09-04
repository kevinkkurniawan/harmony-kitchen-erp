import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { Pool } from 'pg';

const posPool = new Pool({
  connectionString: process.env.POS_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/harmony_pos?schema=public',
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where = {
      isPriced: false,
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
      const formattedDate = mr.mrDate ? new Date(mr.mrDate).toLocaleDateString('id-ID') : '-';

      return {
        id: mr.id,
        mrNo: mr.mrNo,
        mr_no: mr.mrNo,
        mrDate: formattedDate,
        mr_date: formattedDate,
        poNo: mr.poNo || '-',
        po_no: mr.poNo || '-',
        doNo: mr.doNo || '-',
        supplierId: mr.supplierId,
        supplierName: mr.supplierName,
        supplier_name: mr.supplierName,
        driverName: mr.driverName || '-',
        vehicleNo: mr.vehicleNo || '-',
        whName: mr.whName || 'Gudang Utama',
        description: mr.description || '-',
        isExpress: mr.isExpress,
        isVoid: mr.isVoid,
        totalQty: totalQty,
        total_qty: totalQty,
        items: mr.details.map((d) => ({
          id: d.id,
          inventoryId: d.inventoryId,
          barcode: d.barcode,
          inventoryNo: d.inventoryNo,
          inventory_no: d.inventoryNo,
          inventoryName: d.inventoryName,
          inventory_name: d.inventoryName,
          uomName: d.uomName || 'PCS',
          qty: d.qty,
          description: d.description || '',
        })),
        createdAt: mr.createdAt,
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/purchasing/express:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mrNo = body.mrNo || body.mr_no;
    const mrDate = body.mrDate || body.mr_date;
    const supplierId = body.supplierId;
    const supplierName = body.supplierName || body.supplier_name;
    const doNo = body.doNo || body.poNo || body.po_no;
    const driverName = body.driverName;
    const vehicleNo = body.vehicleNo;
    const whName = body.whName || 'Gudang Utama Dapur';
    const description = body.description;
    const isExpress = body.isExpress ?? true;
    const isVoid = body.isVoid ?? false;
    const items = body.items;

    if (!mrNo || !supplierName || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'No. MR, Supplier, dan detail item barang wajib diisi' }, { status: 400 });
    }

    const created = await prisma.materialReceiveHeader.create({
      data: {
        mrNo: mrNo,
        mrDate: mrDate ? new Date(mrDate) : new Date(),
        poNo: doNo || null, // keeping poNo as doNo for compatibility or keeping both
        doNo: doNo || null,
        supplierId: supplierId ? Number(supplierId) : null,
        supplierName: supplierName,
        driverName: driverName || null,
        vehicleNo: vehicleNo || null,
        whName: whName,
        description: description || null,
        isExpress: Boolean(isExpress),
        isVoid: Boolean(isVoid),
        isPriced: false,
        details: {
          create: items.map((it: any) => ({
            inventoryId: it.inventoryId ? Number(it.inventoryId) : null,
            barcode: it.barcode || '',
            inventoryNo: it.inventoryNo || it.inventory_no || '',
            inventoryName: it.inventoryName || it.inventory_name || '',
            uomName: it.uomName || 'PCS',
            qty: Number(it.qty || 0),
            unitPrice: 0,
            subtotal: 0,
            description: it.description || null,
          })),
        },
      },
      include: { details: true },
    });

    // Increment stock for received items in PostgreSQL
    for (const it of items) {
      const invId = it.inventoryId ? Number(it.inventoryId) : undefined;
      const qty = Number(it.qty || 0);
      let updatedBarcode = it.barcode;
      
      if (invId) {
        const inv = await prisma.inventory.update({
          where: { id: invId },
          data: { stock: { increment: qty } },
        }).catch(async () => {
          if (it.barcode) {
            return await prisma.inventory.update({
              where: { barcode: it.barcode },
              data: { stock: { increment: qty } },
            }).catch(() => null);
          }
          return null;
        });
        
        if (inv && inv.barcode) {
          updatedBarcode = inv.barcode;
        }
      } else if (it.barcode) {
        await prisma.inventory.updateMany({
          where: { barcode: it.barcode },
          data: { stock: { increment: qty } },
        }).catch(() => {});
      }
      
      // POS SYNC
      if (updatedBarcode) {
        try {
          await posPool.query(
            `UPDATE "Product" SET stock = stock + $1, "updatedAt" = NOW() WHERE barcode = $2`,
            [qty, updatedBarcode]
          );
        } catch (posErr) {
          console.error('POS Sync Error on Material Receive:', posErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Penerimaan Barang Ekspress berhasil disimpan & stok inventori telah bertambah',
      id: created.id,
      mrNo: created.mrNo,
      data: created,
    });
  } catch (error: any) {
    console.error('Error in POST /api/purchasing/express:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
