import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = q ? {
      OR: [
        { poNo: { contains: q, mode: 'insensitive' as const } },
        { supplierName: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {};

    const [total, orders] = await Promise.all([
      prisma.purchaseOrderHeader.count({ where }),
      prisma.purchaseOrderHeader.findMany({
        where,
        include: { details: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = orders.map((po: any) => ({
      id: po.id,
      po_no: po.poNo,
      po_date: po.poDate,
      supplier_name: po.supplierName || 'Unknown Supplier',
      delivery_date: po.deliveryDate,
      description: po.description || '',
      subtotal: Number(po.subtotal || 0),
      tax: Number(po.tax || 0),
      grand_total: Number(po.grandTotal || 0),
      status: po.status,
      created_at: po.createdAt,
      items: po.details.map((d: any) => ({
        id: d.id,
        barcode: d.barcode || '',
        inventory_no: d.inventoryNo || '',
        inventory_name: d.inventoryName || '',
        qty: Number(d.qty),
        unit_price: Number(d.unitPrice || 0),
        subtotal: Number(d.subtotal || 0),
      })),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { po_no, po_date, supplier_name, delivery_date, description, subtotal, tax, grand_total, status = 'Approved', items } = body;

    const inventoryNos = (items || []).map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryNo: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryNo, i]));

    const created = await prisma.purchaseOrderHeader.create({
      data: {
        poNo: po_no,
        poDate: po_date ? new Date(po_date) : new Date(),
        supplierName: supplier_name || 'Umum',
        deliveryDate: delivery_date ? new Date(delivery_date) : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        description,
        subtotal: Number(subtotal || 0),
        tax: Number(tax || 0),
        grandTotal: Number(grand_total || 0),
        status: status || 'Approved',
        details: {
          create: (items || []).map((it: any) => {
            const inv = invMapByNo.get(it.inventory_no || it.inventoryNo);
            const qty = Number(it.qty) || 0;
            const unitPrice = Number(it.unit_price || it.unitPrice || 0);
            return {
              barcode: inv?.barcode || it.barcode || '',
              inventoryNo: it.inventory_no || it.inventoryNo || '',
              inventoryName: inv?.inventoryName || it.inventory_name || it.inventoryName || '',
              qty,
              unitPrice,
              subtotal: qty * unitPrice,
            };
          }),
        },
      },
    });

    return NextResponse.json({ success: true, message: 'Purchase Order berhasil dibuat', data: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, po_no, po_date, supplier_name, delivery_date, description, subtotal, tax, grand_total, status, items } = body;

    const inventoryNos = (items || []).map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryNo: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryNo, i]));

    await prisma.purchaseOrderDetail.deleteMany({ where: { headerId: Number(id) } });

    const updated = await prisma.purchaseOrderHeader.update({
      where: { id: Number(id) },
      data: {
        poNo: po_no,
        poDate: po_date ? new Date(po_date) : undefined,
        supplierName: supplier_name || undefined,
        deliveryDate: delivery_date ? new Date(delivery_date) : undefined,
        description,
        subtotal: Number(subtotal || 0),
        tax: Number(tax || 0),
        grandTotal: Number(grand_total || 0),
        status: status || undefined,
        details: {
          create: (items || []).map((it: any) => {
            const inv = invMapByNo.get(it.inventory_no || it.inventoryNo);
            const qty = Number(it.qty) || 0;
            const unitPrice = Number(it.unit_price || it.unitPrice || 0);
            return {
              barcode: inv?.barcode || it.barcode || '',
              inventoryNo: it.inventory_no || it.inventoryNo || '',
              inventoryName: inv?.inventoryName || it.inventory_name || it.inventoryName || '',
              qty,
              unitPrice,
              subtotal: qty * unitPrice,
            };
          }),
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    await prisma.purchaseOrderDetail.deleteMany({ where: { headerId: id } });
    await prisma.purchaseOrderHeader.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

