import { api, ok } from '@/lib/server/http';
import { listAssets } from '@/lib/server/assets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api(
  async (req, _ctx, auth) => {
    const params = req.nextUrl.searchParams;
    const assets = await listAssets({
      userId: auth!.user.id,
      projectId: params.get('projectId'),
      kind: params.get('kind'),
      limit: Number(params.get('limit') || 30),
    });
    return ok({ assets });
  },
  { auth: true, csrf: false }
);
