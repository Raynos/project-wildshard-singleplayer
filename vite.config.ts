import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Build stamp: short git sha + build time. Baked into the bundle as __BUILD_ID__ and
// emitted as /version.json so the running app can tell when the server has a newer build
// (iOS home-screen PWAs have no address bar, so the title screen offers the reload).
function buildId(): string {
  let sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7);
  try { sha ||= execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch {}
  return `${sha || 'b'}-${Date.now().toString(36)}`;
}
const BUILD_ID = buildId();
const versionJson = () => JSON.stringify({ build: BUILD_ID, time: new Date().toISOString() });

// /asset-index.json: every file under public/assets with its byte size, so the loading
// screen can show real "x / y MB" totals for the files it has requested so far.
function assetIndex(): string {
  const out: Record<string, number> = {};
  const walk = (dir: string, pub: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name); const st = statSync(p);
      if (st.isDirectory()) walk(p, `${pub}/${name}`); else out[`${pub}/${name}`] = st.size;
    }
  };
  try { walk('public/assets', '/assets'); } catch {}
  return JSON.stringify(out);
}

const versionPlugin = (): Plugin => ({
  name: 'wildshard-version',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: versionJson() });
    this.emitFile({ type: 'asset', fileName: 'asset-index.json', source: assetIndex() });
  },
  configureServer(server) {
    const json = (body: () => string) => (_req: unknown, res: import('node:http').ServerResponse) => {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(body());
    };
    server.middlewares.use('/version.json', json(versionJson));
    server.middlewares.use('/asset-index.json', json(assetIndex));
  },
});

export default defineConfig({
  server: { port: 5173, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  assetsInclude: ['**/*.hdr', '**/*.gltf', '**/*.bin'],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [versionPlugin()],
});
