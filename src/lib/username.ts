/**
 * Prisma filter matching a username exactly, ignoring case.
 * Prisma runs `mode: 'insensitive'` as ILIKE, where % and _ are wildcards: unescaped, a login
 * with username "%" would match every user, so they (and the escape character) are escaped.
 */
export function usernameEquals(input: string) {
  return { equals: input.trim().replace(/[\\%_]/g, '\\$&'), mode: 'insensitive' as const };
}
