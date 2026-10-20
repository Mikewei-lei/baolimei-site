import { and, eq, isNull } from 'drizzle-orm';
import { api, ok, parseJson, clientIp } from '@/lib/server/http';
import { requestCodeSchema } from '@/lib/server/validation';
import { getDb } from '@/lib/server/db';
import { users } from '@/lib/server/schema';
import { issueChallenge } from '@/lib/server/auth';
import { enforceRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (req) => {
    const { phone, purpose } = await parseJson(req, requestCodeSchema);
    const ip = clientIp(req);
    await enforceRateLimit(`code:ip:${ip}`, 12, 10 * 60, '验证码请求过于频繁，请稍后再试');
    await enforceRateLimit(`code:phone:${phone}`, 5, 10 * 60, '该手机号请求过于频繁，请稍后再试');
    await enforceRateLimit(`code:cooldown:${phone}`, 1, 60, '验证码已发送，请 60 秒后再试');

    const existing = await getDb()
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(and(eq(users.phone, phone), isNull(users.deletedAt)))
      .limit(1);

    if (purpose === 'register' && existing.length) {
      return ok({ exists: true, message: '该手机号已注册，请直接登录' });
    }
    if (purpose !== 'register' && !existing.length) {
      return ok({ exists: false, message: '该手机号尚未注册' });
    }

    const result = await issueChallenge({ phone, purpose, req });
    return ok({ ...result, exists: purpose === 'register' ? false : true });
  },
  { auth: false, csrf: false }
);
