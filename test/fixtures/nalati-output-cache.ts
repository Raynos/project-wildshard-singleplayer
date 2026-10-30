// oxlint-disable-next-line import/no-nodejs-modules -- Own one genuinely cold source cache, or hydrate this run's exact fixture.
import { mkdtempSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Cache paths stay inside this fixture's private repository scratch root.
import { resolve, dirname } from 'node:path';
import { createProjectGeneration } from '../../src/sdk/projectGeneration';
import { prepareOutput } from '../../src/shards/nalati-grasslands/generators/output';
import { runSnapshot } from './runSnapshot';

// One genuinely empty cache owns native compilation during fixture preparation.
// The timed case still checks every complete cold/warm file and refusal below.
export const coldOutputFixture = await (async () => {
  const cache = mkdtempSync(resolve('tmp/nalati-place-blob-'));
  const requested: string[] = [], steps: string[] = [], constructions = new Map<string, number>();
  let nativeSpecimens: Uint8Array | undefined, nativePlaces: Uint8Array | undefined, nativeRender: Uint8Array | undefined;
  const context = () => {
    const ctx = createProjectGeneration(resolve('src/shards/nalati-grasslands'), 'a'.repeat(64), new Map(), cache,
      [{ prefix: '/src/shards/nalati-grasslands/', directory: resolve('src/shards/nalati-grasslands') },
        { prefix: '/assets/', directory: resolve('public/assets') }]);
    return { ...ctx, cached: (step: Parameters<typeof ctx.cached>[0], make: Parameters<typeof ctx.cached>[1]) => {
      requested.push(...(step.inputs ?? [])); steps.push(step.id);
      return ctx.cached(step, inputs => { constructions.set(step.id, (constructions.get(step.id) ?? 0) + 1); return make(inputs); }).then(files => {
        if (step.id === 'places') { nativePlaces = files.get('places.json'); nativeSpecimens = files.get('placeSpecimens.json'); }
        if (step.id === 'render-tiles') nativeRender = files.get('data/renderTiles.json');
        return files;
      });
    } };
  };
  try {
    let computed = false;
    const fixture = await runSnapshot('nalati-output-cache', async () => {
      computed = true;
      const output = await prepareOutput(context());
      const beforeWarm = new Map(constructions), warm = await prepareOutput(context());
      const files = new Map<string, Uint8Array>();
      for (const name of readdirSync(cache, { recursive: true, encoding: 'utf8' })) {
        if ((!name.endsWith('/index.json') && !/\/[0-9a-f]{64}$/u.test(name)) || !statSync(resolve(cache, name)).isFile()) continue;
        files.set(name, Uint8Array.from(readFileSync(resolve(cache, name))));
      }
      return { requested, steps, constructions, output, beforeWarm, warm, nativePlaces, nativeSpecimens, nativeRender, files };
    });
    if (!computed) {
      // These are the actual cold/warm producer bytes, not substituted test results.
      // New contexts still cross the real cache's input, key, size and hash checks.
      for (const [name, bytes] of fixture.files) {
        const file = resolve(cache, name); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, bytes);
      }
      requested.push(...fixture.requested); steps.push(...fixture.steps);
      for (const [name, count] of fixture.constructions) constructions.set(name, count);
      nativePlaces = fixture.nativePlaces; nativeSpecimens = fixture.nativeSpecimens; nativeRender = fixture.nativeRender;
    }
    const { output, beforeWarm, warm } = fixture;
    return { cache, requested, steps, constructions, context, output, beforeWarm, warm, get nativePlaces() { return nativePlaces; }, get nativeSpecimens() { return nativeSpecimens; }, get nativeRender() { return nativeRender; } };
  } catch (error) { rmSync(cache, { recursive: true, force: true }); throw error; }
})();
