import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = {
      poid: { not: null }, // Priced means it has a PO
    };
    if (q) {
      where.OR = [
        { mrno: { contains: q, mode: 'insensitive' as const } },
        { pono: { contains: q, mode: 'insensitive' as const } },
        { suppliername: { contains: q, mode: 'insensitive' as const } },
      ];
    }

    const [total, receives] = await Promise.all([
      prisma.t_materialreceiveheader.count({ where }),
      prisma.t_materialreceiveheader.findMany({
        where,
        include: { t_materialreceivedetail: true },
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const inventoryIds = Array.from(new Set(
      receives.flatMap((r: any) => r.t_materialreceivedetail.map((d: any) => d.inventoryid))
    )).filter(Boolean) as number[];
    const inventories = await prisma.inventory.findMany({ where: { id: { in: inventoryIds } } });
    const inventoryMap = new Map(inventories.map((i: any) => [i.id, i]));

    const mapped = receives.map((mr: any) => {
      return {
        id: mr.id,
        mr_no: mr.mrno,
        mr_date: mr.mrdate,
        po_no: mr.pono || '-',
        do_no: mr.dono || '-',
        supplier_id: mr.supplierid,
        supplier_name: mr.suppliername,
        driver_name: mr.drivername || '-',
        vehicle_no: mr.vehicleno || '-',
        wh_name: 'Gudang Utama',
        description: mr.description || '-',
        is_express: false,
        is_void: mr.isvoid,
        payment_type: mr.paymenttype || '-',
        due_date: mr.duedate,
        down_payment: mr.downpayment || 0,
        disc_percentage: mr.discpercentage || 0,
        ppn_percentage: mr.ppnpercentage || 0,
        subtotal: Number(mr.grandtotal || 0) - Number(mr.ppnvalue || 0),
        tax: Number(mr.ppnvalue || 0),
        grand_total: Number(mr.grandtotal || 0),
        items: mr.t_materialreceivedetail.map((d: any) => {
          const inv = inventoryMap.get(d.inventoryid);
          return {
            id: d.id,
            barcode: inv?.barcode || '',
            inventory_no: inv?.inventoryno || '',
            inventory_name: inv?.inventoryname || '',
            qty: Number(d.qty),
            unit_price: Number(d.price),
            subtotal: Number(d.subtotal),
            description: d.description || '',
          };
        }),
        created_at: mr.createddate,
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mr_no, mr_date, po_no, do_no, supplier_name, driver_name, vehicle_no, description, tax, grand_total, items } = body;

    const supplier = await prisma.supplier.findFirst({ where: { suppliername: supplier_name } });
    
    // Find PO
    const po = po_no ? await prisma.t_purchaseorderheader.findFirst({ where: { pono: po_no } }) : null;

    const inventoryNos = items.map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryno: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryno, i.id]));

    const created = await prisma.t_materialreceiveheader.create({
      data: {
        mrno: mr_no,
        mrdate: mr_date ? new Date(mr_date) : new Date(),
        poid: po ? po.id : null,
        pono: po_no,
        dono: do_no,
        supplierid: supplier ? supplier.id : 1,
        suppliername: supplier_name,
        drivername: driver_name,
        vehicleno: vehicle_no,
        description,
        ppnvalue: Number(tax || 0),
        grandtotal: Number(grand_total || 0),
        isvoid: false,
        ispaid: false,
        createduser: 'system',
        createddate: new Date(),
        modifieduser: 'system',
        modifieddate: new Date(),
        t_materialreceivedetail: {
          create: items.map((it: any) => ({
            inventoryid: String(invMapByNo.get(it.inventory_no || it.inventoryNo) || 1),
            qty: Number(it.qty) || 0,
            price: Number(it.unit_price || it.unitPrice || 0),
            subtotal: Number(it.subtotal || 0),
            description: it.description || null,
            isinventory: true,
            createduser: 'system',
            createddate: new Date(),
            modifieduser: 'system',
            modifieddate: new Date(),
          })),
        },
      },
    });

    // Update inventory stock
    for (const it of items) {
      const invId = invMapByNo.get(it.inventory_no || it.inventoryNo);
      if (invId) {
        await prisma.inventory.update({
          where: { id: invId },
          data: { stokupdate: { increment: Number(it.qty) || 0 } },
        });
      }
    }

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) { return NextResponse.json({ success: false }, { status: 500 }); }
}
