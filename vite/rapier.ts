/**
 * Rapier's WASM, loaded by the game rather than by the bundler (docs/plans/PHYSICS.md §Architecture, Loading).
 *
 * `@dimforge/rapier3d-simd` is a wasm-bindgen `bundler` build: its `rapier_wasm3d.js` does
 * `import * as wasm from "./rapier_wasm3d_bg.wasm"` (the Wasm ESM-integration proposal), which Vite does not support.
 * So that one module is aliased to src/physics/rapierBindings.ts — the same class wrappers without the wasm import —
 * and src/physics/rapier.ts instantiates the binary itself (streamed from /assets/physics/, where the boot plan counts
 * its bytes and the service worker caches it like every other asset) and hands it to the wrappers.
 *
 * `copyRapierWasm()` puts the package's binary at public/assets/physics/rapier.wasm before the byte table is written
 * (gitignored: it is regenerated from node_modules by every build, like the boot packs).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants as zlib } from 'node:zlib';
import type { Plugin } from 'vite';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = `${ROOT}node_modules/@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm`;
const TARGET_DIR = `${ROOT}public/assets/physics`;
const TARGET = `${TARGET_DIR}/rapier.wasm`;

/** Aliases for vite.config.ts and vitest.config.ts: the package's wasm-importing module → the plain bindings. */
export const rapierAlias = [
  { find: /^\.\/rapier_wasm3d(\.js)?$/, replacement: `${ROOT}src/physics/rapierBindings.ts` },
  // the package declares only `module`; node-side resolution (vitest) wants a file
  { find: /^@dimforge\/rapier3d-simd$/, replacement: `${ROOT}node_modules/@dimforge/rapier3d-simd/rapier.js` },
];

/**
 * `vite preview` sends the 2.2 MB binary as is, while Vercel's CDN brotli-compresses `application/wasm` (its
 * documented allowlist) to ~537 KB. The bench measures the preview, so the preview answers the way production does.
 */
export function rapierPreviewPlugin(): Plugin {
  let br: Buffer | null = null;
  return {
    name: 'wildshard:rapier-preview',
    configurePreviewServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const accepts = req.headers['accept-encoding'] ?? '';
        if (req.method !== 'GET' || !req.url?.startsWith('/assets/physics/rapier.wasm') || !accepts.includes('br')) { next(); return; }
        br ??= brotliCompressSync(readFileSync(TARGET), { params: { [zlib.BROTLI_PARAM_QUALITY]: 11 } });
        res.setHeader('Content-Type', 'application/wasm');
        res.setHeader('Content-Encoding', 'br');
        res.setHeader('Content-Length', String(br.length));
        res.end(br);
      });
    },
  };
}

export function copyRapierWasm(): void {
  const src = readFileSync(SOURCE);
  if (existsSync(TARGET) && readFileSync(TARGET).equals(src)) return;
  mkdirSync(TARGET_DIR, { recursive: true });
  copyFileSync(SOURCE, TARGET);
}
