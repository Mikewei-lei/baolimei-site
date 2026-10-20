import { eq } from 'drizzle-orm';
import { api, ok } from '@/lib/server/http';
import { publicUser } from '@/lib/server/auth';
import { getDb } from '@/lib/server/db';
import { users } from '@/lib/server/schema';
import { assetUrl, getAssetForUser } from '@/lib/server/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (req) => {
    const { requireUser } = await import('@/lib/server/auth');
    let auth;
    try {
      auth = await requireUser(req);
    } catch {
      return ok({ user: null, session: null });
    }
    const rows = await getDb().select().from(users).where(eq(users.id, auth.user.id)).limit(1);
    const user = rows[0];
    if (!user) return ok({ user: null, session: null });
    let avatarUrl: string | null = null;
    if (user.avatarAssetId) {
      try {
        const asset = await getAssetForUser(user.id, user.avatarAssetId);
        avatarUrl = await assetUrl(asset);
      } catch {
        avatarUrl = null;
      }
    }
    return ok({
      user: { ...publicUser(user), avatarUrl },
      session: {
        id: auth.session.id,
        expiresAt: auth.session.expiresAt,
      },
    });
  },
  { auth: false, csrf: false }
);
