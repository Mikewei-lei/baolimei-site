import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { and, eq, inArray, lt } from 'drizzle-orm';
import { getDb, getPool } from '@/lib/server/db';
import { assets, users } from '@/lib/server/schema';
import { deleteObject } from '@/lib/server/storage';

const RETENTION_DAYS = Number(process.env.ACCOUNT_PURGE_DAYS || 30);

async function main() {
  const db = getDb();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const oldUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.status, 'deleted'), lt(users.deletedAt, cutoff)));
  if (!oldUsers.length) {
    console.log('[purge] no accounts past retention window');
    process.exit(0);
  }
  const ids = oldUsers.map((u) => u.id);
  const oldAssets = await db
    .select({ id: assets.id, storageKey: assets.storageKey })
    .from(assets)
    .where(inArray(assets.ownerId, ids));
  for (const asset of oldAssets) {
    await deleteObject(asset.storageKey);
  }
  for (const id of ids) {
    await db.delete(users).where(eq(users.id, id));
  }
  console.log(`[purge] removed ${ids.length} accounts and ${oldAssets.length} objects`);
  await getPool().end();
}

main().catch((err) => {
  console.error('[purge] failed:', err);
  process.exit(1);
});
