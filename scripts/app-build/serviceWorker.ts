/**
 * The service worker (project/archive/2026-09-22-load-perf.md §P3, docs/design/cache-policy.md), written after the web
 * build from what it wrote (D24, G799: was vite/pwa-plugin.ts's output hook). A tiny `sw.js` bootstrap imports a
 * SHA-256-named core from `src/engine/pwa/sw.js`, with these stamps baked into that immutable core:
 *   __BUILD_ID__  `<BUILD_ID>-<hash of every emitted file + the public/ list>`. A deploy that changes bytes is
 *                 a byte-different worker (the browser installs it, the build pill adopts it); a REBUILD OF THE
 *                 SAME TREE is the same worker. (BUILD_ID alone carries `Date.now()` — on its own it would make
 *                 every rebuild a new cache name, and `activate` would then drop the player's shell each time.)
 *   __ASSET_ID__  a hash of the public/assets (+ basis, fonts) files' CONTENT alone (E160: it was list + sizes), so the
 *                 static cache survives a JS-only deploy, and any byte change to the art names a new one (activate
 *                 then keeps, by content hash, every entry that is still current — src/engine/pwa/sw.js).
 *   __BUNDLE__    every emitted content URL: the cache identity/prune list; cached on first use.
 *   __WARM__      only public entry closures, warmed after the page is usable.
 *   __INSTALL__   the complete static entry graph and CSS, strictly cached at install. Lazy code stays off that path.
 *   __FONTS__     the self-hosted `/fonts/*.woff2`: precached at install, so an offline launch has its type even though
 *                 the first visit's CSS asked for them before the worker controlled the page (project/archive/2026-09-23-preload-offline.md).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { hashTree } from './assetHashes';
import { PRODUCT_CACHE_NAME } from '../../src/engine/pwa/cacheNames';
import { bootModuleFiles } from './bootModules';
import { writtenBundle, type EmittedFile } from './writtenBundle';
import { readModuleFiles } from '../../src/engine/boot/download';
import { manifestFolders, shardProducts, outputManifest } from '../shard-outputs.mjs';

/** Card metadata may be visible while its experimental entry stays locked.
 * Only ordinary public admission seeds speculative executable downloads. */
export function publicWorkerProduct(slug: string, input: unknown): boolean {
  const row = metadata(input);
  if (typeof row.status !== 'string' || !['live', 'earlyAccess', 'experimental', 'hidden'].includes(row.status)
    || row.legacy !== undefined && typeof row.legacy !== 'boolean'
    || row.shardSelect !== undefined && typeof row.shardSelect !== 'boolean') throw new Error('Invalid worker public-entry metadata');
  return !slug.startsWith('_') && row.status !== 'hidden' && row.status !== 'experimental' && row.legacy !== true && row.shardSelect !== false;
}

/** Frozen TS manifests are reference-only and do not seed downloads. */
function publicProducts(root: string): string[] {
  return shardProducts(root, manifestFolders(root)).flatMap(product => {
    const file = join(root, 'src/shards', product.folder, 'manifest.json');
    if (!existsSync(file)) return [];
    const value: unknown = product.output === null ? JSON.parse(readFileSync(file, 'utf8')) : outputManifest(root, product.folder, product.output);
    return publicWorkerProduct(product.slug, value) ? [product.slug] : [];
  });
}
interface WarmMetadata extends Record<string, unknown> {
  status?: unknown; legacy?: unknown; shardSelect?: unknown;
  selection?: unknown; optional?: unknown; groups?: unknown; files?: unknown;
  common?: unknown; client?: unknown; grid?: unknown;
}
function metadata(value: unknown): WarmMetadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid worker warm metadata');
  return value as WarmMetadata;
}

/** Use the same build-owned static closures as the public loading bar. Never
 * traverse arbitrary dynamic imports: those include Explore, legacy and tools.
 * Full BUNDLE remains the prune/cache-on-use inventory, independently of WARM. */
export function workerWarmFiles(input: unknown, products: readonly string[], title: readonly string[]): string[] {
  const bank = metadata(input), selected = metadata(bank.selection), optional = metadata(bank.optional);
  const groups = metadata(optional.groups), files = readModuleFiles(optional.files);
  const result = new Set(title);
  const add = (rows: unknown): void => { for (const [url] of readModuleFiles(rows)) result.add(url); };
  add(bank.common); add(bank.client); add(bank.grid);
  for (const slug of products) {
    add(selected[slug]);
    const group = groups[`home:/shardfiles/${slug}/`];
    if (!Array.isArray(group)) throw new Error(`Missing public worker warm group: ${slug}`);
    for (const index of group) {
      if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || files[index] === undefined) throw new Error('Invalid worker warm module index');
      const file = files[index]; if (file !== undefined) result.add(file[0]);
    }
  }
  return [...result].sort((a, b) => a.localeCompare(b));
}

/** `<name>:<bytes>` over a sorted file list, hashed — deterministic, and it moves only when bytes do. */
function contentStamp(rows: string[]): string {
  return createHash('sha256').update([...rows].sort().join('\n')).digest('hex').slice(0, 10);
}

/**
 * `<rel>:<content hash>` for every file under public/<sub>, sorted — the unhashed assets the static cache holds. By
 * CONTENT, not size (E160): a same-size edit or re-bake used to keep the cache's name, and the worker went on serving the
 * old bytes under the old key.
 */
function publicStamp(root: string, subs: string[]): string[] {
  const rows: string[] = [];
  for (const sub of subs) for (const [p, h] of Object.entries(hashTree(sub, root))) rows.push(`${p.slice(1)}:${h}`);
  return rows;
}

