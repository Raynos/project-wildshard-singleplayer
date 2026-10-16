import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** SF65 (G238): SHARD SELECT's "N% PORTED" badge, measured at build time by the SF6 metric (scripts/shard-platform.mjs, the
 *  G291 retained-runtime reduction, native shards omitted without a frozen copy), so the menu never runs the script. Written to a gitignored table on every `pnpm gen`. */
/** Only the output report supplies percentages. An empty pre-build table means
 * unavailable badges, never zero percent custom or stale authoring credit.
 * @param {string} root @param {Record<string,import('./shard-platform.mjs').ShardLines>} measures */
export function genPortShares(root = process.cwd(), measures = {}) {
  const shares = Object.fromEntries(Object.entries(measures).filter(([, row]) => row.conversion.runtimeShare !== null).map(([slug, row]) => [slug, Math.round((Math.max(0, 1 - (row.conversion.runtimeShare ?? 1))) * 10_000) / 10_000]));
  const out = resolve(root, 'src/game/shard/portShares.generated.ts');
  const source = `// Generated from verified out/<slug>/runtime; absent means unclosed/unavailable, never zero custom.\nexport const PORT_SHARES: Readonly<Record<string, number>> = ${JSON.stringify(shares, null, 2)};\n`;
  let previous = '';
  try { previous = readFileSync(out, 'utf8'); } catch { /* first generation */ }
  if (previous !== source) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, source); }
  return measures;
}
