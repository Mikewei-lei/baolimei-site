import { api, ok, parseJson, ApiError } from '@/lib/server/http';
import { restoreVersionSchema } from '@/lib/server/validation';
import { restoreCanvasVersion } from '@/lib/server/canvas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (req, ctx, auth) => {
    const { id } = await ctx.params;
    const input = await parseJson(req, restoreVersionSchema);
    const version = Number((req.nextUrl.searchParams.get('version') || '').trim());
    if (!Number.isInteger(version) || version < 1) {
      throw new ApiError(400, 'VERSION_INVALID', '缺少合法 version 参数');
    }
    const result = await restoreCanvasVersion({
      userId: auth!.user.id,
      canvasId: id,
      version,
      baseVersion: input.baseVersion,
    });
    return ok({ canvas: result });
  },
  { auth: true, csrf: true }
);
