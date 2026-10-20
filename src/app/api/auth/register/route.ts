import { eq, isNull } from 'drizzle-orm';
import { api, ok, parseJson, clientIp, userAgent, ApiError } from '@/lib/server/http';
import { registerSchema } from '@/lib/server/validation';
import { getDb } from '@/lib/server/db';
import { users } from '@/lib/server/schema';
import { consumeChallenge, createSession, publicUser, setSessionCookies } from '@/lib/server/auth';
import { hashPassword } from '@/lib/server/crypto';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import { audit } from '@/lib/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (req) => {
    const { phone, code, name, password } = await parseJson(req, registerSchema);
    await enforceRateLimit(`register:ip:${clientIp(req)}`, 10, 60 * 60, '注册请求过于频繁');
    await enforceRateLimit(`register:phone:${phone}`, 5, 60 * 60, '该手机号注册请求过于频繁');

    const db = getDb();
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    if (existing.length) throw new ApiError(409, 'PHONE_EXISTS', '该手机号已注册，请直接登录');

    await consumeChallenge({ phone, purpose: 'register', code, req });
    const passwordHash = password ? await hashPassword(password) : null;

    let user;
    try {
      [user] = await db
        .insert(users)
        .values({ phone, name: name.trim().slice(0, 60), passwordHash })
        .returning();
    } catch {
      throw new ApiError(409, 'PHONE_EXISTS', '该手机号已注册，请直接登录');
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
      action: 'auth.register',
      targetType: 'user',
      targetId: user.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return response;
  },
  { auth: false, csrf: false }
);
