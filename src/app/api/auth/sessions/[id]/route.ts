import { and, eq } from 'drizzle-orm';
import { api, ok, ApiError } from '@/lib/server/http';
import { getDb } from '@/lib/server/db';
import { userSessions } from '@/lib/server/schema';
import { clearSessionCookies, revokeSession } from '@/lib/server/auth';
import { audit } from '@/lib/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = api(
  async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    const rows = await getDb()
      .select({ id: userSessions.id })
      .from(userSessions)
      .where(and(eq(userSessions.id, id), eq(userSessions.userId, auth!.user.id)))
      .limit(1);
    if (!rows[0]) throw new ApiError(404, 'SESSION_NOT_FOUND', '会话不存在');
    await revokeSession(id);
    const response = ok({ revoked: id, current: id === auth!.session.id });
    if (id === auth!.session.id) clearSessionCookies(response);
    await audit({
      actorId: auth!.user.id,
      action: 'auth.session.revoke',
      targetType: 'session',
      targetId: id,
    });
    return response;
  },
  { auth: true, csrf: true }
);
