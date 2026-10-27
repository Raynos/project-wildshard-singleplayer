import type { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { parseSpawnScript, spawnRegistries, type SpawnScript } from '@wildshard/sdk/rows';
import { charge } from './eliteCharge';

/** The product name the Qara Batyr charge module ships under. */
export const NALATI_CHARGE_MODULE = 'behaviour/nalati.qara-charge.wasm';
/** The charge spawn script as the retired `nalati-elite-charge` job's eliteCharge.generated.json held it: the admitted
 *  rows with the compiled ABI-1 script, empty inline bytes and the module's size. */
export type NalatiCharge = Omit<SpawnScript, 'script'> & { script: Awaited<ReturnType<typeof compileDecisionScripts>>['rows'][number]; bytes: string; compiled: { source: string; bytes: number } };

/** GR6 (G783): compile the Qara Batyr charge (`compile`: the build's decision-row compiler) from the authored
 *  `behaviour/*.as` map; returns the charge rows and the module bytes. Tests and tools call the same. */
export async function nalatiChargeRows(compile: typeof compileDecisionScripts, authored: ReadonlyMap<string, string>): Promise<{ rows: NalatiCharge; wasm: Uint8Array }> {
  const row = parseSpawnScript(charge);
  const built = await compile([row.script], spawnRegistries(row), authored, { asLineCeiling: 3184 });
  const script = built.rows.at(0), blob = built.blobs.at(0);
  if (script === undefined || blob === undefined) throw new Error('Missing captain program');
  return { rows: { ...row, script, bytes: '', compiled: { source: NALATI_CHARGE_MODULE, bytes: blob.bytes.length } }, wasm: blob.bytes };
}
