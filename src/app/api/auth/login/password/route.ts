import { and, eq, isNull } from 'drizzle-orm';
import { api, ok, parseJson, clientIp, userAgent, ApiError } from '@/lib/server/http';
import { loginPasswordSchema } from '@/lib/server/validation';
import { getDb } from '@/lib/server/db';
import { users } from '@/lib/server/schema';
import { createSession, publicUser, setSessionCookies } from '@/lib/server/auth';
import { normalizePhone, verifyPassword } from '@/lib/server/crypto';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { audit } from '@/lib/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (req) => {
    const { phone: rawPhone, password } = await parseJson(req, loginPasswordSchema);
    const phone = normalizePhone(rawPhone);
    await enforceRateLimit(`login-pw:ip:${clientIp(req)}`, 20, 10 * 60, '登录请求过于频繁');
    await enforceRateLimit(`login-pw:phone:${phone}`, 8, 10 * 60, '该手机号登录尝试过多');

    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.phone, phone), isNull(users.deletedAt)))
      .limit(1);
    const user = rows[0];
    if (!user) throw new ApiError(401, 'LOGIN_FAILED', '手机号或密码不正确');
    if (user.status !== 'active') throw new ApiError(403, 'ACCOUNT_DISABLED', '账户已被停用');
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await audit({
        action: 'auth.login.password_failed',
        targetType: 'user',
        targetId: user.id,
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
      throw new ApiError(401, 'LOGIN_FAILED', '手机号或密码不正确');
    }

    const session = await createSession(user.id, req);
    const response = ok({
      user: publicUser(user),
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt.toISOString(),
    });
    setSessionCookies(response, session);
    await audit({
      actorId: user.id,
      action: 'auth.login.password',
      targetType: 'user',
      targetId: user.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return response;
  },
  { auth: false, csrf: false }
);
