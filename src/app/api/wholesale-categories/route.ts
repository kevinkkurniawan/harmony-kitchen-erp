import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateWholesaleThresholds } from '@/lib/wholesale-rules';
import { requireCapability } from '@/lib/capabilities';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const where: any = {};
    if (activeOnly) {
      where.isactive = true;
    }

    const categories = await prisma.m_wholesalecategory.findMany({
      where,
      orderBy: { id: 'asc' },
    });

    return apiSuccess(categories);
  } catch (err: any) {
    console.error('Error fetching wholesale categories:', err);
    return apiError('INTERNAL_ERROR', err.message || 'Gagal memuat kategori grosir', 500);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireCapability('INVENTORY_EDIT');
    if ('errorResponse' in auth) return auth.errorResponse;
    const actor = auth.user.username || 'system';

    const body = await req.json();
    const { code, name, description, tier1_minqty, tier2_minqty, tier3_minqty, isactive } = body;

    if (!code || !name) {
      return apiError('VALIDATION_ERROR', 'Kode dan Nama Kategori Grosir wajib diisi.', 400);
    }

    const t1 = Number(tier1_minqty) || 0;
    const t2 = Number(tier2_minqty) || 0;
    const t3 = Number(tier3_minqty) || 0;

    const validationErr = validateWholesaleThresholds(t1, t2, t3);
    if (validationErr) {
      return apiError('VALIDATION_ERROR', validationErr, 400);
    }

    // Check code uniqueness
    const existing = await prisma.m_wholesalecategory.findUnique({
      where: { code: code.trim() },
    });
    if (existing) {
      return apiError('CONFLICT', `Kategori grosir dengan kode "${code}" sudah ada.`, 409);
    }

    const created = await prisma.m_wholesalecategory.create({
      data: {
        code: code.trim(),
        name: name.trim(),
        description: description?.trim() || null,
        isactive: isactive !== undefined ? Boolean(isactive) : true,
        version: 1,
        tier1_minqty: t1,
        tier2_minqty: t2,
        tier3_minqty: t3,
        createduser: actor,
        modifieduser: actor,
      },
    });

    return apiSuccess(created, 'Kategori grosir berhasil dibuat.', 201);
  } catch (err: any) {
    console.error('Error creating wholesale category:', err);
    return apiError('BAD_REQUEST', err.message || 'Gagal membuat kategori grosir', 400);
  }
}
