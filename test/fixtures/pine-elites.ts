import { readFileSync } from 'node:fs';
import { compileDecisionScripts } from '../../src/sdk/buildDecisionScripts';
import { parseEliteFeature, spawnRegistries } from '../../src/sdk/rows';
import { ELITE_FEATURE_ROWS } from '../../src/shards/pine-hollow/generators/eliteFeatureRows';

// GR8: the product compiles the four elite guests (output.ts eliteModules); tests compile the same sources the same way.
const sources = new Map(['common', 'ironhide', 'ghost', 'blackpaw', 'imperial'].map(name =>
  [`behaviour/elites/${name}.as`, readFileSync(new URL(`../../src/shards/pine-hollow/behaviour/elites/${name}.as`, import.meta.url), 'utf8')]));
const modules = new Map<string, Uint8Array>(), fights = [];
for (const fight of ELITE_FEATURE_ROWS.fights) {
  const rows = parseEliteFeature({ ...ELITE_FEATURE_ROWS, fights: [fight] }).fights[0];
  if (rows === undefined) throw new Error(`Missing Pine elite ${fight.def.id}`);
  const built = await compileDecisionScripts([rows.program.script], spawnRegistries(rows.program), sources, { asLineCeiling: 2130 });
  const script = built.rows[0], blob = built.blobs[0];
  if (script === undefined || blob === undefined) throw new Error(`Missing compiled Pine elite ${fight.def.id}`);
  modules.set(blob.file.hash, blob.bytes);
  fights.push({ ...fight, program: { ...fight.program, script, bytes: '' } });
}
/** The elite feature with each fight's compiled row and no bytes, as actors/elites.json carries it. */
export const PINE_ELITES = parseEliteFeature({ ...ELITE_FEATURE_ROWS, fights });
/** Each compiled elite Wasm by its content hash. */
export const PINE_ELITE_MODULES: ReadonlyMap<string, Uint8Array> = modules;
