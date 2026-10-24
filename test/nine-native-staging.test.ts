// oxlint-disable-next-line import/no-nodejs-modules -- Remove only the regression's owned sealed stages.
import { rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the original author loader without opening a browser.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve declared source paths inside each sealed stage.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { discoverGeneration, generationInputs } from '../scripts/generate.mjs';
import { stageGenerationInputs } from '../scripts/generation-stage.mjs';
import { linkNodeModules } from '../scripts/link-node-modules.mjs';

test('the retained native sign page bundles from only its sealed declared sources', async () => {
  const root = process.cwd(), validator = 'src/shards/nine-dragon-stack/generators/sections.ts';
  const job = discoverGeneration(root).jobs.find(row => row.id === 'nine-sign-atlas');
  if (job === undefined) throw new Error('Missing retained sign raster adapter');
  const check = async (roots: readonly string[]) => {
    // generate.mjs always includes the format infrastructure; the descriptor owns its new validator.
    const inputs = Object.entries(generationInputs(root, [...roots, 'src/format'])).map(([file, hash]) => ({ file, hash, source: resolve(root, file) }));
    const tree = await stageGenerationInputs({ root, job: 'nine-sign-bundle', inputs });
    try {
      linkNodeModules(root, tree);
      const probe = resolve(tree, 'src/shards/nine-dragon-stack/generators/probe.mjs');
      writeFileSync(probe, 'import { parseSignView } from "./sections.ts"; import rows from "../data/signView.json" with {type:"json"}; parseSignView(rows);');
      const native = spawnSync(process.execPath, ['--experimental-transform-types', '--import', './src/sdk/bake/source-loader.mjs', probe], { cwd: tree, encoding: 'utf8' });
      // The browser painter bundles even without the Node-only validator and its format graph.
      await build({ configFile: false, logLevel: 'silent', publicDir: false, root: tree,
        build: { write: false, target: 'esnext', minify: false,
          lib: { entry: resolve(tree, 'src/shards/nine-dragon-stack/generators/signAtlasPage.ts'), formats: ['iife'], name: 'NineSignBake' },
          rolldownOptions: { output: { codeSplitting: false } } } });
      return native;
    } finally { rmSync(tree, { recursive: true, force: true }); }
  };
  const absent = await check(job.inputRoots.filter(file => file !== validator));
  expect(absent.status).toBe(1); expect(absent.stderr).toContain('sections.ts');
  const present = await check(job.inputRoots);
  expect(present.status, present.stderr).toBe(0);
});
