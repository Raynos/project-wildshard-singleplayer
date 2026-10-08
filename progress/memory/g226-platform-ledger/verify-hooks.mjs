import { readFileSync, writeFileSync } from 'node:fs';
import { gridFloorWitnessFailures } from '../../../scripts/frame-floor-grid.mjs';
import { GPU_FILES } from '../../../src/shards/pine-hollow/ktx2.generated.ts';

const read = name => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const before = read('hooks-1cca1dcc2.json'), after = read('hooks-163516ec7.json');
const requested = new Set(after.assetRequests.map(url => new URL(url).pathname));
const entries = Object.entries(GPU_FILES.phone).filter(([path]) => path.startsWith('/assets/pine-hollow/creatures/') && path.endsWith('.glb'));
const rigs = entries.map(([raw, compressed]) => ({ raw, compressed, compressedRequested: requested.has(compressed), rawRequested: requested.has(raw) }));
if (rigs.length !== 8 || rigs.some(row => !row.compressedRequested || row.rawRequested)) throw new Error('Compressed rig witness failed');
const routes = after.routes.filter(row => row.plan.name.endsWith('-interior')).map(row => ({ name: row.plan.name, failures: gridFloorWitnessFailures(row) }));
if (routes.length !== 2 || routes.some(row => row.failures.length)) throw new Error('Route witness failed');
if (!after.closed || after.failure || after.profileFailure || after.errors.length || after.console.length) throw new Error('Browser diagnostic failed');
const hooks = after.hookProfiles.filter(row => row.kind === 'hook' && row.instance !== 'driftwood-isle').map(row => {
  const prior = before.hookProfiles.find(old => old.instance === row.instance && old.hook === row.hook);
  return { instance: row.instance, hook: row.hook, beforeWallMs: prior === undefined ? null : prior.end - prior.start,
    afterWallMs: row.end - row.start, afterSampledMs: row.sampledMicros / 1000 };
});
const summary = { before: before.version, after: after.version,
  protocol: 'One muted Chromium/Metal phone per run, Auto. Diagnostic only, not a controlled perf benchmark: coordinator floors/other lane browsers were active during the after run.',
  closed: after.closed, pageErrors: after.errors, console: after.console, routes, rigs,
  coatKtx2Requests: [...requested].filter(path => path.includes('/pine-hollow/creatures/') && path.endsWith('.ktx2')).length, hooks,
  poses: after.snapshots.map(row => ({ label: row.label, playingMB: row.state.playingMB, current: row.state.live.live.current, residents: row.state.live.live.residents })),
  remainingLongTasks: after.hookProfiles.filter(row => row.kind === 'longtask' && row.sampledMicros > 0 && row.end - row.start > 250)
    .map(row => ({ instance: row.instance, start: row.start, ms: row.end - row.start, topStacks: row.topStacks.slice(0, 3) })) };
writeFileSync(new URL('hooks-comparison.json', import.meta.url), `${JSON.stringify(summary, null, 2)}\n`);
console.log({ routes, rigs: rigs.length, coats: summary.coatKtx2Requests, errors: after.errors.length, closed: after.closed });
