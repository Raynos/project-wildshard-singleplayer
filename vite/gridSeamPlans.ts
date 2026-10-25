import type { Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

/** Keep the certifier's exact JSON bytes; only its small address enters JavaScript. */
export function gridSeamAsset(source: string): { fileName: string; source: string; address: { url: string; bytes: number; sha256: string } } {
  const baked: unknown = JSON.parse(source);
  if (typeof baked !== 'object' || baked === null || !Array.isArray(Reflect.get(baked, 'plans'))
    || !Array.isArray(Reflect.get(baked, 'edges'))) throw new Error('Grid seam bake needs plans and edges');
  const bytes = Buffer.byteLength(source);
  if (bytes === 0 || bytes > 16 * 1024 * 1024) throw new Error('Grid seam bake exceeds its transport cap');
  const sha256 = createHash('sha256').update(source).digest('hex'), fileName = `assets/grid-seams-${sha256.slice(0, 8)}.json`;
  return { fileName, source, address: { url: `/${fileName}`, bytes, sha256 } };
}

/** Certify the bundled catalogue after generation, before the page is bundled: its seam plans and each slug's edge source. */
export function gridSeamPlansPlugin(): Plugin {
  let asset: ReturnType<typeof gridSeamAsset> | undefined;
  return { name: 'wildshard-grid-seam-plans', enforce: 'post', apply: 'build', config() {
    asset = gridSeamAsset(execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', 'scripts/bake-grid-seams.mjs'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }));
    return { define: { __GRID_SEAM_ASSET__: JSON.stringify(asset.address) } };
  }, generateBundle() {
    if (asset === undefined) throw new Error('Grid seam bake was not prepared');
    this.emitFile({ type: 'asset', fileName: asset.fileName, source: asset.source });
  } };
}
