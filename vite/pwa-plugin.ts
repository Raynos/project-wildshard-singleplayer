/**
 * PWA plugin (project/archive/2026-09-22-load-perf.md §P3, docs/design/cache-policy.md). Ported from the `trials:pwa` plugin
 * in game-demos/trials-gauntlet-demo/vite.config.ts.
 *
 * Build: emits a tiny `sw.js` bootstrap importing a SHA-256-named core from
 * `src/engine/pwa/sw.js`, with three stamps baked into that immutable core.
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
 *
 * Preview: replays the `vercel.json` header rules (last match wins, same as the host) so the bench measures
 * what production sends — `immutable` on the hashed bundle, revalidated `sw.js`, no-store document/version.json.
 *
 * Dev: no service worker by default — a stale worker would serve yesterday's bundle over HMR. `/sw.js` is
 * served (stamped `dev`) only when the page was opened with `?sw=1`; src/engine/boot/sw.ts registers it only then.
 */
import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { hashTree } from './assetHashes';
import { PRODUCT_CACHE_NAME } from '../src/engine/pwa/cacheNames';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { bootModuleFiles } from './bootModules';
import { readModuleFiles } from '../src/engine/boot/download';
import { manifestFolders, shardProducts, outputManifest } from '../scripts/shard-outputs.mjs';

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

interface HeaderRule { source: string; headers: { key: string; value: string }[] }

/** The browser's top-level update check stays tiny; imports name their exact immutable bytes. */
export function workerScripts(core: string): { fileName: string; bootstrap: string } {
  const fileName = `sw-core/${createHash('sha256').update(core).digest('hex')}.js`;
  return { fileName, bootstrap: `importScripts(${JSON.stringify(`/${fileName}`)});\n` };
}

/** Install the complete static entry graph, not every lazy shard chunk.
 * CSS remains critical even when the bundler extracts it from the import graph. */
export function workerInstallFiles(bundle: Readonly<Record<string, {
  readonly type: string; readonly isEntry?: boolean; readonly imports?: readonly string[];
} | undefined>>): string[] {
  const files = new Set<string>();
  const visit = (name: string): void => {
    if (files.has(name)) return;
    const item = bundle[name];
    if (item === undefined) throw new Error(`Missing worker install dependency: ${name}`);
    files.add(name);
    for (const dependency of item.imports ?? []) visit(dependency);
  };
  for (const [name, item] of Object.entries(bundle)) {
    if ((item?.type === 'chunk' && item.isEntry === true) || name.endsWith('.css')) visit(name);
  }
  return [...files].sort().map(name => `/${name}`);
}

/**
 * `vercel.json` `source` → RegExp. Only the forms the file uses: literal paths and `(.*)` groups
 * (Vercel's path-to-regexp escapes everything else, `.` included).
 */
function sourceRegex(source: string): RegExp {
  const esc = (s: string) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return new RegExp(`^${source.split('(.*)').map(esc).join('(.*)')}/?$`);
}

function vercelHeaders(root: string): { re: RegExp; headers: { key: string; value: string }[] }[] {
  const p = join(root, 'vercel.json');
  if (!existsSync(p)) return [];
  const rules = (JSON.parse(readFileSync(p, 'utf8')) as { headers?: HeaderRule[] }).headers ?? [];
  return rules.map((r) => ({ re: sourceRegex(r.source), headers: r.headers }));
}

