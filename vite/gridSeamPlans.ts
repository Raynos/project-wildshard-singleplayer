import type { Plugin } from 'vite';
import { execFileSync } from 'node:child_process';

/** Certify the bundled catalogue after generation, before the page is bundled. */
export function gridSeamPlansPlugin(): Plugin {
  return { name: 'wildshard-grid-seam-plans', enforce: 'post', apply: 'build', config() {
    const plans = execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', 'scripts/bake-grid-seams.mjs'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] });
    return { define: { __GRID_SEAM_PLANS__: plans } };
  } };
}
