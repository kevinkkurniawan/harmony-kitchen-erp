import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { parseColumnFilters } from '@/lib/column-filter';
import { apiError } from '@/lib/api-response';
import { getCurrentUser } from '@/lib/session';
import { canUserViewHpp } from '@/lib/capabilities';
import { getTodayBangkok } from '@/lib/date-utils';
import { receiptLineAmounts, receiptHeaderAmounts, dueDateFromTerm } from '@/lib/receipt-totals';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError('UNAUTHORIZED', 'Sesi login diperlukan.', 401);
    const canViewPrice = canUserViewHpp(user);

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const paginationParams = getPaginationParams(req, 50);

    // "Terbayar" / "Belum Terbayar" toggle: paid=true | false (legacy rows have ispaid NULL = not paid)
    const paid = searchParams.get('paid');
    const filterParams = new URLSearchParams(searchParams);
    filterParams.delete('paid');

    const { where: columnWhere, unsupportedFilters } = parseColumnFilters(filterParams, {
      // page / limit stay out: whitelisting them made the parser treat them as column filters
      whitelist: ['mrno', 'pono', 'suppliername', 'whid', 'isvoid', 'mrdate', 'dono', 'drivername', 'vehicleno'],
      exactMatchFields: ['mrno', 'pono', 'dono'],
      containsFields: ['suppliername', 'drivername', 'vehicleno'],
      numberFields: ['whid'],
      booleanFields: ['isvoid'],
      dateOnlyFields: ['mrdate'], // DATE column
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
    if (paid === 'true') where.ispaid = true;
    else if (paid === 'false') where.AND = [{ OR: [{ ispaid: false }, { ispaid: null }] }];

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
        isPaid: Boolean(mr.ispaid),
        paymentType: mr.paymenttype === 1 ? 'CASH' : 'TEMPO',
        payment_type: mr.paymenttype === 1 ? 'CASH' : 'TEMPO',
        dueDate: mr.duedate ? new Date(mr.duedate).toISOString().slice(0, 10) : '-',
        due_date: mr.duedate ? new Date(mr.duedate).toISOString().slice(0, 10) : '-',
        // Uang Muka is purchase money: Admin only, like the totals
        downPayment: canViewPrice ? Number(mr.downpayment || 0) : null,
        down_payment: canViewPrice ? Number(mr.downpayment || 0) : null,
        discPercentage: Number(mr.discpercentage || 0),
        disc_percentage: Number(mr.discpercentage || 0),
        ppnPercentage: Number(mr.ppnpercentage || 0),
        ppn_percentage: Number(mr.ppnpercentage || 0),
        subtotal: canViewPrice ? Number(mr.grandtotal || 0) - Number(mr.ppnvalue || 0) : null,
        tax: canViewPrice ? Number(mr.ppnvalue || 0) : null,
        ppnValue: canViewPrice ? Number(mr.ppnvalue || 0) : null,
        grandTotal: canViewPrice ? Number(mr.grandtotal || 0) : null,
        grand_total: canViewPrice ? Number(mr.grandtotal || 0) : null,
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
            price: canViewPrice ? Number(d.price || 0) : null,
            unit_price: canViewPrice ? Number(d.price || 0) : null,
            discPercentage: Number(d.discpersen1 || 0),
            disc_percentage: Number(d.discpersen1 || 0),
            subtotal: canViewPrice ? Number(d.subtotal || 0) : null,
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

// Clamp a percentage input to 0..100 (bad input counts as 0)
const pct = (v: unknown) => Math.max(0, Math.min(100, Number(v) || 0));

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
    const description = body.description;
    // `??` keeps a deliberate 0 (e.g. PPn 0%); `||` turned it into the default
    // Same clamp as Apply Changes: a negative or non-numeric Uang Muka counts as 0
    const downPayment = Math.max(0, Number(body.downPayment ?? body.down_payment ?? 0) || 0);
    const discPercentage = pct(body.discPercentage ?? body.disc_percentage ?? 0);
    const isMultiDisc = Boolean(body.isMultiDisc);
    const headerDisc2 = isMultiDisc ? pct(body.disc2) : 0;
    const headerDisc3 = isMultiDisc ? pct(body.disc3) : 0;
    const ppnPercentage = Number(body.ppnPercentage ?? body.ppn_percentage ?? 11);
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

    // Resolve and deduplicate items by inventory ID (a repeated item adds its qty; its first line's price / discounts win)
    type MergedLine = { inv: any; qty: number; price: number; disc1: number; disc2: number; disc3: number; discRp: number; description: string | null };
    const mergedItemsMap = new Map<string, MergedLine>();
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
          price: Math.max(0, Number(it.price || it.unit_price || it.unitPrice || 0)),
          disc1: pct(it.discPercentage ?? it.disc_percentage ?? it.disc1),
          disc2: pct(it.disc2),
          disc3: pct(it.disc3),
          discRp: Math.max(0, Number(it.discRp ?? it.disc ?? 0) || 0),
          description: it.description || null,
        });
      }
    }

    // Line amounts follow the old detail SP; the client's subtotal is not trusted
    const lines = Array.from(mergedItemsMap.values()).map((l) => ({ ...l, ...receiptLineAmounts(l) }));
    const negative = lines.find((l) => l.netPrice < 0);
    if (negative) {
      return NextResponse.json({ success: false, error: `Diskon ${negative.inv.inventoryname} melebihi harga` }, { status: 400 });
    }

    const rawSubtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
    const { discValue, ppnValue, grandTotal } = receiptHeaderAmounts({
      subtotal: rawSubtotal, disc1: discPercentage, isMultiDisc, disc2: headerDisc2, disc3: headerDisc3, ppnPercentage, downPayment,
    });

    const generatedMrNo = mrNo || `MR-RCV-${Date.now().toString().slice(-6)}`;
    // The logged-in user, not a request header (no client sent one, so every receipt read "admin")
    const sessionUser = await getCurrentUser();
    if (!sessionUser) return NextResponse.json({ success: false, error: 'Sesi login diperlukan.' }, { status: 401 });
    const authUser = sessionUser.username;
    const parsedPaymentType = paymentType === 'CASH' ? 1 : 2;
    const mrDay = mrDate ? String(mrDate).slice(0, 10) : getTodayBangkok();
    // Credit: "Lama Termin" (days) gives the due date; an explicit dueDate is still accepted from other callers
    const longTerm = parsedPaymentType === 2 ? Math.max(0, Math.trunc(Number(body.longTerm ?? body.long_term) || 0)) : 0;
    const dueDate = parsedPaymentType === 2
      ? (body.longTerm != null || body.long_term != null ? dueDateFromTerm(mrDay, longTerm) : (body.dueDate || body.due_date || null))
      : null;

    const created = await prisma.$transaction(async (tx) => {
      const header = await tx.t_materialreceiveheader.create({
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
          longterm: longTerm,
          duedate: dueDate ? new Date(dueDate) : null,
          downpayment: downPayment,
          discpercentage: discPercentage,
          disc1: discPercentage,
          disc2: headerDisc2,
          disc3: headerDisc3,
          ismultidisc: isMultiDisc,
          discvalue: discValue,
          ppnpercentage: ppnPercentage,
          ppnvalue: ppnValue,
          grandtotal: grandTotal,
          description: description || null,
          isvoid: false,
          // Old header SP: a cash receipt is paid on entry
          ispaid: parsedPaymentType === 1,
          createduser: authUser,
          createddate: new Date(),
          modifieduser: authUser,
          modifieddate: new Date(),
          t_materialreceivedetail: {
            create: lines.map((l) => ({
              inventoryid: String(l.inv.id),
              qty: l.qty,
              price: l.price,
              discpersen1: l.disc1,
              discpersen2: l.disc2,
              discpersen3: l.disc3,
              disc: l.discRp,
              disctotal: Math.round(l.discTotal),
              subtotal: l.subtotal,
              uomid: l.inv.uomid ? Number(l.inv.uomid) : null,
              description: l.description,
              isinventory: true,
              createduser: authUser,
              createddate: new Date(),
              modifieduser: authUser,
              modifieddate: new Date(),
            })),
          },
        },
      });

      // Update inventory stock & buy price / HPP (ERP rule: the receipt's price becomes the buy price and HPP)
      for (const { inv, qty, price } of lines) {
        await tx.m_inventory.update({
          where: { id: inv.id },
          data: {
            stokupdate: { increment: qty },
            pricebuy: Math.round(price),
            hpp: Math.round(price),
          },
        });
      }
      return header;
      // One stock update per line: long receipts need more than the 5 s default (same limits as opname)
    }, { maxWait: 15000, timeout: 60000 });

    // Purchase totals stay Admin-only (the screen does not use this value)
    const shownTotal = canUserViewHpp(sessionUser) ? grandTotal : null;
    return NextResponse.json({
      success: true,
      id: String(created.id),
      mrNo: created.mrno,
      grandTotal: shownTotal,
      message: `Penerimaan Barang dengan Harga ${created.mrno} berhasil disimpan & HPP diperbarui!`,
      data: {
        id: Number(created.id),
        mrNo: created.mrno,
        grandTotal: shownTotal,
      },
    });
  } catch (error: any) {
    console.error("POST /api/purchasing/priced error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
