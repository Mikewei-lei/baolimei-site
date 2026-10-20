import { api, ok, parseJson } from '@/lib/server/http';
import { projectUpdateSchema } from '@/lib/server/validation';
import { deleteProject, getProject, updateProject } from '@/lib/server/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    return ok({ project: await getProject(auth!.user.id, id) });
  },
  { auth: true, csrf: false }
);

export const PATCH = api(
  async (req, ctx, auth) => {
    const { id } = await ctx.params;
    const input = await parseJson(req, projectUpdateSchema);
    return ok({ project: await updateProject(auth!.user.id, id, input) });
  },
  { auth: true, csrf: true }
);

export const DELETE = api(
  async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    return ok(await deleteProject(auth!.user.id, id));
  },
  { auth: true, csrf: true }
);
