import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/** Move the exact generated values across a JSON transport, not into compiled JS. */
export function assetTableAsset(source: string): { fileName: string; source: string; address: { url: string; bytes: number; sha256: string } } {
  const bytes = Buffer.byteLength(source);
  if (bytes < 2 || bytes > 16 * 1024 * 1024) throw new Error('Asset tables exceed their transport cap');
  const sha256 = createHash('sha256').update(source).digest('hex'), fileName = `assets/boot-tables-${sha256.slice(0, 8)}.json`;
  return { source, fileName, address: { url: `/${fileName}`, bytes, sha256 } };
}
export function assetTablesPlugin(): Plugin {
  let asset: ReturnType<typeof assetTableAsset> | undefined;
  return { name: 'wildshard-asset-tables', enforce: 'post', config() {
    asset = assetTableAsset(execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', 'scripts/serialize-asset-tables.mjs'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }));
    return { define: { __BOOT_TABLE_ASSET__: JSON.stringify(asset.address) } };
  }, generateBundle() {
    if (asset === undefined) throw new Error('Asset tables were not prepared');
    this.emitFile({ type: 'asset', fileName: asset.fileName, source: asset.source });
  }, configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (asset === undefined || request.url !== asset.address.url) { next(); return; }
      response.setHeader('Content-Type', 'application/json'); response.end(asset.source);
    });
  } };
}
