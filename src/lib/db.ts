import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma_v2: PrismaClient | undefined;
};

function getDatasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    // Local Postgres has no pooler: use the URL as-is
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return raw;
    // Supabase session mode (5432) caps the whole project at pool_size clients (EMAXCONNSESSION).
    // Transaction mode (6543) multiplexes clients, which serverless instances need.
    if (url.port === '5432' && url.hostname.endsWith('pooler.supabase.com')) {
      url.port = '6543';
    }
    if (url.port === '6543' && !url.searchParams.has('pgbouncer')) {
      url.searchParams.set('pgbouncer', 'true');
    }
    // Keep each instance small: many instances (ERP + POS) share one pooler
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '5');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '30');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export const prisma =
  globalForPrisma.prisma_v2 ??
  new PrismaClient({
    datasourceUrl: getDatasourceUrl(),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma_v2 = prisma;

(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};


