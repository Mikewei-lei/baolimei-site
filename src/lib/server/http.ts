import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { serverEnv } from './env';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json({ ok: true, data }, init);
  applyApiHeaders(response);
  return response;
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  const response = NextResponse.json({ ok: false, error: { code, message, details } }, { status });
  applyApiHeaders(response);
  return response;
}

export function applyApiHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Vary', 'Origin');
  return response;
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) return fail(err.status, err.code, err.message, err.details);
  if (err instanceof ZodError) {
    return fail(400, 'VALIDATION_ERROR', '请求参数不合法', err.flatten());
  }
  const message = err instanceof Error ? err.message : '服务器内部错误';
  if (serverEnv.isProduction) {
    // Do not print raw SQL/query params in production; they may contain user data.
    console.error('[api] internal error:', err instanceof Error ? err.name : 'UnknownError');
  } else {
    console.error('[api] unhandled error:', message);
    if (err instanceof Error && (err as { cause?: unknown }).cause) {
      const cause = (err as { cause?: { message?: string; code?: string } }).cause;
      console.error('[api] cause:', cause?.code || '', cause?.message || cause);
    }
  }
  return fail(500, 'INTERNAL_ERROR', '服务器内部错误');
}

export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim().slice(0, 45);
  return (req.headers.get('x-real-ip') || '127.0.0.1').slice(0, 45);
}

export function userAgent(req: NextRequest): string {
  return (req.headers.get('user-agent') || '').slice(0, 500);
}

export function assertOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new ApiError(403, 'ORIGIN_FORBIDDEN', '请求来源不合法');
  }
  const allowed = new Set(
    serverEnv.allowedOrigins.map((item) => {
      try {
        return new URL(item).origin;
      } catch {
        return item;
      }
    })
  );
  if (!allowed.has(parsed.origin)) {
    throw new ApiError(403, 'ORIGIN_FORBIDDEN', '请求来源不被允许');
  }
}

export async function parseJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', '请求体不是合法 JSON');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', '请求参数不合法', parsed.error.flatten());
  }
  return parsed.data;
}

type RouteContext = { params: Promise<Record<string, string>> };
type RouteHandler = (
  req: NextRequest,
  ctx: RouteContext,
  auth: AuthContext | null
) => Promise<NextResponse> | NextResponse;

type AuthContext = { user: { id: string }; session: { id: string; csrfHash: string; expiresAt: Date } };

export function api(
  handler: RouteHandler,
  options: { auth?: boolean; csrf?: boolean } = {}
) {
  return async (req: NextRequest, ctx: RouteContext) => {
    try {
      assertOrigin(req);
      let auth: AuthContext | null = null;
      if (options.auth) {
        const { requireUser } = await import('./auth');
        const result = await requireUser(req, {
          csrf: options.csrf !== false && req.method !== 'GET' && req.method !== 'HEAD',
        });
        auth = { user: { id: result.user.id }, session: result.session };
      }
      return await handler(req, ctx || { params: Promise.resolve({}) }, auth);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
