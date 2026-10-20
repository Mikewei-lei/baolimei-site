import { api, ok, parseJson } from '@/lib/server/http';
import { saveCanvasSchema } from '@/lib/server/validation';
import { getCanvas, saveCanvas } from '@/lib/server/canvas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    return ok(await getCanvas(auth!.user.id, id));
  },
  { auth: true, csrf: false }
);

export const PUT = api(
  async (req, ctx, auth) => {
    const { id } = await ctx.params;
    const input = await parseJson(req, saveCanvasSchema);
    const result = await saveCanvas({
      userId: auth!.user.id,
      canvasId: id,
      graph: input.graph,
      baseVersion: input.baseVersion,
      snapshot: input.snapshot,
      label: input.label,
    });
    return ok({ canvas: result });
  },
  { auth: true, csrf: true }
);
