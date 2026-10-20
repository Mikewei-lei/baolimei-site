import { api, ok, parseJson } from '@/lib/server/http';
import { assetCompleteSchema } from '@/lib/server/validation';
import { assetDto, assetUrl, completeAssetUpload } from '@/lib/server/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (req, _ctx, auth) => {
    const { assetId } = await parseJson(req, assetCompleteSchema);
    const asset = await completeAssetUpload(auth!.user.id, assetId);
    return ok({ asset: assetDto(asset, await assetUrl(asset)) });
  },
  { auth: true, csrf: true }
);
