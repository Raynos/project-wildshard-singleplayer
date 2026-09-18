import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';

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

const versionPlugin = (): Plugin => ({
  name: 'wildshard-version',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: versionJson() }); },
  configureServer(server) {
    server.middlewares.use('/version.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(versionJson());
    });
  },
});

export default defineConfig({
  server: { port: 5173, host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 4000 },
  assetsInclude: ['**/*.hdr', '**/*.gltf', '**/*.bin'],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [versionPlugin()],
});
