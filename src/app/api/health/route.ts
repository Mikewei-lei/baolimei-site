import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { serverEnv } from '@/lib/server/env';
import { storageDriver } from '@/lib/server/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, unknown> = {
    service: 'baolimei-site',
    appEnv: serverEnv.appEnv,
    mode: serverEnv.mockGenerationEnabled ? 'development-mock' : 'live-only',
    storage: storageDriver(),
    worker: serverEnv.workerEnabled,
    time: new Date().toISOString(),
  };
  let ok = true;
  try {
    await getPool().query('SELECT 1');
    checks.database = 'ok';
  } catch (err) {
    ok = false;
    checks.database = 'down';
  }
  return NextResponse.json({ ok, ...checks }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