/** The browser's top-level update check stays tiny; imports name their exact immutable bytes. */
export function workerScripts(core: string): { fileName: string; bootstrap: string } {
  const fileName = `sw-core/${createHash('sha256').update(core).digest('hex')}.js`;
  return { fileName, bootstrap: `importScripts(${JSON.stringify(`/${fileName}`)});\n` };
}

/** Install only the selected document entry graph, not other HTML entries or lazy shard chunks.
 * CSS remains critical even when the bundler extracts it from the import graph. */
export function workerInstallFiles(bundle: Readonly<Record<string, {
  readonly type: string; readonly isEntry?: boolean; readonly facadeModuleId?: string | null; readonly imports?: readonly string[];
} | undefined>>, document: string): string[] {
  const files = new Set<string>();
  const visit = (name: string): void => {
    if (files.has(name)) return;
    const item = bundle[name];
    if (item === undefined) throw new Error(`Missing worker install dependency: ${name}`);
    files.add(name);
    for (const dependency of item.imports ?? []) visit(dependency);
  };
  const entries = Object.entries(bundle).filter(([, item]) => item?.type === 'chunk' && item.isEntry === true && item.facadeModuleId === document);
  if (entries.length !== 1) throw new Error('Missing or ambiguous worker document entry');
  for (const [name] of entries) visit(name);
  for (const name of Object.keys(bundle)) if (name.endsWith('.css')) visit(name);
  return [...files].sort().map(name => `/${name}`);
}

/** The worker core for a written bundle: its stamps over the emitted files, the public static assets and the boot
 *  module bank in index.html. `buildId` is the bundle's own BUILD_ID (version.json). */
export function serviceWorkerCore(bundle: Readonly<Record<string, EmittedFile>>, root: string, buildId: string): { core: string; build: string; assets: string; hashed: string[] } {
  const src = `${readFileSync(join(root, 'src/engine/app/workerScope.js'), 'utf8').replaceAll(/^export /gm, '')}\n${readFileSync(join(root, 'src/engine/pwa/sw.js'), 'utf8').replace("import { workerScope } from '../app/workerScope.js';\n", '')}`;
  const fontDir = join(root, 'public', 'fonts');
  const fonts = existsSync(fontDir) ? readdirSync(fontDir).filter(f => f.endsWith('.woff2')).sort().map(f => `/fonts/${f}`) : [];
  const assetRows = publicStamp(root, ['assets', 'basis', 'fonts']);
  const assets = contentStamp(assetRows);
  const emitted = Object.entries(bundle)
    .filter(([name]) => !name.endsWith('.map') && name !== 'sw.js' && name !== 'version.json' && !name.startsWith('sw-core/'))
    .map(([name, item]) => `${name}:${item.type === 'chunk' ? Buffer.byteLength(item.code ?? '') : item.source?.byteLength ?? 0}`);
  const build = `${buildId}-${contentStamp([...emitted, ...assetRows])}`;
  const hashed = Object.keys(bundle).filter(name => /^assets\/[^/]+-[\w-]{8}\.\w+$/.test(name)).map(name => `/${name}`).sort();
  const html = bundle['index.html'];
  if (html?.type !== 'asset' || html.source === undefined) throw new Error('Missing worker warm document');
  const bank = /<script type="application\/json" id="boot-module-files">([^<]+)<\/script>/u.exec(new TextDecoder().decode(html.source))?.[1];
  if (bank === undefined) throw new Error('Missing worker warm module bank');
  const input: unknown = JSON.parse(bank);
  const title = bootModuleFiles(bundle, ['src/engine/ui/StartTitle.ts', 'src/game/mainMenu.ts', 'src/shardSelection.ts'].map(file => join(root, file))).map(row => row[0]);
  const install = workerInstallFiles(bundle, join(root, 'index.html'));
  const warm = workerWarmFiles(input, publicProducts(root), [...install, ...title]);
  if (warm.some(file => !hashed.includes(file))) throw new Error('Worker warm file is absent from the emitted bundle');
  const core = src.replaceAll('__BUILD_ID__', build).replaceAll('__ASSET_ID__', assets).replace("'__BUNDLE__'", JSON.stringify(JSON.stringify(hashed)))
    .replace("'__INSTALL__'", JSON.stringify(JSON.stringify(install))).replace("'__WARM__'", JSON.stringify(JSON.stringify(warm)))
    .replace("'__FONTS__'", JSON.stringify(JSON.stringify(fonts))).replace('__PRODUCT_CACHE__', PRODUCT_CACHE_NAME);
  return { core, build, assets, hashed };
}

/** Write `sw.js` and its core beside the web bundle in `outDir` (scripts/build-app.mjs runs it after the chunk report). */
export function writeServiceWorker(outDir: string, root: string): void {
  const { build: buildId } = JSON.parse(readFileSync(join(outDir, 'version.json'), 'utf8')) as { build: string };
  const { core, build, assets, hashed } = serviceWorkerCore(writtenBundle(outDir, root), root, buildId), scripts = workerScripts(core);
  mkdirSync(dirname(join(outDir, scripts.fileName)), { recursive: true });
  writeFileSync(join(outDir, scripts.fileName), core);
  writeFileSync(join(outDir, 'sw.js'), scripts.bootstrap);
  console.log(`sw.js written (ws-shell-${build}, ws-static-${assets}, ws-immutable: ${hashed.length} files)`);
}
