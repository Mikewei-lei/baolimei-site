import type { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { getDb } from './db';
import { assets, projects, userSessions, users, verificationChallenges } from './schema';
import { ApiError, clientIp, userAgent } from './http';
import { hmacSha256, randomCode, randomToken, safeEqual, sha256 } from './crypto';
import { serverEnv } from './env';
import { sendVerificationSms } from './sms';
import { audit } from './audit';

export const SESSION_COOKIE = 'blm_session';
export const CSRF_COOKIE = 'blm_csrf';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type PublicUser = {
  id: string;
  phone: string;
  name: string | null;
  avatarAssetId: string | null;
  role: string;
  status: string;
  createdAt: Date;
};

export function publicUser(user: typeof users.$inferSelect): PublicUser {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    avatarAssetId: user.avatarAssetId,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

function codeHash(phone: string, purpose: string, code: string) {
  return hmacSha256(serverEnv.authSecret, `${phone}:${purpose}:${code}`);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: serverEnv.cookieSecure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function setSessionCookies(
  response: NextResponse,
  session: { token: string; csrfToken: string; expiresAt: Date }
) {
  const maxAge = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000));
  response.cookies.set(SESSION_COOKIE, session.token, cookieOptions(maxAge));
  response.cookies.set(CSRF_COOKIE, session.csrfToken, {
    ...cookieOptions(maxAge),
    httpOnly: false,
  });
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  response.cookies.set(CSRF_COOKIE, '', { ...cookieOptions(0), httpOnly: false });
}

export async function createSession(userId: string, req: NextRequest) {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const db = getDb();
  const [session] = await db
    .insert(userSessions)
    .values({
      userId,
      tokenHash: sha256(token),
      csrfHash: sha256(csrfToken),
      userAgent: userAgent(req),
      ip: clientIp(req),
      expiresAt,
    })
    .returning({ id: userSessions.id });
  await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
  return { id: session.id, token, csrfToken, expiresAt };
}

export async function refreshSession(sessionId: string) {
  const token = randomToken(32);
  const csrfToken = randomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await getDb()
    .update(userSessions)
    .set({
      tokenHash: sha256(token),
      csrfHash: sha256(csrfToken),
      lastUsedAt: new Date(),
      expiresAt,
    })
    .where(and(eq(userSessions.id, sessionId), isNull(userSessions.revokedAt)));
  return { token, csrfToken, expiresAt };
}

export async function revokeSession(sessionId: string) {
  await getDb()
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(eq(userSessions.id, sessionId));
}

export async function revokeAllSessions(userId: string) {
  await getDb()
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
}

export async function requireUser(req: NextRequest, options: { csrf?: boolean } = {}) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) throw new ApiError(401, 'UNAUTHENTICATED', '请先登录');

  const db = getDb();
  const rows = await db
    .select({ session: userSessions, user: users })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(
      and(
        eq(userSessions.tokenHash, sha256(token)),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, new Date()),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) throw new ApiError(401, 'SESSION_INVALID', '登录已失效，请重新登录');
  if (row.user.status !== 'active') throw new ApiError(403, 'ACCOUNT_DISABLED', '账户已被停用');

  if (options.csrf) {
    const header = req.headers.get('x-csrf-token') || '';
    if (!header || !safeEqual(sha256(header), row.session.csrfHash)) {
      throw new ApiError(403, 'CSRF_INVALID', 'CSRF 校验失败，请刷新页面后重试');
    }
  }

  if (Date.now() - new Date(row.session.lastUsedAt).getTime() > 5 * 60 * 1000) {
    db.update(userSessions)
      .set({ lastUsedAt: new Date() })
      .where(eq(userSessions.id, row.session.id))
      .catch(() => undefined);
  }

  return { user: row.user, session: row.session };
}

export async function issueChallenge(input: {
  phone: string;
  purpose: 'register' | 'login' | 'reset';
  req: NextRequest;
}) {
  const { phone, purpose, req } = input;
  const db = getDb();
  const code = randomCode();
  const ip = clientIp(req);
  const ua = userAgent(req);

  // Invalidate older unused challenges for the same phone/purpose.
  await db
    .update(verificationChallenges)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(verificationChallenges.phone, phone),
        eq(verificationChallenges.purpose, purpose),
        isNull(verificationChallenges.consumedAt)
      )
    );

  const [challenge] = await db
    .insert(verificationChallenges)
    .values({
      phone,
      purpose,
      codeHash: codeHash(phone, purpose, code),
      ip,
      userAgent: ua,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    })
    .returning({ id: verificationChallenges.id });

  try {
    await sendVerificationSms(phone, code, purpose);
  } catch (err) {
    await db
      .update(verificationChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(verificationChallenges.id, challenge.id));
    throw err;
  }

  await audit({
    action: 'auth.code.request',
    targetType: 'phone',
    targetId: phone,
    ip,
    userAgent: ua,
    metadata: { purpose },
  });

  return {
    challengeId: challenge.id,
    expiresIn: 300,
    devCode: serverEnv.allowDevSmsResponse ? code : undefined,
  };
}

export async function consumeChallenge(input: {
  phone: string;
  purpose: 'register' | 'login' | 'reset';
  code: string;
  req: NextRequest;
}) {
  const { phone, purpose, code, req } = input;
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(verificationChallenges)
      .where(
        and(
          eq(verificationChallenges.phone, phone),
          eq(verificationChallenges.purpose, purpose),
          isNull(verificationChallenges.consumedAt),
          gt(verificationChallenges.expiresAt, new Date())
        )
      )
      .orderBy(desc(verificationChallenges.createdAt))
      .limit(1)
      .for('update');

    const challenge = rows[0];
    if (!challenge) {
      throw new ApiError(400, 'CODE_EXPIRED', '验证码已过期，请重新获取');
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      await tx
        .update(verificationChallenges)
        .set({ consumedAt: new Date() })
        .where(eq(verificationChallenges.id, challenge.id));
      throw new ApiError(429, 'CODE_TOO_MANY_ATTEMPTS', '验证码尝试次数过多，请重新获取');
    }
    const expected = codeHash(phone, purpose, code);
    if (!safeEqual(expected, challenge.codeHash)) {
      await tx
        .update(verificationChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(verificationChallenges.id, challenge.id));
      throw new ApiError(400, 'CODE_INVALID', '验证码不正确');
    }
    await tx
      .update(verificationChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(verificationChallenges.id, challenge.id));
    return challenge;
  });

  await audit({
    action: 'auth.code.verify',
    targetType: 'phone',
    targetId: phone,
    ip: clientIp(req),
    userAgent: userAgent(req),
    metadata: { purpose, challengeId: result.id },
  });
  return result;
}

export async function listSessions(userId: string, currentSessionId: string) {
  const rows = await getDb()
    .select()
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)))
    .orderBy(desc(userSessions.lastUsedAt));
  return rows.map((row) => ({
    id: row.id,
    current: row.id === currentSessionId,
    userAgent: row.userAgent,
    ip: row.ip,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
  }));
}

export async function softDeleteAccount(userId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
        updatedAt: new Date(),
        name: null,
        passwordHash: null,
        avatarAssetId: null,
        phone: `del_${userId.slice(0, 8)}_${Date.now().toString(36).slice(-6)}`,
      })
      .where(eq(users.id, userId));
    await tx
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
    await tx
      .update(projects)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(projects.ownerId, userId));
    await tx
      .update(assets)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(assets.ownerId, userId));
  });
}