export function pwaPlugin(buildId: string): Plugin {
  let root = process.cwd();
  const swSource = () => `${readFileSync(join(root, 'src/engine/app/workerScope.js'), 'utf8').replaceAll(/^export /gm, '')}\n${readFileSync(join(root, 'src/engine/pwa/sw.js'), 'utf8').replace("import { workerScope } from '../app/workerScope.js';\n", '')}`;
  const fonts = (): string[] => { const dir = join(root, 'public', 'fonts'); return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.woff2')).sort().map((f) => `/fonts/${f}`) : []; };
  const stamp = (src: string, build: string, assets: string, bundle: string[], install: string[], warm: string[]) =>
    src.replaceAll('__BUILD_ID__', build).replaceAll('__ASSET_ID__', assets).replace("'__BUNDLE__'", JSON.stringify(JSON.stringify(bundle))).replace("'__INSTALL__'", JSON.stringify(JSON.stringify(install))).replace("'__WARM__'", JSON.stringify(JSON.stringify(warm))).replace("'__FONTS__'", JSON.stringify(JSON.stringify(fonts()))).replace('__PRODUCT_CACHE__', PRODUCT_CACHE_NAME);
  return {
    name: 'wildshard-pwa',
    configResolved(c) {
      root = c.root;
    },
    // `post`: after vite:css-post has emitted the one stylesheet (cssCodeSplit off) — before, BUNDLE never named it, so the
    // worker never precached it and every activation pruned it: an offline launch after an update had no styles (E144)
    generateBundle: { order: 'post', handler(_o, bundle) {
      const src = swSource();
      const assetRows = publicStamp(root, ['assets', 'basis', 'fonts']);
      const assets = contentStamp(assetRows);
      const emitted = Object.entries(bundle)
        .filter(([name]) => !name.endsWith('.map') && name !== 'sw.js' && name !== 'version.json')
        .map(([name, item]) => `${name}:${item.type === 'chunk' ? Buffer.byteLength(item.code) : Buffer.byteLength(item.source)}`);
      const build = `${buildId}-${contentStamp([...emitted, ...assetRows])}`;
      const hashed = Object.keys(bundle).filter((name) => /^assets\/[^/]+-[\w-]{8}\.\w+$/.test(name)).map((name) => `/${name}`).sort();
      const html = bundle['index.html'];
      if (html?.type !== 'asset' || typeof html.source !== 'string') throw new Error('Missing worker warm document');
      const bank = /<script type="application\/json" id="boot-module-files">([^<]+)<\/script>/u.exec(html.source)?.[1];
      if (bank === undefined) throw new Error('Missing worker warm module bank');
      const input: unknown = JSON.parse(bank);
      const title = bootModuleFiles(bundle, ['src/engine/ui/StartTitle.ts', 'src/game/mainMenu.ts', 'src/shardSelection.ts'].map(file => join(root, file))).map(row => row[0]);
      const warm = workerWarmFiles(input, publicProducts(root), [...workerInstallFiles(bundle), ...title]);
      if (warm.some(file => !hashed.includes(file))) throw new Error('Worker warm file is absent from the emitted bundle');
      const core = stamp(src, build, assets, hashed, workerInstallFiles(bundle), warm), scripts = workerScripts(core);
      this.emitFile({ type: 'asset', fileName: scripts.fileName, source: core });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: scripts.bootstrap });
      this.info(`sw.js emitted (ws-shell-${build}, ws-static-${assets}, ws-immutable: ${hashed.length} files)`);
    } },
    // Preview mirrors the production host: the same vercel.json rules, last match wins per header.
    configurePreviewServer(server) {
      const rules = vercelHeaders(root);
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const pathname = req.url?.split('?')[0] ?? '';
        for (const r of rules) if (r.re.test(pathname)) for (const h of r.headers) res.setHeader(h.key, h.value);
        if (pathname === '/sw.js' || pathname.startsWith('/sw-core/')) {
          // The public worker is identical for every Origin, like production.
          // Preview CORS otherwise splits WebKit's HTTP cache between a soft
          // navigation update (Origin present) and reg.update() (absent).
          const value = res.getHeader('Vary');
          const varying = (Array.isArray(value) ? value.join(',') : String(value ?? '')).split(',')
            .map(part => part.trim()).filter(part => part !== '' && part.toLowerCase() !== 'origin');
          if (varying.length === 0) res.removeHeader('Vary');
          else res.setHeader('Vary', varying.join(', '));
          res.setHeader('Access-Control-Allow-Origin', '*');
        }
        next();
      });
    },
    // Dev: only ever hand out a worker to a page that asked for one (`?sw=1`); src/engine/boot/sw.ts unregisters otherwise.
    configureServer(server) {
      server.middlewares.use('/sw.js', (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Cache-Control', 'no-store');
        if (!/[?&]sw=1/.test(req.url ?? '')) {
          res.statusCode = 404;
          res.end('no service worker in dev (open the page with ?sw=1)');
          return;
        }
        res.setHeader('Content-Type', 'text/javascript');
        res.end(stamp(swSource(), `dev-${buildId}`, 'dev', [], [], []));
      });
    },
  };
}
