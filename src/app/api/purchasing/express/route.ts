import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = {
      isExpress: true,
    };
    if (q) {
      where.OR = [
        { mrNo: { contains: q, mode: 'insensitive' as const } },
        { supplierName: { contains: q, mode: 'insensitive' as const } },
      ];
    }

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

    const mapped = receives.map((mr: any) => {
      const totalQty = mr.details.reduce((sum: number, d: any) => sum + Number(d.qty), 0);
      return {
        id: mr.id,
        mr_no: mr.mrNo,
        mr_date: mr.mrDate,
        po_no: mr.poNo || '-',
        do_no: mr.doNo || '-',
        supplier_id: mr.supplierId,
        supplier_name: mr.supplierName,
        driver_name: mr.driverName || '-',
        vehicle_no: mr.vehicleNo || '-',
        wh_name: mr.whName || 'Gudang Utama',
        description: mr.description || '-',
        is_express: true,
        is_void: mr.isVoid,
        total_qty: totalQty,
        items: mr.details.map((d: any) => ({
          id: d.id,
          barcode: d.barcode || '',
          inventory_no: d.inventoryNo || '',
          inventory_name: d.inventoryName || '',
          qty: Number(d.qty),
          description: d.description || '',
        })),
        created_at: mr.createdAt,
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mr_no, mr_date, do_no, supplier_name, driver_name, vehicle_no, description, items } = body;

    const supplier = await prisma.supplier.findFirst({ where: { supplierName: supplier_name } });

    const inventoryNos = (items || []).map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryNo: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryNo, i]));

    const created = await prisma.materialReceiveHeader.create({
      data: {
        mrNo: mr_no,
        mrDate: mr_date ? new Date(mr_date) : new Date(),
        poNo: null,
        doNo: do_no,
        supplierId: supplier ? supplier.id : null,
        supplierName: supplier_name || 'Umum',
        driverName: driver_name,
        vehicleNo: vehicle_no,
        whName: 'Gudang Utama',
        description,
        isExpress: true,
        isVoid: false,
        isPriced: false,
        details: {
          create: (items || []).map((it: any) => {
            const inv = invMapByNo.get(it.inventory_no || it.inventoryNo);
            return {
              inventoryId: inv ? inv.id : null,
              barcode: inv?.barcode || it.barcode || '',
              inventoryNo: it.inventory_no || it.inventoryNo || '',
              inventoryName: inv?.inventoryName || it.inventory_name || it.inventoryName || '',
              qty: Number(it.qty) || 0,
              unitPrice: 0,
              subtotal: 0,
              description: it.description || null,
            };
          }),
        },
      },
    });

    // Update inventory stock
    for (const it of (items || [])) {
      const inv = invMapByNo.get(it.inventory_no || it.inventoryNo);
      if (inv) {
        await prisma.inventory.update({
          where: { id: inv.id },
          data: { stock: { increment: Number(it.qty) || 0 } },
        });
      }
    }

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

