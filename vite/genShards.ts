import type { Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { generateBootTables } from './gen';

/** Generate before any baker imports the registry, including direct `vite build` on a clean export. */
export function genShardsPlugin(): Plugin {
  return {
    name: 'wildshard-generate',
    enforce: 'pre',
    config() {
      execFileSync(process.execPath, ['scripts/gen-shards.mjs'], { stdio: 'inherit' });
      for (const baker of ['bake-chunk', 'bake-sky']) {
        try { execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', `scripts/${baker}.mjs`], { stdio: 'inherit' }); }
        catch (error) { console.warn(`[bake] ${baker} failed — launch retains its analytic fallback`, error); }
      }
      generateBootTables();
      // Tables can add static imports to a manifest's closure.
      execFileSync(process.execPath, ['scripts/gen-shards.mjs'], { stdio: 'inherit' });
    },
  };
}
