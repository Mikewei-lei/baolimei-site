import { api, ok, parseJson, clientIp } from '@/lib/server/http';
import { assetPresignSchema } from '@/lib/server/validation';
import { createAssetUpload } from '@/lib/server/assets';
import { enforceRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = api(
  async (req, _ctx, auth) => {
    const input = await parseJson(req, assetPresignSchema);
    await enforceRateLimit(`asset:presign:${auth!.user.id}`, 60, 60 * 60, '上传请求过于频繁');
    await enforceRateLimit(`asset:presign:ip:${clientIp(req)}`, 90, 60 * 60, '上传请求过于频繁');
    const result = await createAssetUpload({
      userId: auth!.user.id,
      projectId: input.projectId || null,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.size,
    });
    return ok({
      assetId: result.asset.id,
      upload: result.upload,
      expiresIn: 600,
    });
  },
  { auth: true, csrf: true }
);
