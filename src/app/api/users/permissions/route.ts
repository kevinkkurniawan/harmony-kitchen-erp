import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { getPermissionsForUser, savePermissions, StoredPermission } from '@/lib/erp-permissions';
import { SENSITIVE_CAPABILITIES, getUserCapabilities } from '@/lib/capabilities';
import { recordAuditEvent } from '@/lib/audit-event';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ success: false, error: 'Login diperlukan.' }, { status: 401 });
  const requestedUserId = Number(new URL(request.url).searchParams.get('userId') || currentUser.id);
  if (requestedUserId !== currentUser.id && currentUser.userLevel !== 'Admin') {
    return NextResponse.json({ success: false, error: 'Tidak memiliki akses untuk melihat hak akses user lain.' }, { status: 403 });
  }

  const subject = requestedUserId === currentUser.id ? currentUser : { ...currentUser, id: requestedUserId, userLevel: 'Staff' as const };
  const data = await getPermissionsForUser(subject);
  const capabilities = await getUserCapabilities(requestedUserId);

  return NextResponse.json({
    success: true,
    data,
    items: data,
    capabilities,
    capabilityCatalog: SENSITIVE_CAPABILITIES,
  });
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.userLevel !== 'Admin') {
    return NextResponse.json({ success: false, error: 'Hanya Admin yang dapat mengubah hak akses.' }, { status: 403 });
  }
  const body = await request.json();
  const userId = Number(body.userId);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ success: false, error: 'User ID tidak valid.' }, { status: 400 });
  }

  try {
    if (Array.isArray(body.permissions)) {
      await savePermissions(userId, body.permissions as StoredPermission[]);
    }

    if (body.capabilities && typeof body.capabilities === 'object') {
      const beforeCapabilities = await getUserCapabilities(userId);
      const afterCapabilities: Record<string, boolean> = {};

      for (const cap of SENSITIVE_CAPABILITIES) {
        if (cap.code in body.capabilities) {
          const isGranted = Boolean(body.capabilities[cap.code]);
          afterCapabilities[cap.code] = isGranted;

          await prisma.t_usercapability.upsert({
            where: {
              userid_capabilitycode: {
                userid: userId,
                capabilitycode: cap.code,
              },
            },
            update: {
              isgranted: isGranted,
              grantedby: currentUser.username,
              granteddate: new Date(),
            },
            create: {
              userid: userId,
              capabilitycode: cap.code,
              isgranted: isGranted,
              grantedby: currentUser.username,
            },
          });
        }
      }

      await recordAuditEvent({
        eventType: 'PERMISSION_CHANGE',
        entityType: 'USER_CAPABILITY',
        entityId: String(userId),
        actor: currentUser.username,
        reason: body.reason || 'Perubahan hak akses kapabilitas oleh Administrator',
        beforeData: beforeCapabilities,
        afterData: afterCapabilities,
      });
    }

    return NextResponse.json({ success: true, message: 'Hak akses berhasil disimpan.' });
  } catch (err: any) {
    console.error('Failed to save permissions/capabilities:', err);
    return NextResponse.json({ success: false, error: err.message || 'Gagal menyimpan hak akses.' }, { status: 500 });
  }
}

export async function PUT() {
  return NextResponse.json({ success: true, data: [] });
}

export async function DELETE() {
  return NextResponse.json({ success: true });
}

