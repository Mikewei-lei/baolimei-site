import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { serverEnv } from './env';

type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __blmPool?: Pool;
  __blmDb?: Db;
};

export function getPool(): Pool {
  if (!globalForDb.__blmPool) {
    const pool = new Pool({
      connectionString: serverEnv.databaseUrl,
      max: Number(process.env.DATABASE_POOL_MAX || 8),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', (err) => {
      console.error('[db] pool error:', err.message);
    });
    globalForDb.__blmPool = pool;
  }
  return globalForDb.__blmPool;
}

export function getDb(): Db {
  if (!globalForDb.__blmDb) {
    globalForDb.__blmDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__blmDb;
}

export { schema };
