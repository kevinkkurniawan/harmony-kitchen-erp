import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';
import { requireCapability } from '@/lib/capabilities';
import { recordAuditEvent } from '@/lib/audit-event';

export async function POST(req: Request) {
  try {
    const auth = await requireCapability('BARCODE_PRINT');
    if ('errorResponse' in auth) return auth.errorResponse;
    const actor = auth.user.username || 'system';

    const body = await req.json();
    const { items, totalLabels, labelSize, includePrice } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return apiError('VALIDATION_ERROR', 'Daftar item cetak barcode tidak boleh kosong.', 400);
    }

    await recordAuditEvent({
      actor,
      eventType: 'BARCODE_PRINT',
      entityType: 'INVENTORY_BARCODE',
      entityId: `PRINT-${Date.now()}`,
      afterData: {
        itemCount: items.length,
        totalLabels: totalLabels || items.reduce((sum: number, it: any) => sum + (Number(it.printQty) || 1), 0),
        labelSize: labelSize || '50x30',
        includePrice: Boolean(includePrice),
        items: items.map((it: any) => ({
          id: it.product?.id,
          barcode: it.product?.barcode,
          name: it.product?.inventoryName || it.product?.inventory_name,
          qty: it.printQty,
        })),
      },
      reason: 'Cetak label barcode thermal',
    });

    return apiSuccess({ message: 'Audit cetak barcode berhasil dicatat.' });
  } catch (error: any) {
    console.error('Error in barcode print audit:', error);
    return apiError('INTERNAL_ERROR', error.message || 'Gagal memproses cetak barcode', 500);
  }
}
