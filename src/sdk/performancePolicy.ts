// oxlint-disable-next-line import/no-nodejs-modules -- Only canonical checkout paths can receive the old-six offline warning policy.
import { existsSync, realpathSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Author identities and symlink spellings do not confer checkout provenance.
import { resolve } from 'node:path';
import type { Shardfile } from './shardfile';

const legacy = new Set(['driftwood-isle', 'pine-hollow', 'nalati-grasslands', 'far-reach', 'sunscar-dunes', 'nine-dragon-stack']);
/** Offline policy is selected by trusted checkout provenance, never by author slug or a product flag. */
export function projectPerformancePolicy(project: string | undefined, source: Shardfile): 'warn' | 'refuse' {
  if (project === undefined || !legacy.has(source.identity.slug)) return 'refuse';
  const root = resolve(import.meta.dirname, '../..');
  // Installed SDKs have no complete checkout at this path; all their author projects refuse over-budget targets.
  if (!existsSync(resolve(root, 'src/sdk/project.ts')) || !existsSync(resolve(root, 'AGENTS.md'))) return 'refuse';
  const canonical = resolve(root, 'src/shards', source.identity.slug);
  if (!existsSync(project) || !existsSync(canonical)) return 'refuse';
  const actual = realpathSync(project), product = resolve(root, 'public/shardfiles', source.identity.slug);
  return actual === realpathSync(canonical) || (existsSync(product) && actual === realpathSync(product)) ? 'warn' : 'refuse';
}
