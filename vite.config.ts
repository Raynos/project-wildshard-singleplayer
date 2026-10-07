import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { rmSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ServerResponse } from 'node:http';
import { pwaPlugin } from './vite/pwa-plugin';
import { hashTree } from './vite/assetHashes';
import { rapierAlias, rapierPreviewPlugin } from './vite/rapier';
import { assetIndex } from './vite/gen';
import { genShardsPlugin } from './vite/genShards';
import { backdropPrefixPlugin } from './vite/backdropPrefix';
import { chunkReport } from './vite/chunkReport';
import { devserverFlags } from './vite/devserver';
import { crossroadsRigPlugin } from './vite/crossroadsRig';

// Build stamp: short git sha + build time. Baked into the bundle as __BUILD_ID__ and
// emitted as /version.json so the running app can tell when the server has a newer build
// (iOS home-screen PWAs have no address bar, so the title screen offers the reload).
function buildId(): string {
  let sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7);
  try { sha ||= execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }
  return `${sha || 'b'}-${Date.now().toString(36)}`;
}
const BUILD_ID = buildId();
const versionJson = () => JSON.stringify({ build: BUILD_ID, time: new Date().toISOString() });

const assetManifest = (): string => JSON.stringify(hashTree('assets'));

const versionPlugin = (): Plugin => ({
  name: 'wildshard-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: versionJson() });
    this.emitFile({ type: 'asset', fileName: 'asset-index.json', source: assetIndex() });
    this.emitFile({ type: 'asset', fileName: 'asset-manifest.json', source: assetManifest() });
  },
  configureServer(server) {
    const json = (body: () => string) => (_req: unknown, res: ServerResponse) => {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(body());
    };
    server.middlewares.use('/version.json', json(versionJson));
    server.middlewares.use('/asset-index.json', json(assetIndex));
    server.middlewares.use('/asset-manifest.json', json(assetManifest));
  },
});

// `vite build --mode native` (docs/plans/NATIVE-APPS.md): the web bundle the iOS / Android shells embed, in
// dist-native/ (capacitor.config.ts `webDir`). Same game; the page swaps the web-only boot for src/native.ts:
// no service worker (WKWebView has none on capacitor://, and the bundle is already on disk), no update pill
// (native updates are the signed OTA channel), no Google Fonts (bundled — the app must boot offline), no trailers.
const WEB_ONLY_HTML = [
  /\s*<link rel="manifest"[^>]*>/,
  /\s*<script type="module" src="\/src\/engine\/boot\/sw\.ts"><\/script>/,
  /\s*<script type="module" src="\/src\/engine\/ui\/Update\.ts"><\/script>/,
];
// Capacitor's `server.errorPath`: shown when the WebView cannot load the game at all (an outdated Android System
// WebView is the usual cause). No script, no fonts, no network.
const NATIVE_UNAVAILABLE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Wildshard</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#11161b;color:#e8e2d4;font:16px/1.5 -apple-system,system-ui,sans-serif;text-align:center;padding:24px;box-sizing:border-box}h1{font-size:22px;margin:0 0 8px}p{max-width:34em;margin:0 auto;color:#b9b3a6}</style></head>
<body><div><h1>Wildshard can't start on this device</h1><p>The game needs WebGL 2 and an up-to-date system WebView. On Android, update <b>Android System WebView</b> and <b>Chrome</b> from Google Play, then reopen Wildshard. On iPhone, update to iOS 17 or later.</p></div></body></html>
`;
const nativePlugin = (): Plugin => ({
  name: 'wildshard-native',
  transformIndexHtml: { order: 'pre', handler(html) { // pre: on the source page, before Vite bundles its scripts
    let out = html;
    for (const re of WEB_ONLY_HTML) {
      if (!re.test(out)) throw new Error(`[native] index.html no longer matches ${String(re)} — update WEB_ONLY_HTML in vite.config.ts`);
      out = out.replace(re, '');
    }
    // any Google Fonts link (the native entry bundles the faces itself; optional, the web page may self-host them)
    out = out.replaceAll(/\s*<link[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '');
    const main = '<script type="module" src="/src/entry.ts"></script>'; // the web entry (it imports src/main.ts)
    if (!out.includes(main)) throw new Error('[native] index.html has no src/entry.ts script to swap for src/native.ts');
    return out.replace(main, '<script type="module" src="/src/native.ts"></script>');
  } },
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'native-unavailable.html', source: NATIVE_UNAVAILABLE }); },
  closeBundle() { for (const f of ['trailer-15.mp4', 'trailer-30.mp4']) rmSync(join('dist-native', f), { force: true }); },
});

export default defineConfig(({ mode }) => {
  const native = mode === 'native';
  return {
    server: { port: 5173, host: true },
    // keepNames: the uncaught-exception modal shows raw stacks on phones (no source-map resolution there), so keep
    // function / class names readable; hidden source maps for desktop devtools (not referenced from the bundle).
    esbuild: { keepNames: true, minifyIdentifiers: false }, // readable stacks in the exception modal (identifier mangling saves ~15 % gzip; not worth blind bug reports)
    // native: no source maps at all — they would ship inside the app and in every OTA bundle
    build: native
      ? { target: 'es2022', chunkSizeWarningLimit: 4000, sourcemap: false, outDir: 'dist-native' }
      // one stylesheet: src/entry.ts splits three.js from the game's graph, and code-split CSS would add a request
      : {
        target: 'es2022', chunkSizeWarningLimit: 4000, sourcemap: 'hidden' as const, cssCodeSplit: false, manifest: true,
        // G221: standalone CLI calibration, never a game-entry or Developer switch.
        rolldownOptions: { input: { main: join(process.cwd(), 'index.html'), calibration: join(process.cwd(), 'calibration/index.html') } },
        // Manual groups remain disabled: Rolldown 1.2.9 emits circular chunks with invalid runtime bindings.
      },
    assetsInclude: ['**/*.hdr', '**/*.gltf', '**/*.bin'],
    resolve: { alias: rapierAlias }, // Rapier's wasm-importing module → plain bindings (vite/rapier.ts)
    define: { __DEVSERVER__: mode === 'devserver', __BUILD_ID__: JSON.stringify(BUILD_ID), __SAVE_NAMESPACES__: JSON.stringify(readdirSync('src/shards').filter((slug) => existsSync(join('src/shards', slug, 'manifest.ts')))) },
    plugins: native ? [devserverFlags(false), genShardsPlugin(), backdropPrefixPlugin(), versionPlugin(), nativePlugin()] : [devserverFlags(mode === 'devserver'), genShardsPlugin(), backdropPrefixPlugin(), versionPlugin(), crossroadsRigPlugin(BUILD_ID), pwaPlugin(BUILD_ID), rapierPreviewPlugin(), chunkReport()],
  };
});
