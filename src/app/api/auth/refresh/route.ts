import { api, ok } from '@/lib/server/http';
import { refreshSession, setSessionCookies } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (_req, _ctx, auth) => {
    const session = await refreshSession(auth!.session.id);
    const response = ok({
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt.toISOString(),
    });
    setSessionCookies(response, session);
    return response;
  },
  { auth: true, csrf: true }
);
