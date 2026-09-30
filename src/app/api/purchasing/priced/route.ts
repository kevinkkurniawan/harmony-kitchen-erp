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
      whitelist: ['mrno', 'pono', 'suppliername', 'whid', 'isvoid', 'mrdate', 'dono', 'drivername', 'vehicleno', 'page', 'limit'],
      exactMatchFields: ['mrno', 'pono', 'dono'],
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
        { pono: { contains: q, mode: 'insensitive' as const } },
        { dono: { contains: q, mode: 'insensitive' as const } },
        { suppliername: { contains: q, mode: 'insensitive' as const } },
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
        whName: whMap.get(Number(mr.whid)) || 'Gudang Utama Dapur',
        wh_name: whMap.get(Number(mr.whid)) || 'Gudang Utama Dapur',
        wh_id: mr.whid,
        description: mr.description || '-',
        isExpress: false,
        is_express: false,
        isVoid: Boolean(mr.isvoid),
        is_void: Boolean(mr.isvoid),
        paymentType: mr.paymenttype === 1 ? 'CASH' : 'TEMPO',
        payment_type: mr.paymenttype === 1 ? 'CASH' : 'TEMPO',
        dueDate: mr.duedate ? new Date(mr.duedate).toISOString().slice(0, 10) : '-',
        due_date: mr.duedate ? new Date(mr.duedate).toISOString().slice(0, 10) : '-',
        downPayment: Number(mr.downpayment || 0),
        down_payment: Number(mr.downpayment || 0),
        discPercentage: Number(mr.discpercentage || 0),
        disc_percentage: Number(mr.discpercentage || 0),
        ppnPercentage: Number(mr.ppnpercentage || 0),
        ppn_percentage: Number(mr.ppnpercentage || 0),
        subtotal: Number(mr.grandtotal || 0) - Number(mr.ppnvalue || 0),
        tax: Number(mr.ppnvalue || 0),
        ppnValue: Number(mr.ppnvalue || 0),
        grandTotal: Number(mr.grandtotal || 0),
        grand_total: Number(mr.grandtotal || 0),
        totalQty,
        total_qty: totalQty,
        items: mr.t_materialreceivedetail.map((d: any) => {
          const inv = inventoryMap.get(Number(d.inventoryid));
          return {
            id: Number(d.id),
            inventoryId: d.inventoryid,
            barcode: inv?.barcode || '',
            inventoryNo: inv?.inventoryno || '',
            inventory_no: inv?.inventoryno || '',
            inventoryName: inv?.inventoryname || '',
            inventory_name: inv?.inventoryname || '',
            uomName: inv?.m_uom?.uomname || inv?.m_uom?.uomcode || 'PCS',
            uom_name: inv?.m_uom?.uomname || inv?.m_uom?.uomcode || 'PCS',
            qty: Number(d.qty || 0),
            price: Number(d.price || 0),
            unit_price: Number(d.price || 0),
            discPercentage: Number(d.discpersen1 || 0),
            disc_percentage: Number(d.discpersen1 || 0),
            subtotal: Number(d.subtotal || 0),
            description: d.description || '',
          };
        }),
        created_at: mr.createddate,
      };
    });

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error("GET /api/purchasing/priced error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mrNo = body.mrNo || body.mr_no;
    const mrDate = body.mrDate || body.mr_date;
    const poNo = body.poNo || body.po_no;
    const doNo = body.doNo || body.do_no;
    const supplierId = body.supplierId || body.supplier_id;
    const driverName = body.driverName || body.driver_name;
    const vehicleNo = body.vehicleNo || body.vehicle_no;
    const transporter = body.transporter;
    const whId = body.whId || body.wh_id;
    const paymentType = body.paymentType || body.payment_type;
    const dueDate = body.dueDate || body.due_date;
    const description = body.description;
    const downPayment = Number(body.downPayment || body.down_payment || 0);
    const discPercentage = Number(body.discPercentage || body.disc_percentage || 0);
    const ppnPercentage = Number(body.ppnPercentage || body.ppn_percentage || 11);
    const items = body.items || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Minimal 1 item barang wajib diisi' }, { status: 400 });
    }

    const supplierIdNum = Number(supplierId);
    if (!supplierIdNum) {
      return NextResponse.json({ success: false, error: 'Supplier ID is required' }, { status: 400 });
    }
    const supplier = await prisma.m_supplier.findUnique({ where: { id: BigInt(supplierIdNum) } });
    if (!supplier) {
      return NextResponse.json({ success: false, error: 'Supplier not found' }, { status: 404 });
    }

    const po = poNo ? await prisma.t_purchaseorderheader.findFirst({ where: { pono: poNo } }) : null;

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
    const mergedItemsMap = new Map<string, { inv: any; qty: number; price: number; discPercentage: number; subtotal: number; description: string | null }>();
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
      const priceNum = Math.max(0, Number(it.price || it.unit_price || it.unitPrice || 0));
      const discNum = Math.max(0, Math.min(100, Number(it.discPercentage || it.disc_percentage || 0)));
      const subtotalNum = Number(it.subtotal) || (qtyNum * priceNum * (1 - discNum / 100));

      const existing = mergedItemsMap.get(key);
      if (existing) {
        existing.qty += qtyNum;
        existing.subtotal += subtotalNum;
      } else {
        mergedItemsMap.set(key, {
          inv,
          qty: qtyNum,
          price: priceNum,
          discPercentage: discNum,
          subtotal: subtotalNum,
          description: it.description || null,
        });
      }
    }

    const rawSubtotal = Array.from(mergedItemsMap.values()).reduce((sum, item) => sum + item.subtotal, 0);
    const discValue = rawSubtotal * (discPercentage / 100);
    const afterDisc = rawSubtotal - discValue;
    const ppnValue = afterDisc * (ppnPercentage / 100);
    const grandTotal = afterDisc + ppnValue;

    const generatedMrNo = mrNo || `MR-RCV-${Date.now().toString().slice(-6)}`;
    const authUser = req.headers.get('x-user') || 'admin';
    const parsedPaymentType = paymentType === 'CASH' ? 1 : 2;

    const created = await prisma.t_materialreceiveheader.create({
      data: {
        mrno: generatedMrNo,
        mrdate: mrDate ? new Date(mrDate) : new Date(),
        poid: po ? po.id : null,
        pono: poNo || null,
        dono: doNo || null,
        supplierid: Number(supplier.id),
        suppliername: supplier.suppliername,
        drivername: driverName || null,
        vehicleno: vehicleNo || null,
        transporter: transporter || null,
        whid: Number(whId) || null,
        paymenttype: parsedPaymentType,
        duedate: dueDate ? new Date(dueDate) : null,
        downpayment: downPayment,
        discpercentage: discPercentage,
        discvalue: discValue,
        ppnpercentage: ppnPercentage,
        ppnvalue: ppnValue,
        grandtotal: grandTotal,
        description: description || null,
        isvoid: false,
        ispaid: false,
        createduser: authUser,
        createddate: new Date(),
        modifieduser: authUser,
        modifieddate: new Date(),
        t_materialreceivedetail: {
          create: Array.from(mergedItemsMap.values()).map(({ inv, qty, price, discPercentage: itemDisc, subtotal: itemSub, description: itemDesc }) => ({
            inventoryid: String(inv.id),
            qty,
            price,
            discpersen1: itemDisc,
            subtotal: itemSub,
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

    // Update inventory stock & buy price / HPP
    for (const { inv, qty, price } of mergedItemsMap.values()) {
      await prisma.m_inventory.update({
        where: { id: inv.id },
        data: {
          stokupdate: { increment: qty },
          pricebuy: Math.round(price),
          hpp: Math.round(price),
        },
      });
    }

    return NextResponse.json({
      success: true,
      id: String(created.id),
      mrNo: created.mrno,
      grandTotal,
      message: `Penerimaan Barang dengan Harga ${created.mrno} berhasil disimpan & HPP diperbarui!`,
      data: {
        id: Number(created.id),
        mrNo: created.mrno,
        grandTotal,
      },
    });
  } catch (error: any) {
    console.error("POST /api/purchasing/priced error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
