// DL7 P3 + DL6 (owned and whole, G1008): bake each recorded home's cold seed with the runtime's own readers and
// snapshot writer. For every shard with src/shards/<slug>/home-seed-keys.json and each tier it lists, the built product
// (out/<slug>, the app build's input) is read headlessly and each recorded key is reproduced exactly as the grid Home's
// cold path builds it: `whole:` keys through readWholeGeometry with the key's own refs, `owned:` keys through
// readWorldSceneGeometry on the world-scene owned model whose template key matches (revisit true or false). A key that
// cannot be reproduced is skipped and reported on stderr; it decodes from its files at runtime as before.
//
//   node --experimental-transform-types --import ./scripts/bake-loader.mjs --input-type=module \
//     -e "await (await import('./scripts/app-build/homeSeed.ts')).bakeHomeSeeds(process.cwd(), process.argv[1])" <outDir>
// writes <outDir>/assets/home-seed/<slug>-<tier>.bin; scripts/app-build/entryTotals.ts lists it in that home's grid
// packs manifests (packs book only).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Matrix4, type BufferGeometry } from 'three';
import { Scope } from '../../src/engine/app/scope';
import { AssetService } from '../../src/engine/app/assets';
import { initializeTier, TIER, type Tier } from '../../src/engine/core/tier';
import { parseOutputIndex } from '../../src/format/outputIndex';
import { parseWorldScenes } from '../../src/format/worldScenes';
import { loadHeadlessProduct } from '../../src/sdk/headlessProduct';
import { readWholeGeometry } from '../../src/game/plugin/geometry';
import { provideRuntimeProduct } from '../../src/game/shardfile/runtimeProduct';
import { readWorldSceneGeometry, worldSceneTemplateKey } from '../../src/game/shardfile/worldSceneGeometry';
import { snapshotHomeGeometry, type HomeGeometrySnapshot } from '../../src/game/shardfile/homeGeometrySnapshot';
import { encodeHomeSeed, homeSeedKey, homeSeedPath, readHomeSeedKeys } from '../../src/game/shardfile/homeSeed';

/** An owned model's decode inputs, as the scene reader passes them (its file already picked for the tier). */
export interface OwnedSeedRow { readonly file: string; readonly segments?: readonly string[]; readonly attributes?: Readonly<Record<string, string>> }
interface GeometryProduct { readonly url: (name: string) => string; readonly file: (name: string) => Promise<Uint8Array> }

/** Each owned row's origin-free template key at the current tier, for both reuse policies the scene reader uses
 * (resident owned libraries read with revisit, late welds without), to the row and policy that give it. */
export function ownedSeedIndex(product: Pick<GeometryProduct, 'url'>, rows: readonly OwnedSeedRow[]): Map<string, { row: OwnedSeedRow; revisit: boolean }> {
  const index = new Map<string, { row: OwnedSeedRow; revisit: boolean }>();
  for (const row of rows) for (const revisit of [true, false]) {
    const key = homeSeedKey(`owned:${worldSceneTemplateKey(product, row, revisit)}`);
    if (!index.has(key)) index.set(key, { row, revisit });
  }
  return index;
}

/** The owned rows of a product's world-scene section, each file picked for `tier` (every declared model, any tier tag). */
export function ownedSceneRows(section: unknown, tier: Tier): OwnedSeedRow[] {
  const rows: OwnedSeedRow[] = [];
  for (const library of parseWorldScenes(section).libraries) {
    if (library.kind !== 'owned') continue;
    for (const model of library.models) {
      const file = typeof model.file === 'string' ? model.file : model.file[tier];
      rows.push({ file, ...(model.attributes === undefined ? {} : { attributes: model.attributes }), ...(model.segments === undefined ? {} : { segments: model.segments }) });
    }
  }
  return rows;
}

/** The runtime's own owned read (a fresh template), snapshotted as the cold path saves it: one 'model' view, identity matrix. */
export async function bakeOwnedEntry(product: GeometryProduct, row: OwnedSeedRow, revisit: boolean): Promise<HomeGeometrySnapshot | null> {
  const owner = new Scope('home-seed-owned'), assets = new AssetService<BufferGeometry>();
  try {
    const lease = await readWorldSceneGeometry(owner, product, row, assets, { revisit });
    const geometry = lease.copy();
    try { return snapshotHomeGeometry(new Map([['model', { geometry, matrix: new Matrix4() }]])); }
    finally { geometry.dispose(); lease.done(); }
  } finally {
    for (const entry of assets.retained()) assets.evictCached(entry.key);
    owner.dispose();
  }
}

/** The runtime's own whole read of exactly the key's refs, snapshotted before any release is attached (as it saves it). */
export async function bakeWholeEntry(source: Parameters<typeof provideRuntimeProduct>[0]['source'], assets: ReadonlyMap<string, Uint8Array>,
  base: string, refs: readonly string[]): Promise<HomeGeometrySnapshot | null> {
  const scope = new Scope('home-seed-whole');
  try {
    provideRuntimeProduct({ source, assets, cached: false }, scope, { base, offline: false, firstParty: true,
      fetch: () => Promise.reject(new Error('Home seed bakes read only the built product')),
      hash: wire => Promise.resolve(createHash('sha256').update(wire).digest('hex')) });
    const views = await readWholeGeometry(scope, source, refs, () => Promise.resolve());
    return snapshotHomeGeometry(views);
  } finally { scope.dispose(); }
}

