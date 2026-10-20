import { api, ok } from '@/lib/server/http';
import { listCanvasVersions } from '@/lib/server/canvas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    return ok({ versions: await listCanvasVersions(auth!.user.id, id) });
  },
  { auth: true, csrf: false }
);
