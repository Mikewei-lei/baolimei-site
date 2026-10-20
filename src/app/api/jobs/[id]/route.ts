import { api, ok } from '@/lib/server/http';
import { getJob } from '@/lib/server/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    return ok({ job: await getJob(auth!.user.id, id) });
  },
  { auth: true, csrf: false }
);
