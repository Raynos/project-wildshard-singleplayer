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
/** Common URL/tier/audio facts are shared; each selected pack bank has its own bytes. */
export function assetTableBanks(source: string): { common: ReturnType<typeof assetTableAsset>; all: ReturnType<typeof assetTableAsset>; packs: Record<string, ReturnType<typeof assetTableAsset>> } {
  const input: unknown = JSON.parse(source);
  if (typeof input !== 'object' || input === null || !('common' in input) || typeof input.common !== 'string'
    || !('all' in input) || typeof input.all !== 'string' || !('packs' in input) || typeof input.packs !== 'object' || input.packs === null) throw new Error('Invalid generated table banks');
  const packs: Record<string, ReturnType<typeof assetTableAsset>> = {};
  for (const [slug, value] of Object.entries(input.packs)) {
    if (!/^[a-z0-9_-]+$/u.test(slug) || typeof value !== 'string') throw new Error('Invalid generated pack bank');
    packs[slug] = assetTableAsset(value);
  }
  return { common: assetTableAsset(input.common), all: assetTableAsset(input.all), packs };
}
export function assetTablesPlugin(): Plugin {
  let assets: ReturnType<typeof assetTableAsset>[] = [];
  return { name: 'wildshard-asset-tables', enforce: 'post', config() {
    const banks = assetTableBanks(execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', 'scripts/serialize-asset-tables.mjs'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] }));
    assets = [...new Map([banks.common, banks.all, ...Object.values(banks.packs)].map(asset => [asset.fileName, asset])).values()];
    return { define: { __BOOT_TABLE_ASSETS__: JSON.stringify({ common: banks.common.address, all: banks.all.address,
      packs: Object.fromEntries(Object.entries(banks.packs).map(([slug, asset]) => [slug, asset.address])) }) } };
  }, generateBundle() {
    if (assets.length === 0) throw new Error('Asset tables were not prepared');
    for (const asset of assets) this.emitFile({ type: 'asset', fileName: asset.fileName, source: asset.source });
  }, configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const asset = assets.find(row => request.url === row.address.url);
      if (asset === undefined) { next(); return; }
      response.setHeader('Content-Type', 'application/json'); response.end(asset.source);
    });
  } };
}
