import { api, ok, ApiError } from '@/lib/server/http';
import { assetDto, assetUrl, deleteAsset, getAssetForUser } from '@/lib/server/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    const asset = await getAssetForUser(auth!.user.id, id);
    return ok({ asset: assetDto(asset, asset.status === 'ready' ? await assetUrl(asset) : undefined) });
  },
  { auth: true, csrf: false }
);

export const DELETE = api(
  async (req, ctx, auth) => {
    const { id } = await ctx.params;
    const force = req.nextUrl.searchParams.get('force') === '1';
    return ok(await deleteAsset(auth!.user.id, id, force));
  },
  { auth: true, csrf: true }
);
