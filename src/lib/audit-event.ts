import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface AuditEventParams {
  eventType: string;
  entityType: string;
  entityId: string;
  actor: string;
  reason?: string | null;
  beforeData?: any;
  afterData?: any;
  idempotencyKey?: string | null;
}

export async function recordAuditEvent(params: AuditEventParams, tx?: Prisma.TransactionClient) {
  const client = tx || prisma;

  if (params.idempotencyKey) {
    const existing = await client.t_auditevent.findUnique({
      where: { idempotencykey: params.idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  return client.t_auditevent.create({
    data: {
      eventtype: params.eventType,
      entitytype: params.entityType,
      entityid: params.entityId,
      actor: params.actor,
      reason: params.reason,
      beforedata: params.beforeData ? (params.beforeData as Prisma.InputJsonValue) : Prisma.JsonNull,
      afterdata: params.afterData ? (params.afterData as Prisma.InputJsonValue) : Prisma.JsonNull,
      idempotencykey: params.idempotencyKey,
    },
  });
}
