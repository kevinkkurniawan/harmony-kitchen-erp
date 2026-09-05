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
        { pono: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ],
    } : {};

    const [total, orders] = await Promise.all([
      prisma.t_purchaseorderheader.count({ where }),
      prisma.t_purchaseorderheader.findMany({
        where,
        include: { t_purchaseorderdetail: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    // Fetch suppliers to map supplier name
    const supplierIds = Array.from(new Set(orders.map((o: any) => o.supplierid).filter(Boolean))) as number[];
    const suppliers = await prisma.supplier.findMany({ where: { id: { in: supplierIds } } });
    const supplierMap = new Map(suppliers.map((s: any) => [s.id, s.suppliername]));

    // Fetch inventory for details
    const inventoryIds = Array.from(new Set(
      orders.flatMap((o: any) => o.t_purchaseorderdetail.map((d: any) => d.inventoryid))
    )).filter(Boolean) as number[];
    const inventories = await prisma.inventory.findMany({ where: { id: { in: inventoryIds } } });
    const inventoryMap = new Map(inventories.map((i: any) => [i.id, i]));

    const mapped = orders.map((po: any) => ({
      id: po.id,
      po_no: po.pono,
      po_date: po.podate,
      supplier_name: supplierMap.get(po.supplierid) || 'Unknown Supplier',
      delivery_date: po.deliverydate,
      description: po.description || '',
      subtotal: Number(po.grandtotal || 0) - Number(po.taxvalue || 0),
      tax: Number(po.taxvalue || 0),
      grand_total: Number(po.grandtotal || 0),
      status: po.status ? 'Approved' : 'Draft',
      created_at: po.createddate,
      items: po.t_purchaseorderdetail.map((d: any) => {
        const inv = inventoryMap.get(d.inventoryid);
        return {
          id: d.id,
          barcode: inv?.barcode || '',
          inventory_no: inv?.inventoryno || '',
          inventory_name: inv?.inventoryname || '',
          qty: Number(d.qty),
          unit_price: Number(d.price || 0),
          subtotal: Number(d.qty) * Number(d.price || 0),
        };
      }),
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { po_no, po_date, supplier_name, delivery_date, description, subtotal, tax, grand_total, status = 'Approved', items } = body;

    // Lookup supplier
    const supplier = await prisma.supplier.findFirst({ where: { suppliername: supplier_name } });
    const supplierid = supplier ? supplier.id : 1; // Default to 1 if not found

    // Lookup inventory IDs
    const inventoryNos = items.map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryno: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryno, i.id]));

    const created = await prisma.t_purchaseorderheader.create({
      data: {
        pono: po_no,
        podate: po_date ? new Date(po_date) : new Date(),
        supplierid,
        deliverydate: delivery_date ? new Date(delivery_date) : new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        description,
        taxvalue: Number(tax || 0),
        grandtotal: Number(grand_total || 0),
        status: status === 'Approved',
        t_purchaseorderdetail: {
          create: items.map((it: any) => ({
            inventoryid: invMapByNo.get(it.inventory_no || it.inventoryNo) || 1,
            qty: Number(it.qty) || 0,
            price: Number(it.unit_price || it.unitPrice || 0),
            discount: 0,
            description: null,
          })),
        },
      },
    });

    return NextResponse.json({ success: true, message: 'Purchase Order berhasil dibuat', data: created });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, po_no, po_date, supplier_name, delivery_date, description, tax, grand_total, status, items } = body;

    const supplier = await prisma.supplier.findFirst({ where: { suppliername: supplier_name } });
    const supplierid = supplier ? supplier.id : 1;

    const inventoryNos = items.map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryno: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryno, i.id]));

    await prisma.t_purchaseorderdetail.deleteMany({ where: { poid: Number(id) } });

    const updated = await prisma.t_purchaseorderheader.update({
      where: { id: Number(id) },
      data: {
        pono: po_no,
        podate: po_date ? new Date(po_date) : undefined,
        supplierid,
        deliverydate: delivery_date ? new Date(delivery_date) : undefined,
        description,
        taxvalue: Number(tax || 0),
        grandtotal: Number(grand_total || 0),
        status: status === 'Approved',
        t_purchaseorderdetail: {
          create: items.map((it: any) => ({
            inventoryid: invMapByNo.get(it.inventory_no || it.inventoryNo) || 1,
            qty: Number(it.qty) || 0,
            price: Number(it.unit_price || it.unitPrice || 0),
            discount: 0,
          })),
        },
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    await prisma.t_purchaseorderdetail.deleteMany({ where: { poid: id } });
    await prisma.t_purchaseorderheader.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
