import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const id = Number(params.id);
    if (!id) return apiError('BAD_REQUEST', 'ID Kelompok Promo tidak valid', 400);

    const promo = await prisma.m_promo.findFirst({ where: { id } });
    if (!promo) return apiError('NOT_FOUND', 'Kelompok promo tidak ditemukan', 404);

    return apiSuccess({
      id: String(promo.id),
      promoCode: `PRM-${promo.id}`,
      promoName: promo.promoname,
      groupName: promo.promoname,
      group_name: promo.promoname,
      description: promo.description,
      isActive: Boolean(promo.isactive),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', message, 500);
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const id = Number(params.id);
    if (!id) return apiError('BAD_REQUEST', 'ID Kelompok Promo tidak valid', 400);

    const body = await request.json();
    const existing = await prisma.m_promo.findFirst({ where: { id } });
    if (!existing) return apiError('NOT_FOUND', 'Kelompok promo tidak ditemukan', 404);

    const dataToUpdate: any = {
      modifieddate: new Date(),
    };
    const nextName = body.promoName ?? body.groupName ?? body.group_name;
    if (nextName !== undefined) {
      dataToUpdate.promoname = String(nextName).trim();
    }
    if (body.description !== undefined) {
      dataToUpdate.description = body.description || null;
    }
    if (body.isActive !== undefined || body.is_active !== undefined) {
      dataToUpdate.isactive = Boolean(body.isActive ?? body.is_active);
    }

    await prisma.m_promo.updateMany({
      where: { id },
      data: dataToUpdate,
    });

    const updated = await prisma.m_promo.findFirst({ where: { id } });
    return apiSuccess(updated, 'Kelompok promo berhasil diperbarui');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', message, 500);
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const id = Number(params.id);
    if (!id) return apiError('BAD_REQUEST', 'ID Kelompok Promo tidak valid', 400);

    const existing = await prisma.m_promo.findFirst({ where: { id } });
    if (!existing) return apiError('NOT_FOUND', 'Kelompok promo tidak ditemukan', 404);

    await prisma.m_promo.deleteMany({ where: { id } });
    return apiSuccess({ id }, 'Kelompok promo berhasil dihapus');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', message, 500);
  }
}
