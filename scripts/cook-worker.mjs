#!/usr/bin/env node
// C4 (J28, J29, J30): the cook worker.
//   node --import ./scripts/bake-loader.mjs scripts/cook-worker.mjs serve     notify endpoint; lists the catalogue at boot
//   node --import ./scripts/bake-loader.mjs scripts/cook-worker.mjs recook    every live and preview head, then exit; a deploy's step
//   node --import ./scripts/bake-loader.mjs scripts/cook-worker.mjs gc <build>...   keep those builds, delete the rest, print usage
//   node --import ./scripts/bake-loader.mjs scripts/cook-worker.mjs report    print usage against the budget (J89)
// Environment: WILDSHARD_API_URL, WILDSHARD_BUILD; R2_ACCOUNT_ID, R2_BUCKET_PACKS, R2_PACKS_ACCESS_KEY_ID,
// R2_PACKS_SECRET_ACCESS_KEY, or COOK_STORE_DIR for a folder; COOK_NOTIFY_TOKEN; COOK_PORT (8791), COOK_HOST (127.0.0.1);
// COOK_SERVER_PACKS, COOK_SCRATCH; COOK_SECONDS, COOK_MEMORY_MB, COOK_HEAP_MB, COOK_MAX_SHARDFILE_BYTES; COOK_JOB_WRAP, a JSON array the host puts
// before each job to take its network away (see scripts/cook-worker.service).
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { apiSource, collectGarbage, createCookWorker, DEFAULT_LIMITS, notifyServer, PACK_BUDGET_BYTES, storeUsage } = await import('../src/game/cook/cookWorker.ts');
const { MAX_SHARDFILE_BYTES } = await import('../src/game/cook/cookJob.ts');
const { folderStore, r2Store } = await import('../src/game/cook/packStore.ts');

const env = process.env;
const need = name => { const value = env[name]; if (value === undefined || value === '') throw new Error(`cook-worker needs ${name}`); return value; };
const store = env.COOK_STORE_DIR === undefined
  ? r2Store({ endpoint: `https://${need('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`, bucket: need('R2_BUCKET_PACKS'), accessKeyId: need('R2_PACKS_ACCESS_KEY_ID'), secretAccessKey: need('R2_PACKS_SECRET_ACCESS_KEY') })
  : folderStore(env.COOK_STORE_DIR);
const root = fileURLToPath(new URL('..', import.meta.url));
const maxBytes = Number(env.COOK_MAX_SHARDFILE_BYTES ?? MAX_SHARDFILE_BYTES);
const worker = () => createCookWorker({
  build: need('WILDSHARD_BUILD'), store, source: apiSource(need('WILDSHARD_API_URL'), fetch, maxBytes), log: line => { console.log(line); },
  serverPacks: resolve(env.COOK_SERVER_PACKS ?? 'tmp/cook/server'), scratch: resolve(env.COOK_SCRATCH ?? 'tmp/cook/scratch'),
  launcher: {
    root, execPath: process.execPath, loader: fileURLToPath(new URL('bake-loader.mjs', import.meta.url)), script: fileURLToPath(new URL('cook-job.mjs', import.meta.url)),
    wrap: JSON.parse(env.COOK_JOB_WRAP ?? '[]'),
    limits: { seconds: Number(env.COOK_SECONDS ?? DEFAULT_LIMITS.seconds), memoryMB: Number(env.COOK_MEMORY_MB ?? DEFAULT_LIMITS.memoryMB), heapMB: Number(env.COOK_HEAP_MB ?? DEFAULT_LIMITS.heapMB), maxBytes },
  },
});

const [command, ...rest] = process.argv.slice(2);
if (command === 'serve') {
  const cook = worker(), port = Number(env.COOK_PORT ?? 8791), host = env.COOK_HOST ?? '127.0.0.1';
  notifyServer(cook, need('COOK_NOTIFY_TOKEN')).listen(port, host, () => { console.log(`cook worker on ${host}:${port}`); });
  // J30: what a missed notice left behind. A catalogue that can't be read waits for the next notice.
  try { await cook.recook(['live', 'preview']); } catch (error) { console.error(`boot list failed: ${String(error)}`); }
} else if (command === 'recook') {
  const rows = await worker().recook(['live', 'preview']);
  console.log(JSON.stringify(rows));
  // J29: a build takes no traffic with a live shard it couldn't cook. A refused head is already live, so it stops a deploy too.
  process.exit(rows.every(row => row.state === 'cooked' || row.state === 'present') ? 0 : 1);
} else if (command === 'gc') {
  console.log(JSON.stringify(await collectGarbage(store, rest, Number(env.COOK_BUDGET_BYTES ?? PACK_BUDGET_BYTES), Date.now())));
} else if (command === 'report') {
  console.log(JSON.stringify(await storeUsage(store, Number(env.COOK_BUDGET_BYTES ?? PACK_BUDGET_BYTES))));
} else {
  throw new Error('usage: cook-worker serve | recook | gc <build>... | report');
}
