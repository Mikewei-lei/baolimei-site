import { api, ok } from '@/lib/server/http';
import { listSessions } from '@/lib/server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (_req, _ctx, auth) => {
    const sessions = await listSessions(auth!.user.id, auth!.session.id);
    return ok({ sessions });
  },
  { auth: true, csrf: false }
);
