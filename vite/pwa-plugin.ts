/**
 * PWA plugin (project/archive/2026-09-22-load-perf.md §P3, docs/design/cache-policy.md). Ported from the `trials:pwa` plugin
 * in game-demos/trials-gauntlet-demo/vite.config.ts.
 *
 * Build: emits `sw.js` from `src/pwa/sw.js` with three stamps baked in.
 *   __BUILD_ID__  `<BUILD_ID>-<hash of every emitted file + the public/ list>`. A deploy that changes bytes is
 *                 a byte-different worker (the browser installs it, the build pill adopts it); a REBUILD OF THE
 *                 SAME TREE is the same worker. (BUILD_ID alone carries `Date.now()` — on its own it would make
 *                 every rebuild a new cache name, and `activate` would then drop the player's shell each time.)
 *   __ASSET_ID__  a hash of the public/assets file list + sizes alone, so the static cache (the 70 MB of
 *                 unhashed art) survives a JS-only deploy instead of being re-downloaded.
 *   __BUNDLE__    the emitted `/assets/<name>-<hash>.*` paths: precached at install, and the prune list.
 *   __FONTS__     the self-hosted `/fonts/*.woff2`: precached at install, so an offline launch has its type even though
 *                 the first visit's CSS asked for them before the worker controlled the page (project/archive/2026-09-23-preload-offline.md).
 *
 * Preview: replays the `vercel.json` header rules (last match wins, same as the host) so the bench measures
 * what production sends — `immutable` on the hashed bundle, `no-store` on the document/sw.js/version.json.
 *
 * Dev: no service worker by default — a stale worker would serve yesterday's bundle over HMR. `/sw.js` is
 * served (stamped `dev`) only when the page was opened with `?sw=1`; src/boot/sw.ts registers it only then.
 */
import type { Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** `<name>:<bytes>` over a sorted file list, hashed — deterministic, and it moves only when bytes do. */
function contentStamp(rows: string[]): string {
  return createHash('sha256').update([...rows].sort().join('\n')).digest('hex').slice(0, 10);
}

/** `<rel>:<size>` for every file under public/<sub>, sorted — the unhashed assets the static cache holds. */
function publicStamp(root: string, subs: string[]): string[] {
  const rows: string[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.DS_Store') continue;
      if (e.isDirectory()) walk(join(dir, e.name), `${rel}${e.name}/`);
      else rows.push(`${rel}${e.name}:${statSync(join(dir, e.name)).size}`);
    }
  };
  for (const sub of subs) {
    const dir = join(root, 'public', sub);
    if (existsSync(dir)) walk(dir, `${sub}/`);
  }
  return rows;
}

interface HeaderRule { source: string; headers: { key: string; value: string }[] }

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
  const swSource = () => readFileSync(join(root, 'src', 'pwa', 'sw.js'), 'utf8');
  const fonts = (): string[] => { const dir = join(root, 'public', 'fonts'); return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.woff2')).sort().map((f) => `/fonts/${f}`) : []; };
  const stamp = (src: string, build: string, assets: string, bundle: string[]) =>
    src.replaceAll('__BUILD_ID__', build).replaceAll('__ASSET_ID__', assets).replace("'__BUNDLE__'", JSON.stringify(JSON.stringify(bundle))).replace("'__FONTS__'", JSON.stringify(JSON.stringify(fonts())));
  return {
    name: 'wildshard-pwa',
    configResolved(c) {
      root = c.root;
    },
    generateBundle(_o, bundle) {
      const src = swSource();
      const assetRows = publicStamp(root, ['assets', 'basis', 'fonts']);
      const assets = contentStamp(assetRows);
      const emitted = Object.entries(bundle)
        .filter(([name]) => !name.endsWith('.map') && name !== 'sw.js' && name !== 'version.json')
        .map(([name, item]) => `${name}:${item.type === 'chunk' ? Buffer.byteLength(item.code) : Buffer.byteLength(item.source)}`);
      const build = `${buildId}-${contentStamp([...emitted, ...assetRows])}`;
      const hashed = Object.keys(bundle).filter((name) => /^assets\/[^/]+-[\w-]{8}\.\w+$/.test(name)).map((name) => `/${name}`).sort();
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: stamp(src, build, assets, hashed) });
      this.info(`sw.js emitted (ws-shell-${build}, ws-static-${assets}, ws-immutable: ${hashed.length} files)`);
    },
    // Preview mirrors the production host: the same vercel.json rules, last match wins per header.
    configurePreviewServer(server) {
      const rules = vercelHeaders(root);
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const pathname = req.url?.split('?')[0] ?? '';
        for (const r of rules) if (r.re.test(pathname)) for (const h of r.headers) res.setHeader(h.key, h.value);
        next();
      });
    },
    // Dev: only ever hand out a worker to a page that asked for one (`?sw=1`); src/boot/sw.ts unregisters otherwise.
    configureServer(server) {
      server.middlewares.use('/sw.js', (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Cache-Control', 'no-store');
        if (!/[?&]sw=1/.test(req.url ?? '')) {
          res.statusCode = 404;
          res.end('no service worker in dev (open the page with ?sw=1)');
          return;
        }
        res.setHeader('Content-Type', 'text/javascript');
        res.end(stamp(swSource(), `dev-${buildId}`, 'dev', []));
      });
    },
  };
}
