import { resolveUserLevel } from '@/lib/session';

interface UserTypeRow {
  username: string | null;
  positionname: string | null;
}

// Why a User Type change or rename must be refused, or null when it is allowed. Only a change that takes Admin
// away is checked (renaming "admin" does too): never from your own account, never from the last Admin
// (`others` = every other user).
export function userTypeChangeError(
  target: { id: number; username: string | null; userType: string | null },
  newUserType: string | null,
  actorId: number,
  others: UserTypeRow[],
  newUsername: string | null = target.username,
): string | null {
  const wasAdmin = resolveUserLevel(target.username, target.userType) === 'Admin';
  const staysAdmin = resolveUserLevel(newUsername, newUserType) === 'Admin';
  if (!wasAdmin || staysAdmin) return null;
  if (target.id === actorId) {
    return newUserType === target.userType
      ? 'Tidak dapat mengganti username akun Anda sendiri: akun ini akan kehilangan hak Admin.'
      : 'Tidak dapat menurunkan User Type akun Anda sendiri.';
  }
  if (!others.some((o) => resolveUserLevel(o.username, o.positionname) === 'Admin')) {
    return 'Tidak dapat mengubah User Type: harus ada minimal satu Admin.';
  }
  return null;
}
