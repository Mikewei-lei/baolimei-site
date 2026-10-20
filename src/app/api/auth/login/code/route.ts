import { api, ok, parseJson, clientIp, userAgent, ApiError } from '@/lib/server/http';
import { loginCodeSchema } from '@/lib/server/validation';
import { getDb } from '@/lib/server/db';
import { users } from '@/lib/server/schema';
import { consumeChallenge, createSession, publicUser, setSessionCookies } from '@/lib/server/auth';
import { normalizePhone } from '@/lib/server/crypto';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { audit } from '@/lib/server/audit';
import { eq, isNull, and } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (req) => {
    const { phone: rawPhone, code } = await parseJson(req, loginCodeSchema);
    const phone = normalizePhone(rawPhone);
    await enforceRateLimit(`login-code:ip:${clientIp(req)}`, 20, 10 * 60, '登录请求过于频繁');
    await enforceRateLimit(`login-code:phone:${phone}`, 10, 10 * 60, '该手机号登录过于频繁');

    await consumeChallenge({ phone, purpose: 'login', code, req });
    const db = getDb();
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.phone, phone), isNull(users.deletedAt)))
      .limit(1);
    const user = rows[0];
    if (!user) throw new ApiError(404, 'USER_NOT_FOUND', '该手机号尚未注册');
    if (user.status !== 'active') throw new ApiError(403, 'ACCOUNT_DISABLED', '账户已被停用');

    const session = await createSession(user.id, req);
    const response = ok({
      user: publicUser(user),
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt.toISOString(),
    });
    setSessionCookies(response, session);
    await audit({
      actorId: user.id,
      action: 'auth.login.code',
      targetType: 'user',
      targetId: user.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return response;
  },
  { auth: false, csrf: false }
);
