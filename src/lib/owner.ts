// Client rule (Luki, 23 Nov): only the owner login "admin" may change stock (opname, sync, reset) or touch
// that account. Other Admins (User Type "Admin", e.g. Siti) keep every other Admin right.
export const OWNER_USERNAME = 'admin';

export function isOwnerUsername(username: string | null | undefined): boolean {
  return (username || '').trim().toLowerCase() === OWNER_USERNAME;
}
