// Root-owned policy emission; the SDK consumes only the portable generated number.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { shardLineBaselines } from './decision-legacy-lines.mjs';

/** Emit each shard's pinned budget without depending on frozen folders or their inventory. */
export function genDecisionPolicies(root, check = false, initializeMissing = false) {
  for (const [slug, { lines: count }] of shardLineBaselines(root)) {
    const path = resolve(root, 'src/shards', slug, '.wildshard/build-policy.json');
    const source = `${JSON.stringify({ version: 1, decisionLegacyLines: count })}\n`, exists = existsSync(path), same = exists && readFileSync(path, 'utf8') === source;
    const initialize = initializeMissing && !exists;
    if (check && !same && !initialize) throw new Error(`gen-shards: stale ${path}`);
    if ((!check || initialize) && !same) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source); }
  }
}
