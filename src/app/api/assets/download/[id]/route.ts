import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/server/db';
import { assets } from '@/lib/server/schema';
import { errorResponse, ApiError } from '@/lib/server/http';
import {
  createS3DownloadUrl,
  openLocalObject,
  verifyDownloadToken,
} from '@/lib/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const params = new URL(req.url).searchParams;
    const token = params.get('token') || '';
    const exp = params.get('exp') || '';
    verifyDownloadToken(id, token, exp);
    const rows = await getDb()
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), eq(assets.status, 'ready'), isNull(assets.deletedAt)))
      .limit(1);
    const asset = rows[0];
    if (!asset) throw new ApiError(404, 'ASSET_NOT_FOUND', '素材不存在');

    if (asset.storageDriver === 's3') {
      return NextResponse.redirect(await createS3DownloadUrl(asset.storageKey, 600));
    }

    const buffer = await openLocalObject(asset.storageKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=900',
        'Content-Disposition': `inline; filename="${encodeURIComponent(asset.originalName || 'asset')}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
