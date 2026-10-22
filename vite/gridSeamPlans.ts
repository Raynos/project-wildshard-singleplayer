import type { Plugin } from 'vite';
import { execFileSync } from 'node:child_process';

/** Certify the bundled catalogue after generation, before the page is bundled: its seam plans and each slug's edge source. */
export function gridSeamPlansPlugin(): Plugin {
  return { name: 'wildshard-grid-seam-plans', enforce: 'post', apply: 'build', config() {
    const baked: unknown = JSON.parse(execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', 'scripts/bake-grid-seams.mjs'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }));
    const plans: unknown = typeof baked === 'object' && baked !== null ? Reflect.get(baked, 'plans') : undefined;
    const edges: unknown = typeof baked === 'object' && baked !== null ? Reflect.get(baked, 'edges') : undefined;
    if (!Array.isArray(plans) || !Array.isArray(edges)) throw new Error('Grid seam bake needs plans and edges');
    return { define: { __GRID_SEAM_PLANS__: JSON.stringify(plans), __GRID_EDGES__: JSON.stringify(edges) } };
  } };
}
