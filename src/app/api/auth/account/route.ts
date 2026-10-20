import { eq } from 'drizzle-orm';
import { api, ok, parseJson, ApiError } from '@/lib/server/http';
import { deleteAccountSchema } from '@/lib/server/validation';
import { getDb } from '@/lib/server/db';
import { users } from '@/lib/server/schema';
import { clearSessionCookies, softDeleteAccount } from '@/lib/server/auth';
import { verifyPassword } from '@/lib/server/crypto';
import { audit } from '@/lib/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = api(
  async (req, _ctx, auth) => {
    const input = await parseJson(req, deleteAccountSchema);
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, auth!.user.id)).limit(1);
    const user = rows[0];
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', '请先登录');
    if (user.passwordHash) {
      if (!input.password) throw new ApiError(400, 'PASSWORD_REQUIRED', '请输入密码确认注销');
      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) throw new ApiError(401, 'PASSWORD_INCORRECT', '密码不正确');
    }
    await softDeleteAccount(user.id);
    const response = ok({
      deleted: true,
      retention: '账户数据立即停用，备份中的副本按 30 天保留策略轮换。',
    });
    clearSessionCookies(response);
    await audit({
      actorId: null,
      action: 'auth.account.delete',
      targetType: 'user',
      targetId: user.id,
      metadata: { softDeleted: true },
    });
    return response;
  },
  { auth: true, csrf: true }
);
