// Root-owned policy emission; the SDK consumes only the portable generated number.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { legacyInventory } from './legacy-shards.mjs';
import { decisionLegacyLines, legacyGeneratedPaths } from './decision-legacy-lines.mjs';

/** The same sealed inventory/exclusions used by the CLI and ruler, never a per-test override. */
export function genDecisionPolicies(root, check = false, initializeMissing = false) {
  const frozen = legacyInventory(root), generated = legacyGeneratedPaths(root, frozen);
  for (const row of Object.values(frozen.shards)) {
    const count = decisionLegacyLines(root, row.primary, { generated });
    if (count === undefined) throw new Error('Missing sealed decision denominator');
    const path = resolve(root, 'src/shards', row.primary, '.wildshard/build-policy.json');
    const source = `${JSON.stringify({ version: 1, decisionLegacyLines: count })}\n`, exists = existsSync(path), same = exists && readFileSync(path, 'utf8') === source;
    const initialize = initializeMissing && !exists;
    if (check && !same && !initialize) throw new Error(`gen-shards: stale ${path}`);
    if ((!check || initialize) && !same) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source); }
  }
}