const parseJson = (text: string): unknown => { try { return JSON.parse(text); } catch { return undefined; } };
const TIERS: readonly Tier[] = ['phone', 'desktop'];

/** Bake every recorded seed into `<outDir>/assets/home-seed/`. Returns the files written. */
export async function bakeHomeSeeds(root: string, outDir: string, report: (line: string) => void = line => { process.stderr.write(`${line}\n`); }): Promise<string[]> {
  const target = resolve(outDir, 'assets/home-seed'), written: string[] = [], tierBefore = TIER;
  rmSync(target, { recursive: true, force: true });
  const shards = join(root, 'src/shards');
  try {
    for (const slug of readdirSync(shards).sort()) {
      const keysPath = join(shards, slug, 'home-seed-keys.json'); if (!existsSync(keysPath)) continue;
      const productDir = join(root, 'out', slug);
      if (!existsSync(join(productDir, 'shard.json'))) { report(`[home seed] ${slug}: no built product at out/${slug}; skipped`); continue; }
      const recorded = readHomeSeedKeys(JSON.parse(readFileSync(keysPath, 'utf8')));
      const product = await loadHeadlessProduct(productDir), index = parseOutputIndex(JSON.parse(readFileSync(join(productDir, 'shard.json'), 'utf8')));
      // Product URLs as the page names them (`/shardfiles/<slug>/…`), without an origin: the seed keys' own form.
      const outRoot = pathToFileURL(`${realpathSync(join(root, 'out'))}/`).pathname, base = `http://seed.invalid/shardfiles/${slug}/`;
      const url = (name: string): string => {
        const path = new URL(product.url(name)).pathname;
        if (!path.startsWith(outRoot)) throw new Error(`Home seed product URL outside out/: ${name}`);
        return `http://seed.invalid/shardfiles/${path.slice(outRoot.length)}`;
      };
      const geometryProduct: GeometryProduct = { url, file: name => product.file(name) };
      for (const tier of TIERS) {
        const keys = recorded.tiers[tier]; if (keys === undefined || keys.length === 0) continue;
        initializeTier(tier);
        const owned = product.has('world/scenes') ? ownedSeedIndex(geometryProduct, ownedSceneRows(product.section('world/scenes'), tier))
          : new Map<string, { row: OwnedSeedRow; revisit: boolean }>();
        const entries = new Map<string, HomeGeometrySnapshot>(), skipped: string[] = [];
        for (const key of keys) {
          const prefix = key.slice(0, key.indexOf(':'));
          try {
            let snapshot: HomeGeometrySnapshot | null = null;
            if (prefix === 'whole') {
              const parsed = parseJson(key.slice('whole:'.length));
              if (!Array.isArray(parsed) || parsed[1] !== tier || !Array.isArray(parsed[0]) || !parsed[0].every((ref: unknown): ref is string => typeof ref === 'string')) { skipped.push(`${key.slice(0, 80)}: not a ${tier} whole key`); continue; }
              const refs: string[] = parsed[0], assets = new Map<string, Uint8Array>();
              for (const ref of refs) {
                const row = index.files.find(file => file.hash === ref.replace(/^commons:/u, ''));
                if (row === undefined) throw new Error(`whole input ${ref} is not a file of this product`);
                assets.set(ref, Uint8Array.from(readFileSync(join(productDir, row.path))));
              }
              snapshot = await bakeWholeEntry(product.shardfile, assets, base, refs);
            } else if (prefix === 'owned') {
              const match = owned.get(key);
              if (match === undefined) { skipped.push(`${key.slice(0, 120)}: no world-scene owned model gives this template key`); continue; }
              snapshot = await bakeOwnedEntry(geometryProduct, match.row, match.revisit);
            } else { skipped.push(`${key.slice(0, 80)}: no baker for '${prefix}:' keys`); continue; }
            if (snapshot === null) { skipped.push(`${key.slice(0, 80)}: the snapshot writer refused its geometry`); continue; }
            entries.set(key, snapshot);
          } catch (error) { skipped.push(`${key.slice(0, 80)}: ${error instanceof Error ? error.message : String(error)}`); }
        }
        for (const line of skipped) report(`[home seed] ${slug} ${tier}: skipped ${line}`);
        if (entries.size === 0) continue;
        const bytes = encodeHomeSeed(entries), file = join(outDir, homeSeedPath(slug, tier).slice(1));
        mkdirSync(target, { recursive: true }); writeFileSync(file, bytes); written.push(file);
        report(`[home seed] ${slug} ${tier}: ${String(entries.size)} of ${String(keys.length)} keys, ${(bytes.length / 1e6).toFixed(1)} MB`);
      }
    }
  } finally { initializeTier(tierBefore); }
  return written;
}
