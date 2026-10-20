import { api, ok } from '@/lib/server/http';
import { retryJob } from '@/lib/server/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    return ok({ job: await retryJob(auth!.user.id, id) });
  },
  { auth: true, csrf: true }
);
