import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { validateWholesaleThresholds } from '@/lib/wholesale-rules';
import { requireCapability } from '@/lib/capabilities';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const catId = Number(id);
    if (!catId) return apiError('BAD_REQUEST', 'ID Kategori tidak valid', 400);

    const category = await prisma.m_wholesalecategory.findUnique({
      where: { id: catId },
    });
    if (!category) return apiError('NOT_FOUND', 'Kategori grosir tidak ditemukan', 404);

    return apiSuccess(category);
  } catch (err: any) {
    return apiError('INTERNAL_ERROR', err.message, 500);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const catId = Number(id);
    if (!catId) return apiError('BAD_REQUEST', 'ID Kategori tidak valid', 400);

    const auth = await requireCapability('INVENTORY_EDIT');
    if ('errorResponse' in auth) return auth.errorResponse;
    const actor = auth.user.username || 'system';

    const body = await req.json();

    const existing = await prisma.m_wholesalecategory.findUnique({
      where: { id: catId },
    });
    if (!existing) return apiError('NOT_FOUND', 'Kategori grosir tidak ditemukan', 404);

    const t1 = body.tier1_minqty !== undefined ? Number(body.tier1_minqty) : existing.tier1_minqty;
    const t2 = body.tier2_minqty !== undefined ? Number(body.tier2_minqty) : existing.tier2_minqty;
    const t3 = body.tier3_minqty !== undefined ? Number(body.tier3_minqty) : existing.tier3_minqty;

    const validationErr = validateWholesaleThresholds(t1, t2, t3);
    if (validationErr) {
      return apiError('VALIDATION_ERROR', validationErr, 400);
    }

    const updated = await prisma.m_wholesalecategory.update({
      where: { id: catId },
      data: {
        code: body.code !== undefined ? body.code.trim() : existing.code,
        name: body.name !== undefined ? body.name.trim() : existing.name,
        description: body.description !== undefined ? body.description?.trim() : existing.description,
        isactive: body.isactive !== undefined ? Boolean(body.isactive) : existing.isactive,
        version: { increment: 1 },
        tier1_minqty: t1,
        tier2_minqty: t2,
        tier3_minqty: t3,
        modifieduser: actor,
        modifieddate: new Date(),
      },
    });

    return apiSuccess(updated, 'Kategori grosir berhasil diperbarui.');
  } catch (err: any) {
    console.error('Error updating wholesale category:', err);
    return apiError('BAD_REQUEST', err.message || 'Gagal memperbarui kategori grosir', 400);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const catId = Number(id);
    if (!catId) return apiError('BAD_REQUEST', 'ID Kategori tidak valid', 400);

    const auth = await requireCapability('INVENTORY_EDIT');
    if ('errorResponse' in auth) return auth.errorResponse;

    const itemCount = await prisma.m_inventory.count({
      where: { wholesalecategoryid: catId },
    });
    if (itemCount > 0) {
      return apiError(
        'CONFLICT',
        `Kategori grosir ini sedang digunakan oleh ${itemCount} barang di Master Barang. Nonaktifkan kategori jika tidak ingin digunakan lagi.`,
        409
      );
    }

    await prisma.m_wholesalecategory.delete({
      where: { id: catId },
    });

    return apiSuccess(null, 'Kategori grosir berhasil dihapus.');
  } catch (err: any) {
    return apiError('BAD_REQUEST', err.message || 'Gagal menghapus kategori grosir', 400);
  }
}
