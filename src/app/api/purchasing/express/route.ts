import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = {
      poid: null, // Express means no PO
    };
    if (q) {
      where.OR = [
        { mrno: { contains: q, mode: 'insensitive' as const } },
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
      receives.flatMap((r: any) => r.t_materialreceivedetail.map((d: any) => Number(d.inventoryid)))
    )).filter(Boolean) as number[];
    const inventories = await prisma.inventory.findMany({ 
      where: { id: { in: inventoryIds } }
    });
    const inventoryMap = new Map(inventories.map((i: any) => [i.id, i]));
    
    const whIds = Array.from(new Set(receives.map(r => r.whid).filter(Boolean))) as number[];
    const warehouses = await prisma.m_warehouse.findMany({ where: { id: { in: whIds } } });
    const whMap = new Map(warehouses.map((w: any) => [w.id, w.whname]));

    const mapped = receives.map((mr: any) => {
      const totalQty = mr.t_materialreceivedetail.reduce((sum: number, d: any) => sum + Number(d.qty), 0);
      return {
        id: mr.id,
        mr_no: mr.mrno,
        mr_date: mr.mrdate,
        po_no: '-',
        do_no: mr.dono || '-',
        supplier_id: mr.supplierid,
        supplier_name: mr.suppliername,
        driver_name: mr.drivername || '-',
        vehicle_no: mr.vehicleno || '-',
        transporter: mr.transporter || '-',
        wh_name: whMap.get(mr.whid) || '-',
        wh_id: mr.whid,
        description: mr.description || '-',
        is_express: true,
        is_void: mr.isvoid,
        total_qty: totalQty,
        items: mr.t_materialreceivedetail.map((d: any) => {
          const inv = inventoryMap.get(Number(d.inventoryid));
          return {
            id: d.id,
            barcode: inv?.barcode || '',
            inventory_no: inv?.inventoryno || '',
            inventory_name: inv?.inventoryname || '',
            qty: Number(d.qty),
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
    const { mr_no, mr_date, do_no, supplier_id, supplier_name, driver_name, vehicle_no, transporter, wh_id, description, items } = body;

    const supplierIdNum = Number(supplier_id);
    if (!supplierIdNum) {
      return NextResponse.json({ success: false, error: 'Supplier ID is required' }, { status: 400 });
    }
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierIdNum } });
    if (!supplier) {
      return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }

    const inventoryNos = items.map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventories = await prisma.inventory.findMany({ where: { inventoryno: { in: inventoryNos } } });
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryno, i]));

    for (const it of items) {
      const invNo = it.inventory_no || it.inventoryNo;
      if (!invMapByNo.has(invNo)) {
        return NextResponse.json({ success: false, error: `Inventory item ${invNo} not found` }, { status: 404 });
      }
    }

    const generatedMrNo = mr_no || `MR-EXP-${new Date().getTime().toString().slice(-6)}`;
    const authUser = req.headers.get('x-user') || 'admin';

    const created = await prisma.t_materialreceiveheader.create({
      data: {
        mrno: generatedMrNo,
        mrdate: mr_date ? new Date(mr_date) : new Date(),
        poid: null,
        dono: do_no,
        supplierid: supplier.id,
        suppliername: supplier.suppliername,
        drivername: driver_name,
        vehicleno: vehicle_no,
        transporter: transporter,
        whid: Number(wh_id) || null,
        description,
        isvoid: false,
        ispaid: false,
        createduser: authUser,
        createddate: new Date(),
        modifieduser: authUser,
        modifieddate: new Date(),
        t_materialreceivedetail: {
          create: items.map((it: any) => {
            const inv = invMapByNo.get(it.inventory_no || it.inventoryNo);
            return {
              inventoryid: String(inv.id),
              qty: Number(it.qty) || 0,
              uomid: inv.uomid,
              description: it.description || null,
              isinventory: true,
              createduser: authUser,
              createddate: new Date(),
              modifieduser: authUser,
              modifieddate: new Date(),
            };
          }),
        },
      },
    });

    // Update inventory stock
    for (const it of items) {
      const inv = invMapByNo.get(it.inventory_no || it.inventoryNo);
      if (inv) {
        await prisma.inventory.update({
          where: { id: inv.id },
          data: { stokupdate: { increment: Number(it.qty) || 0 } },
        });
      }
    }

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) { 
    return NextResponse.json({ success: false, error: error.message }, { status: 500 }); 
  }
}
