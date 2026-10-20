import { api, ok, ApiError } from '@/lib/server/http';
import { getCanvasVersion } from '@/lib/server/canvas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (_req, ctx, auth) => {
    const { id, version } = await ctx.params;
    const parsed = Number(version);
    if (!Number.isInteger(parsed) || parsed < 1) throw new ApiError(400, 'VERSION_INVALID', '版本号不合法');
    return ok(await getCanvasVersion(auth!.user.id, id, parsed));
  },
  { auth: true, csrf: false }
);
