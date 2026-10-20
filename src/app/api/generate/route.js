import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function moved() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'ENDPOINT_MOVED',
        message: '旧生成接口已迁移到 /api/jobs，请使用云端任务队列。',
      },
    },
    { status: 410, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST() {
  return moved();
}

export async function GET() {
  return moved();
}
