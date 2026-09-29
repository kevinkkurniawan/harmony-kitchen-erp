import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const id = Number(params.id);

    const promo = await prisma.m_promo.findFirst({
      where: { id },
    });

    if (!promo) {
      return apiError('NOT_FOUND', 'Promo item tidak ditemukan', 404);
    }

    return apiSuccess({
      id: String(promo.id),
      promoNo: `PRM-${promo.id}`,
      promoName: promo.promoname,
      qtyMin: promo.qtymin || 1,
      qtyMax: promo.qtymax || 9999,
      isPartial: promo.ispartial,
      isGroup: promo.isgroup,
      description: promo.description,
      isActive: promo.isactive,
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
    const body = await request.json();

    const existing = await prisma.m_promo.findFirst({
      where: { id },
    });

    if (!existing) {
      return apiError('NOT_FOUND', 'Promo item tidak ditemukan', 404);
    }

    const dataToUpdate: any = {
      modifieddate: new Date(),
    };

    if (body.promoName !== undefined || body.promo_name !== undefined) {
      dataToUpdate.promoname = body.promoName || body.promo_name;
    }
    if (body.qtyMin !== undefined) dataToUpdate.qtymin = Number(body.qtyMin);
    if (body.qtyMax !== undefined) dataToUpdate.qtymax = Number(body.qtyMax);
    if (body.isPartial !== undefined) dataToUpdate.ispartial = Boolean(body.isPartial);
    if (body.isGroup !== undefined) dataToUpdate.isgroup = Boolean(body.isGroup);
    if (body.description !== undefined) dataToUpdate.description = body.description || null;
    if (body.isActive !== undefined || body.is_active !== undefined) {
      dataToUpdate.isactive = Boolean(body.isActive ?? body.is_active);
    }

    // Force values and percentages to 0 in quantity-only model
    dataToUpdate.promovalue = 0;
    dataToUpdate.promopercentage = 0;

    await prisma.m_promo.updateMany({
      where: { id },
      data: dataToUpdate,
    });

    const updated = await prisma.m_promo.findFirst({ where: { id } });
    return apiSuccess(updated, 'Aturan promo berhasil diperbarui');
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

    const existing = await prisma.m_promo.findFirst({
      where: { id },
    });

    if (!existing) {
      return apiError('NOT_FOUND', 'Promo item tidak ditemukan', 404);
    }

    await prisma.m_promo.deleteMany({
      where: { id },
    });

    return apiSuccess({ id }, 'Aturan promo berhasil dihapus');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return apiError('INTERNAL_ERROR', message, 500);
  }
}
