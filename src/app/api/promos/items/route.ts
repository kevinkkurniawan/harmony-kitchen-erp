import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPaginationParams, createPaginatedResponse } from '@/lib/pagination';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const onlyActive = searchParams.get('onlyActive') === 'true';
    const paginationParams = getPaginationParams(req, 50);

    const where: any = {};
    if (q) {
      where.promoname = { contains: q, mode: 'insensitive' as const };
    }
    if (onlyActive) {
      where.isactive = true;
    }

    const [total, promos] = await Promise.all([
      prisma.m_promo.count({ where }),
      prisma.m_promo.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: paginationParams.skip,
        take: paginationParams.limit,
      }),
    ]);

    const mapped = promos.map((p: any) => ({
      id: String(p.id),
      promoNo: `PRM-${p.id}`,
      promo_no: `PRM-${p.id}`,
      promoName: p.promoname,
      promo_name: p.promoname,
      groupId: 1,
      groupName: 'Promo Utama',
      group_name: 'Promo Utama',
      promoBundle: p.promobundle,
      promoGrosir: p.promogrosir,
      promoGrosirType: 'PERCENT',
      qtyMin: p.qtymin || 1,
      qtyMax: p.qtymax || 9999,
      isPartial: p.ispartial,
      isGroup: p.isgroup,
      description: p.description,
      discountPct: p.promopercentage ? Number(p.promopercentage) : 0,
      discount_pct: p.promopercentage ? Number(p.promopercentage) : 0,
      startDate: p.createddate,
      start_date: p.createddate,
      endDate: p.modifieddate,
      end_date: p.modifieddate,
      isActive: Boolean(p.isactive),
      is_active: Boolean(p.isactive),
      createdAt: p.createddate,
    }));

    return createPaginatedResponse(mapped, total, paginationParams);
  } catch (error: any) {
    console.error('Error in GET /api/promos/items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const promoName = (body.promoName || body.promo_name || '').trim();
    const qtyMin = Number(body.qtyMin ?? 1);
    const qtyMax = Number(body.qtyMax ?? 9999);
    const isPartial = body.isPartial ?? true;
    const isGroup = body.isGroup ?? true;
    const description = body.description;
    const isActive = body.isActive ?? body.is_active ?? true;

    if (!promoName) {
      return NextResponse.json({ success: false, error: 'Nama Promo wajib diisi' }, { status: 400 });
    }
    if (qtyMin > qtyMax) {
      return NextResponse.json({ success: false, error: 'Qty Minimum tidak boleh lebih besar dari Qty Maksimum' }, { status: 400 });
    }

    // Optional target: promoBundle joins an existing bundle (Add Promo), promoGrosir picks its tier 1-3.
    // Without them the old numbering stays: a new bundle and promogrosir = max + 1.
    const hasBundle = body.promoBundle !== undefined && body.promoBundle !== null && body.promoBundle !== '';
    const hasGrosir = body.promoGrosir !== undefined && body.promoGrosir !== null && body.promoGrosir !== '';
    const reqBundle = Number(body.promoBundle);
    const reqGrosir = Number(body.promoGrosir);
    if (hasGrosir && ![1, 2, 3].includes(reqGrosir)) {
      return NextResponse.json({ success: false, error: 'Promo Grosir harus 1, 2 atau 3' }, { status: 400 });
    }
    if (hasBundle && !(Number.isInteger(reqBundle) && reqBundle > 0)) {
      return NextResponse.json({ success: false, error: 'Promo Bundle tidak valid' }, { status: 400 });
    }
    if (hasBundle && !hasGrosir) {
      return NextResponse.json({ success: false, error: 'Pilih Promo Grosir untuk Promo Bundle ini' }, { status: 400 });
    }

    let bundleId: number;
    let grosirId: number;
    let name = promoName;
    if (hasBundle) {
      const bundleRows = await prisma.m_promo.findMany({
        where: { promobundle: reqBundle, isgroup: Boolean(isGroup) },
        select: { promogrosir: true, promoname: true },
      });
      if (bundleRows.length === 0) {
        return NextResponse.json({ success: false, error: `Promo Bundle ${reqBundle} tidak ditemukan` }, { status: 404 });
      }
      if (bundleRows.some((r) => r.promogrosir === reqGrosir)) {
        return NextResponse.json({ success: false, error: `Grosir ${reqGrosir} sudah ada di Promo Bundle ${reqBundle}` }, { status: 409 });
      }
      bundleId = reqBundle;
      grosirId = reqGrosir;
      // The grid groups by name, so a joined row keeps the bundle's name
      name = bundleRows[0].promoname || promoName;
    } else {
      const max = await prisma.m_promo.aggregate({ _max: { promobundle: true, promogrosir: true } });
      bundleId = (max._max.promobundle || 0) + 1;
      grosirId = hasGrosir ? reqGrosir : (max._max.promogrosir || 0) + 1;
    }

    // Strictly quantity-only model: prices remain in Master Barang, promo values/percentages are 0
    const created = await prisma.m_promo.create({
      data: {
        promobundle: bundleId,
        promogrosir: grosirId,
        promoname: name,
        promovalue: 0,
        promopercentage: 0,
        qtymin: Number(qtyMin || 1),
        qtymax: Number(qtyMax || 9999),
        ispartial: Boolean(isPartial),
        isgroup: Boolean(isGroup),
        description: description || null,
        isactive: Boolean(isActive),
        createduser: 'system',
        createddate: new Date(),
        modifieduser: 'system',
        modifieddate: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: 'Promo berhasil dibuat', data: created });
  } catch (error: any) {
    // Primary key (promobundle, promogrosir, ispartial, isgroup): a concurrent save took the same tier
    if (error?.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Promo Grosir ini sudah ada di Promo Bundle tersebut' }, { status: 409 });
    }
    console.error('Error in POST /api/promos/items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
