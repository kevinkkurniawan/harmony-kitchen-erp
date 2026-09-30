import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { parseColumnFilters } from '@/lib/column-filter';
import { apiError } from '@/lib/api-response';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    const { where: columnWhere, unsupportedFilters } = parseColumnFilters(searchParams, {
      whitelist: ['mrno', 'suppliername', 'whid', 'isvoid', 'mrdate', 'dono', 'drivername', 'vehicleno', 'page', 'limit'],
      exactMatchFields: ['mrno', 'dono'],
      containsFields: ['suppliername', 'drivername', 'vehicleno'],
      numberFields: ['whid'],
      booleanFields: ['isvoid'],
      dateRangeFields: ['mrdate'],
    });

    if (unsupportedFilters.length > 0) {
      return apiError(
        'BAD_REQUEST',
        `Filter kolom tidak didukung: ${unsupportedFilters.join(', ')}`,
        400,
        unsupportedFilters.map((f) => ({ field: f, message: 'Filter kolom tidak didukung' }))
      );
    }

    const where: any = {
      ...columnWhere,
    };

    if (q) {
      where.OR = [
        { mrno: { contains: q, mode: 'insensitive' as const } },
        { suppliername: { contains: q, mode: 'insensitive' as const } },
        { dono: { contains: q, mode: 'insensitive' as const } },
        { drivername: { contains: q, mode: 'insensitive' as const } },
        { vehicleno: { contains: q, mode: 'insensitive' as const } },
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
    )).filter((n) => !isNaN(n) && n > 0) as number[];
    const inventories = inventoryIds.length > 0
      ? await prisma.m_inventory.findMany({
          where: { id: { in: inventoryIds.map((id) => BigInt(id)) } },
          include: { m_uom: true },
        })
      : [];
    const inventoryMap = new Map(inventories.map((i: any) => [Number(i.id), i]));
    
    const whIds = Array.from(new Set(receives.map((r: any) => Number(r.whid)).filter((n) => !isNaN(n) && n > 0)));
    const warehouses = whIds.length > 0
      ? await prisma.m_warehouse.findMany({ where: { id: { in: whIds.map((id) => BigInt(id)) } } })
      : [];
    const whMap = new Map(warehouses.map((w: any) => [Number(w.id), w.whname]));

    const mapped = receives.map((mr: any) => {
      const totalQty = mr.t_materialreceivedetail.reduce((sum: number, d: any) => sum + Number(d.qty || 0), 0);
      return {
        id: Number(mr.id),
        mrNo: mr.mrno || '-',
        mr_no: mr.mrno || '-',
        mrDate: mr.mrdate ? new Date(mr.mrdate).toISOString().slice(0, 10) : '-',
        mr_date: mr.mrdate ? new Date(mr.mrdate).toISOString().slice(0, 10) : '-',
        poNo: mr.pono || '-',
        po_no: mr.pono || '-',
        doNo: mr.dono || '-',
        do_no: mr.dono || '-',
        supplierId: mr.supplierid ? String(mr.supplierid) : '',
        supplier_id: mr.supplierid,
        supplierName: mr.suppliername || '-',
        supplier_name: mr.suppliername || '-',
        driverName: mr.drivername || '-',
        driver_name: mr.drivername || '-',
        vehicleNo: mr.vehicleno || '-',
        vehicle_no: mr.vehicleno || '-',
        transporter: mr.transporter || '-',
        wh_name: whMap.get(Number(mr.whid)) || '-',
        wh_id: mr.whid,
        description: mr.description || '-',
        isExpress: true,
        is_express: true,
        isVoid: Boolean(mr.isvoid),
        is_void: Boolean(mr.isvoid),
        totalQty,
        total_qty: totalQty,
        items: mr.t_materialreceivedetail.map((d: any) => {
          const inv = inventoryMap.get(Number(d.inventoryid));
          return {
            id: Number(d.id),
            barcode: inv?.barcode || '',
            inventory_no: inv?.inventoryno || '',
            inventory_name: inv?.inventoryname || '',
            uom_name: inv?.m_uom?.uomname || inv?.m_uom?.uomcode || 'PCS',
            qty: Number(d.qty || 0),
            description: d.description || '',
          };
        }),
        created_at: mr.createddate,
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error("GET /api/purchasing/express error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mr_no, mr_date, do_no, supplier_id, driver_name, vehicle_no, transporter, wh_id, description, items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Minimal 1 item barang wajib diisi' }, { status: 400 });
    }

    const supplierIdNum = Number(supplier_id);
    if (!supplierIdNum) {
      return NextResponse.json({ success: false, error: 'Supplier ID is required' }, { status: 400 });
    }
    const supplier = await prisma.m_supplier.findUnique({ where: { id: BigInt(supplierIdNum) } });
    if (!supplier) {
      return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }

    const inventoryNos = items.map((it: any) => it.inventory_no || it.inventoryNo).filter(Boolean);
    const inventoryIds = items
      .map((it: any) => Number(it.inventory_id || it.inventoryId))
      .filter((n: number) => !isNaN(n) && n > 0)
      .map((n: number) => BigInt(n));

    const orFilters: any[] = [];
    if (inventoryIds.length > 0) orFilters.push({ id: { in: inventoryIds } });
    if (inventoryNos.length > 0) orFilters.push({ inventoryno: { in: inventoryNos } });

    const inventories = orFilters.length > 0
      ? await prisma.m_inventory.findMany({ where: { OR: orFilters } })
      : [];
    const invMapByNo = new Map(inventories.map((i: any) => [i.inventoryno, i]));
    const invMapById = new Map(inventories.map((i: any) => [String(i.id), i]));

    // Resolve and deduplicate items by inventory ID
    const mergedItemsMap = new Map<string, { inv: any; qty: number; description: string | null }>();
    for (const it of items) {
      const inv =
        invMapById.get(String(it.inventory_id || it.inventoryId)) ||
        invMapByNo.get(it.inventory_no || it.inventoryNo);
      if (!inv) {
        return NextResponse.json(
          { success: false, error: `Inventory item ${it.inventory_no || it.inventoryNo || it.inventoryId} not found` },
          { status: 404 }
        );
      }
      const key = String(inv.id);
      const qtyNum = Math.max(1, Number(it.qty) || 1);
      const existing = mergedItemsMap.get(key);
      if (existing) {
        existing.qty += qtyNum;
      } else {
        mergedItemsMap.set(key, {
          inv,
          qty: qtyNum,
          description: it.description || null,
        });
      }
    }

    const generatedMrNo = mr_no || `MR-EXP-${Date.now().toString().slice(-6)}`;
    const authUser = req.headers.get('x-user') || 'admin';

    const created = await prisma.t_materialreceiveheader.create({
      data: {
        mrno: generatedMrNo,
        mrdate: mr_date ? new Date(mr_date) : new Date(),
        poid: null,
        dono: do_no || null,
        supplierid: Number(supplier.id),
        suppliername: supplier.suppliername,
        drivername: driver_name || null,
        vehicleno: vehicle_no || null,
        transporter: transporter || null,
        whid: Number(wh_id) || null,
        description: description || null,
        isvoid: false,
        ispaid: false,
        createduser: authUser,
        createddate: new Date(),
        modifieduser: authUser,
        modifieddate: new Date(),
        t_materialreceivedetail: {
          create: Array.from(mergedItemsMap.values()).map(({ inv, qty, description: itemDesc }) => ({
            inventoryid: String(inv.id),
            qty,
            uomid: inv.uomid ? Number(inv.uomid) : null,
            description: itemDesc,
            isinventory: true,
            createduser: authUser,
            createddate: new Date(),
            modifieduser: authUser,
            modifieddate: new Date(),
          })),
        },
      },
    });

    // Update inventory stock
    for (const { inv, qty } of mergedItemsMap.values()) {
      await prisma.m_inventory.update({
        where: { id: inv.id },
        data: { stokupdate: { increment: qty } },
      });
    }

    return NextResponse.json({
      success: true,
      id: String(created.id),
      mrNo: created.mrno,
      message: `Penerimaan Barang Ekspress ${created.mrno} berhasil disimpan & stok diperbarui!`,
      data: {
        id: Number(created.id),
        mrNo: created.mrno,
      },
    });
  } catch (error: any) {
    console.error("POST /api/purchasing/express error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
