// Repo-only build policy: the SDK receives a number and never reads lint or frozen source inventories.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as v from 'valibot';
import { legacyInventory } from './legacy-shards.mjs';

const pathSchema = v.pipe(v.string(), v.check(path => path.length > 0 && !path.startsWith('/') && !path.includes('\\') && path.split('/').every(part => part !== '' && part !== '.' && part !== '..')));
const basisSchema = v.strictObject({ schema: v.literal('legacy-line-basis/1'), revision: v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/u)),
  shards: v.record(pathSchema, v.strictObject({ source: v.pipe(v.string(), v.regex(/^[a-f0-9]{40}$/u)),
    excluded: v.array(pathSchema), files: v.record(pathSchema, v.pipe(v.number(), v.integer(), v.minValue(0))) })) });
// The historical producer exclusions and per-file counts are pinned at 1258254a3.
// Never recount with today's producer catalogue or compatibility-only frozen edits:
// e45fe0e4d and a888b0ac1 moved the denominator without removing custom work.
// See progress/shard-platform/ruler-basis-2026-10-17/README.md for the audit.
function lineBasis(root) {
  return v.parse(basisSchema, JSON.parse(readFileSync(resolve(root, 'lint/legacy-line-basis.json'), 'utf8')));
}
/** Historical exclusions only; retiring a live producer cannot unfreeze the denominator. */
export function legacyGeneratedPaths(root, frozen = legacyInventory(root)) {
  const generated = new Set(), basis = new Map(Object.entries(lineBasis(root).shards));
  for (const [folder, row] of Object.entries(frozen.shards)) {
    const pinned = basis.get(row.primary);
    if (pinned?.source !== row.source) throw new Error(`${row.primary}: missing matching frozen line basis`);
    for (const path of pinned.excluded) generated.add(`src/shards/${folder}/${path}`);
  }
  return generated;
}
/** Same sealed denominator for the official build adapter and P4 ruler; no build or output measurement recursion. */
export function decisionLegacyLines(root, slug) {
  const frozen = legacyInventory(root), pair = Object.entries(frozen.shards).find(([, row]) => row.primary === slug);
  if (pair === undefined) return undefined;
  if (!frozen.sealed) throw new Error('Decision budget requires a sealed legacy inventory');
  const pinned = new Map(Object.entries(lineBasis(root).shards)).get(slug);
  if (pinned?.source !== pair[1].source) throw new Error(`${slug}: missing matching frozen line basis`);
  const lines = Object.values(pinned.files).reduce((total, amount) => total + amount, 0);
  if (lines <= 0) throw new Error(`${slug}: frozen legacy has no authored TypeScript lines`);
  return lines;
}
