// oxlint-disable-next-line import/no-nodejs-modules -- Each suite hydrates a private cache of actual native recorder outputs.
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- All native artefacts stay inside the fixture's own repository scratch directory.
import { resolve, dirname } from 'node:path';
import * as v from 'valibot';
import { driftwoodWitness } from '../proof/driftwood-isle/native';
import { runSnapshot } from './runSnapshot';
import { builtProduct } from './builtProduct';

const Generated = v.object({ status: v.literal('generated'), directory: v.string(),
  key: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)), manifest: v.string() });
const Outputs = v.object({ cache: v.object({ payloads: v.record(v.string(), v.string()) }) });
// The snapshot-writer config has no product sequencer; retain the ordinary
// strict source receipt and the child witness's exact out-directory intake.
if (realpathSync(builtProduct('driftwood-isle')) !== realpathSync('out/driftwood-isle'))
  throw new Error('Driftwood witness output is not the current product');
const cache = mkdtempSync(resolve('tmp/driftwood-witness-fixture-'));
try {
  let computed = false;
  const files = await runSnapshot('driftwood-witness-cache', () => {
    computed = true;
    const result = driftwoodWitness('cache-verify', 270_000, cache);
    if (result.status !== 0) throw new Error(`Native witness construction failed: ${result.stderr}\n${result.stdout}`);
    const generated = v.parse(Generated, JSON.parse(result.stdout.split('\n').at(-1) ?? 'null'));
    const payloads = v.parse(Outputs, JSON.parse(generated.manifest)).cache.payloads;
    const files = new Map<string, Uint8Array>();
    for (const name of [...Object.keys(payloads), 'manifest.json', '.generation-receipt.json']) {
      const relative = `witness-driftwood-isle/${generated.key}/${name}`;
      files.set(relative, Uint8Array.from(readFileSync(resolve(generated.directory, name))));
    }
    return Promise.resolve(files);
  });
  if (!computed) for (const [name, bytes] of files) {
    const file = resolve(cache, name); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes);
  }
} catch (error) { rmSync(cache, { recursive: true, force: true }); throw error; }

/** Every call still runs the original source/host/output hash checks in a fresh
 * process; only the actual recorder payloads are shared, never test verdicts. */
export const cachedDriftwoodWitness = (mode: string, timeout: number): ReturnType<typeof driftwoodWitness> => driftwoodWitness(mode, timeout, cache);
/** Retire only this suite's hydrated native cache after all original cases. */
export function retireDriftwoodWitness(): void { rmSync(cache, { recursive: true, force: true }); }
