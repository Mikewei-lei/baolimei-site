import { api, ok, parseJson } from '@/lib/server/http';
import { projectCreateSchema } from '@/lib/server/validation';
import { createProject, listProjects } from '@/lib/server/projects';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (_req, _ctx, auth) => {
    return ok({ projects: await listProjects(auth!.user.id) });
  },
  { auth: true, csrf: false }
);

export const POST = api(
  async (req, _ctx, auth) => {
    const input = await parseJson(req, projectCreateSchema);
    const project = await createProject(auth!.user.id, input);
    return ok({ project });
  },
  { auth: true, csrf: true }
);
