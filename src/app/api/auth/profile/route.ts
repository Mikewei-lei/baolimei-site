import { eq } from 'drizzle-orm';
import { api, ok, parseJson } from '@/lib/server/http';
import { updateProfileSchema } from '@/lib/server/validation';
import { getDb } from '@/lib/server/db';
import { users } from '@/lib/server/schema';
import { publicUser } from '@/lib/server/auth';
import { setAvatar } from '@/lib/server/assets';
import { audit } from '@/lib/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = api(
  async (req, _ctx, auth) => {
    const input = await parseJson(req, updateProfileSchema);
    if (input.avatarAssetId) {
      await setAvatar(auth!.user.id, input.avatarAssetId);
    }
    const [updated] = await getDb()
      .update(users)
      .set({
        ...(input.name !== undefined ? { name: input.name.trim().slice(0, 60) } : {}),
        ...(input.avatarAssetId !== undefined ? { avatarAssetId: input.avatarAssetId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, auth!.user.id))
      .returning();
    await audit({
      actorId: auth!.user.id,
      action: 'auth.profile.update',
      targetType: 'user',
      targetId: auth!.user.id,
      metadata: { nameChanged: input.name !== undefined, avatarChanged: input.avatarAssetId !== undefined },
    });
    return ok({ user: publicUser(updated) });
  },
  { auth: true, csrf: true }
);
