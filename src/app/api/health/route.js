import { NextResponse } from 'next/server';
import { liveMode, providerFor } from '@/lib/providers';
import { models } from '@/lib/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  const channels = models
    .filter((m) => providerFor(m))
    .map((m) => ({ id: m.id, provider: providerFor(m) }));

  return NextResponse.json({
    ok: true,
    service: 'baolimei-site',
    mode: liveMode() && channels.length ? 'live' : 'demo',
    channels,
    time: new Date().toISOString(),
  });
}
