export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.WORKER_ENABLED === '0') return;
  const { startWorker } = await import('@/lib/server/jobs/worker');
  startWorker();
}
