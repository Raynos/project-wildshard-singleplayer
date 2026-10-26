// oxlint-disable-next-line import/no-nodejs-modules -- Own one genuinely cold source cache under repository tmp.
import { mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Supply only the declared source and asset roots.
import { resolve } from 'node:path';
import { afterAll } from 'vitest';
import { build } from 'vite';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { prepareSpecies } from '../../src/shards/nalati-grasslands/generators/output';

const cache = mkdtempSync(resolve('tmp/nalati-current-held-'));
const base = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'c'.repeat(64), new Map(), cache,
  [{ prefix: '/assets/nalati/baked/', directory: resolve('public/assets/nalati/baked') }]);
export const currentHeldInputs: string[] = [];
const context = { ...base, cached: (step: Parameters<typeof base.cached>[0], make: Parameters<typeof base.cached>[1]) => {
  currentHeldInputs.push(...(step.inputs ?? [])); return base.cached(step, make);
} };
/** One real cold construction supplies complete native metadata; no historical publication is read. */
export const currentHeldSource = await prepareSpecies(context).catch((error: unknown) => {
  rmSync(cache, { recursive: true, force: true }); throw error;
});
/** An unavailable declared native input cannot borrow a complete historical metadata document. */
export function currentHeldWithout(input: string): ReturnType<typeof prepareSpecies> {
  return prepareSpecies({ ...base, cached: (step, make) => base.cached({ ...step, id: 'omitted-held-source-input' }, loans => {
    const missing = new Map(loans); missing.delete(input); return make(missing);
  }) });
}
/** Removing a defining source helper from the real author bundle must refuse before publication. */
export function currentHeldEntryWithout(input: string): ReturnType<typeof build> {
  return build({ configFile: false, logLevel: 'silent', plugins: [{ name: 'omit-defining-held-source',
    load(id) { if (id.endsWith(input)) throw new Error('Defining held source helper omitted'); return null; },
  }], build: { write: false, minify: false,
    lib: { entry: 'src/shards/nalati-grasslands/shard.config.ts', formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
  } });
}
afterAll(() => { rmSync(cache, { recursive: true, force: true }); });
