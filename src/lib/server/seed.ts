import { config } from 'dotenv';
config({ path: '.env.local' });
config();

import { getDb } from './db';
import { modelProviders } from './schema';
import { serverEnv } from './env';

const providers = [
  {
    name: 'mock',
    kind: 'mock',
    enabled: serverEnv.mockGenerationEnabled,
    config: { label: 'Development mock provider', productionSafe: false },
  },
  {
    name: 'fal',
    kind: 'fal',
    enabled: Boolean(process.env.FAL_KEY) && !serverEnv.isProduction ? true : Boolean(process.env.FAL_KEY),
    config: { label: 'fal.ai', models: ['kling', 'veo', 'wan', 'flux'] },
  },
  {
    name: 'ark',
    kind: 'ark',
    enabled: Boolean(process.env.ARK_API_KEY),
    config: { label: 'Volcengine Ark', models: ['seedance', 'seedream'] },
  },
];

async function main() {
  const db = getDb();
  for (const provider of providers) {
    await db
      .insert(modelProviders)
      .values(provider)
      .onConflictDoUpdate({
        target: modelProviders.name,
        set: { kind: provider.kind, enabled: provider.enabled, config: provider.config, updatedAt: new Date() },
      });
  }
  console.log(`[seed] model_providers ready: ${providers.map((p) => `${p.name}=${p.enabled}`).join(', ')}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
