import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/server/db';
import { assets } from '@/lib/server/schema';
import { errorResponse, ApiError } from '@/lib/server/http';
import { verifyUploadToken } from '@/lib/server/storage';
import { putObjectBuffer } from '@/lib/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const token = new URL(req.url).searchParams.get('token') || '';
    const exp = new URL(req.url).searchParams.get('exp') || '';
    const rows = await getDb()
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), isNull(assets.deletedAt)))
      .limit(1);
    const asset = rows[0];
    if (!asset) throw new ApiError(404, 'ASSET_NOT_FOUND', '素材不存在');
    verifyUploadToken(id, asset.storageKey, token, exp);
    if (!['pending', 'uploaded'].includes(asset.status)) {
      throw new ApiError(409, 'ASSET_STATE_INVALID', '素材状态不允许上传');
    }
    const contentType = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (contentType && contentType !== asset.mimeType.toLowerCase()) {
      throw new ApiError(400, 'ASSET_TYPE_MISMATCH', '上传文件类型与申请不一致');
    }
    const body = Buffer.from(await req.arrayBuffer());
    if (body.length <= 0) throw new ApiError(400, 'ASSET_EMPTY', '上传文件为空');
    if (body.length > asset.size + 1024) {
      throw new ApiError(400, 'ASSET_TOO_LARGE', '上传文件超过申请大小');
    }
    await putObjectBuffer(asset.storageKey, body, asset.mimeType);
    await getDb()
      .update(assets)
      .set({ status: 'uploaded', updatedAt: new Date() })
      .where(eq(assets.id, asset.id));
    const response = NextResponse.json({ ok: true, data: { assetId: id, uploaded: body.length } });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
