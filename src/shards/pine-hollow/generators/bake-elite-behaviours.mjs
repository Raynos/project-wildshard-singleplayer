// Author-only v1 named encounter producer. All bodies remain owned by the admitted roster.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { spawnScriptRegistries } from '@wildshard/format/spawnScripts';
import { parseEliteFeature } from '@wildshard/format/eliteFeature';
import { ELITE_FEATURE_ROWS } from './eliteFeatureRows.ts';

const root = resolve(import.meta.dirname, '../../../..'), project = 'src/shards/pine-hollow';
const sources = new Map(['common', 'ironhide', 'ghost', 'blackpaw', 'imperial'].map(name => [`behaviour/elites/${name}.as`, readFileSync(resolve(root, project, `behaviour/elites/${name}.as`), 'utf8')]));
const fights = [];
for (const fight of ELITE_FEATURE_ROWS.fights) {
  const rows = parseEliteFeature({ ...ELITE_FEATURE_ROWS, fights: [fight] }).fights[0];
  const built = await compileDecisionScripts([rows.program.script], spawnScriptRegistries(rows.program), sources, { asLineCeiling: 2130 });
  const script = built.rows[0], blob = built.blobs[0];
  fights.push({ ...fight, program: { ...fight.program, script, bytes: Buffer.from(blob.bytes).toString('base64') } });
  if (!process.argv.includes('--check')) writeFileSync(resolve(root, project, 'assets', blob.file.hash), blob.bytes);
}
const path = resolve(root, project, 'behaviour/elites.generated.json'), output = `${JSON.stringify(parseEliteFeature({ ...ELITE_FEATURE_ROWS, fights }), null, 2)}\n`;
if (process.argv.includes('--check')) { if (readFileSync(path, 'utf8') !== output) throw new Error('Elite v1 product stale'); }
else writeFileSync(path, output);
console.info('Pine elites: four admitted v1 programs and row-owned slot catalogues');
