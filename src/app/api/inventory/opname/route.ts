import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';
import { getCurrentUser } from '@/lib/session';
import { requireCapability } from '@/lib/capabilities';
import { saveOpnameTransaction, reverseOpnameTransaction } from '@/lib/stock-opname';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const noTx = searchParams.get('noTx');
    const q = searchParams.get('q') || '';
    const statusFilter = searchParams.get('status');
    const paginationParams = getPaginationParams(req, 50);

    if (noTx) {
      const header = await prisma.t_opnameheader.findUnique({
        where: { notransaction: noTx },
      });

      let details = await prisma.t_opnamedetail.findMany({
        where: { notransaction: noTx },
      });

      // Fallback to t_opname if details in t_opnamedetail not present
      if (!details || details.length === 0) {
        const legacyDetails = await prisma.t_opname.findMany({
          where: { notransaction: noTx },
        });
        if (!legacyDetails || legacyDetails.length === 0) {
          return apiError('NOT_FOUND', 'Opname tidak ditemukan', 404);
        }
        details = legacyDetails.map((ld) => ({
          id: ld.id,
          notransaction: ld.notransaction,
          inventoryid: ld.inventoryid,
          barcode: ld.barcode,
          systemqty: new Prisma.Decimal(0),
          physicalqty: new Prisma.Decimal(ld.qty || 0),
          differenceqty: new Prisma.Decimal(0),
          unitprice: new Prisma.Decimal(ld.price || 0),
          notes: ld.description,
          rowguid: ld.rowguid,
        }));
      }

      const inventoryIds = details.map((d) => BigInt(d.inventoryid)).filter(Boolean);
      const inventories = await prisma.m_inventory.findMany({
        where: { id: { in: inventoryIds } },
        select: { id: true, barcode: true, inventoryno: true, inventoryname: true, price: true, stokupdate: true },
      });

      const invMap = new Map(inventories.map((inv) => [Number(inv.id), inv]));

      const items = details.map((d) => {
        const matched = invMap.get(d.inventoryid);
        const sysQty = Number(d.systemqty ?? matched?.stokupdate ?? 0);
        const physQty = Number(d.physicalqty ?? 0);
        const diffQty = Number(d.differenceqty ?? (physQty - sysQty));

        return {
          id: String(d.id),
          inventoryId: d.inventoryid,
          barcode: matched?.barcode || d.barcode || '',
          inventoryNo: matched?.inventoryno || '',
          inventory_no: matched?.inventoryno || '',
          inventoryName: matched?.inventoryname || '',
          inventory_name: matched?.inventoryname || '',
          systemQty: sysQty,
          system_qty: sysQty,
          physicalQty: physQty,
          physical_qty: physQty,
          diffQty: diffQty,
          diff_qty: diffQty,
          qty: physQty,
          price: Number(d.unitprice || matched?.price || 0),
          notes: d.notes || '',
          description: diffQty === 0 ? 'Sesuai (Klop)' : diffQty > 0 ? `Surplus (+${diffQty})` : `Defisit (${diffQty})`,
        };
      });

      return apiSuccess({
        noTransaction: noTx,
        no_tx: noTx,
        opnameNo: noTx,
        date: header?.opnamedate || new Date(),
        status: header?.status || 'POSTED',
        notes: header?.notes || '',
        createdUser: header?.createduser || 'system',
        postedUser: header?.posteduser,
        postedDate: header?.posteddate,
        reversedUser: header?.reverseduser,
        reversedDate: header?.reverseddate,
        reversedReason: header?.reversedreason,
        whName: 'Gudang Utama',
        items,
      });
    }

    // Query opname headers list
    const where: any = {};
    if (q) {
      where.notransaction = { contains: q, mode: 'insensitive' };
    }
    if (statusFilter && statusFilter !== 'ALL') {
      where.status = statusFilter;
    }

    const [headers, total] = await Promise.all([
      prisma.t_opnameheader.findMany({
        where,
        orderBy: { opnamedate: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
      prisma.t_opnameheader.count({ where }),
    ]);

    // If no headers in t_opnameheader yet, fallback to legacy grouping
    if (total === 0 && !statusFilter) {
      const legacyWhere = q ? { notransaction: { contains: q, mode: 'insensitive' as const } } : undefined;
      const groups = await prisma.t_opname.groupBy({
        by: ['notransaction', 'opnamedate', 'createddate'],
        where: legacyWhere,
        _count: { inventoryid: true },
        orderBy: { createddate: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      });

      const totalGroups = await prisma.t_opname.groupBy({
        by: ['notransaction'],
        where: legacyWhere,
      });

      const mapped = groups.map((g, i) => ({
        id: String(i),
        noTransaction: g.notransaction,
        opname_no: g.notransaction,
        opnameNo: g.notransaction,
        opnameDate: g.opnamedate || g.createddate,
        opname_date: g.opnamedate || g.createddate,
        status: 'POSTED',
        whName: 'Gudang Utama',
        totalItems: g._count.inventoryid,
        total_items: g._count.inventoryid,
        created_at: g.createddate,
      }));

      return createPaginatedResponse(mapped, totalGroups.length, paginationParams);
    }

    // Fetch item counts for headers
    const txNos = headers.map((h) => h.notransaction);
    const detailCounts = await prisma.t_opnamedetail.groupBy({
      by: ['notransaction'],
      where: { notransaction: { in: txNos } },
      _count: { inventoryid: true },
    });
    const countMap = new Map(detailCounts.map((dc) => [dc.notransaction, dc._count.inventoryid]));

    const mapped = headers.map((h) => ({
      id: String(h.id),
      noTransaction: h.notransaction,
      opname_no: h.notransaction,
      opnameNo: h.notransaction,
      opnameDate: h.opnamedate,
      opname_date: h.opnamedate,
      status: h.status,
      notes: h.notes,
      postedUser: h.posteduser,
      postedDate: h.posteddate,
      reversedUser: h.reverseduser,
      reversedDate: h.reverseddate,
      whName: 'Gudang Utama',
      wh_name: 'Gudang Utama',
      totalItems: countMap.get(h.notransaction) || 0,
      total_items: countMap.get(h.notransaction) || 0,
      created_at: h.createddate,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/inventory/opname:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Gagal memuat data opname', 500);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const actor = user?.username || 'system';
    const body = await req.json();
    const action = body.action || (body.isDraft ? 'draft' : 'post');
    const noTx = body.no_tx || body.noTransaction || body.opnameNo || `OPN-${Date.now()}`;
    const idempotencyKey = body.idempotencyKey || req.headers.get('x-idempotency-key') || undefined;

    // Handle reversal
    if (action === 'reverse') {
      const auth = await requireCapability('OPNAME_REVERSE');
      if ('errorResponse' in auth) return auth.errorResponse;

      if (!body.reason) {
        return apiError('VALIDATION_ERROR', 'Alasan pembatalan opname (reversal) wajib diisi.', 400);
      }

      const result = await reverseOpnameTransaction({
        noTransaction: noTx,
        reason: body.reason,
        actor,
        idempotencyKey,
      });

      return apiSuccess(result, `Opname ${noTx} berhasil dibatalkan (reversed).`);
    }

    // Handle post or draft
    if (action === 'post') {
      const auth = await requireCapability('OPNAME_POST');
      if ('errorResponse' in auth) return auth.errorResponse;
    }

    let items = body.items;
    // Support single-item payload
    if (!items && body.inventoryId !== undefined) {
      const inv = await prisma.m_inventory.findUnique({ where: { id: Number(body.inventoryId) } });
      if (inv) {
        const physQty = Number(body.qtyOpname ?? body.qty ?? body.physicalQty ?? inv.stokupdate);
        items = [{
          inventoryId: inv.id,
          barcode: inv.barcode || '',
          systemQty: Number(inv.stokupdate || 0),
          physicalQty: physQty,
          unitPrice: Number(inv.hpp || inv.price || 0),
        }];
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiError('VALIDATION_ERROR', 'Detail barang opname wajib diisi.', 400);
    }

    const result = await saveOpnameTransaction({
      noTransaction: noTx,
      date: body.date || body.opnameDate,
      whId: body.whId || 1,
      notes: body.notes || '',
      items: items.map((it: any) => ({
        inventoryId: Number(it.inventoryId || it.id),
        barcode: it.barcode,
        systemQty: it.systemQty !== undefined ? Number(it.systemQty) : undefined,
        physicalQty: Number(it.qty ?? it.physicalQty ?? 0),
        unitPrice: it.price !== undefined ? Number(it.price) : undefined,
        notes: it.notes || it.description || '',
      })),
      actor,
      action: action === 'post' ? 'post' : 'draft',
      idempotencyKey,
    });

    const msg = action === 'post'
      ? `Stock Opname ${noTx} berhasil diposting & pergerakan stok telah dicatat.`
      : `Draft Stock Opname ${noTx} berhasil disimpan.`;

    return apiSuccess(result, msg);
  } catch (error: any) {
    console.error('Error in POST /api/inventory/opname:', error);
    return apiError('BAD_REQUEST', error.message || 'Gagal menyimpan opname', 400);
  }
}
