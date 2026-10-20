import { api, ok, parseJson } from '@/lib/server/http';
import { jobCreateSchema } from '@/lib/server/validation';
import { createJob, listJobs } from '@/lib/server/jobs';
import { enforceRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (req, _ctx, auth) => {
    const projectId = req.nextUrl.searchParams.get('projectId');
    return ok({
      jobs: await listJobs(
        auth!.user.id,
        projectId,
        Number(req.nextUrl.searchParams.get('limit') || 30)
      ),
    });
  },
  { auth: true, csrf: false }
);

export const POST = api(
  async (req, _ctx, auth) => {
    const input = await parseJson(req, jobCreateSchema);
    await enforceRateLimit(`job:create:${auth!.user.id}`, 30, 60 * 60, '生成任务提交过于频繁');
    const job = await createJob(auth!.user.id, input as Parameters<typeof createJob>[1]);
    return ok({ job });
  },
  { auth: true, csrf: true }
);
