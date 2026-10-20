import { api, ok } from '@/lib/server/http';
import { clearSessionCookies, revokeSession } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (_req, _ctx, auth) => {
    await revokeSession(auth!.session.id);
    const response = ok({ loggedOut: true });
    clearSessionCookies(response);
    return response;
  },
  { auth: true, csrf: true }
);
