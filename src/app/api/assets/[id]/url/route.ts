import { api, ok } from '@/lib/server/http';
import { assetDto, assetUrl, getAssetForUser } from '@/lib/server/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (_req, ctx, auth) => {
    const { id } = await ctx.params;
    const asset = await getAssetForUser(auth!.user.id, id);
    const url = asset.status === 'ready' ? await assetUrl(asset) : null;
    return ok({ asset: assetDto(asset, url || undefined), url });
  },
  { auth: true, csrf: false }
);
