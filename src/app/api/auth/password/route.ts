import { and, eq, ne } from 'drizzle-orm';
import { api, ok, parseJson, ApiError } from '@/lib/server/http';
import { changePasswordSchema } from '@/lib/server/validation';
import { getDb } from '@/lib/server/db';
import { userSessions, users } from '@/lib/server/schema';
import { hashPassword, verifyPassword } from '@/lib/server/crypto';
import { audit } from '@/lib/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (req, _ctx, auth) => {
    const { currentPassword, newPassword } = await parseJson(req, changePasswordSchema);
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, auth!.user.id)).limit(1);
    const user = rows[0];
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', '请先登录');

    if (user.passwordHash) {
      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) throw new ApiError(401, 'PASSWORD_INCORRECT', '当前密码不正确');
    }
    const passwordHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessions.userId, user.id), ne(userSessions.id, auth!.session.id)));
    await audit({
      actorId: user.id,
      action: 'auth.password.change',
      targetType: 'user',
      targetId: user.id,
    });
    return ok({ changed: true, otherSessionsRevoked: true });
  },
  { auth: true, csrf: true }
);
