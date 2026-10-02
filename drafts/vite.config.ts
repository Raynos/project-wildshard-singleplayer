// The drafts site's build (WORLDCLAW-TOOLS W16, J57): its own root, its own public/, its own output. Nothing from the
// game's src/ or vite plugins: the two websites share the repo, not a bundle (J15).
//   pnpm build:drafts   → dist-drafts/
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = import.meta.dirname;

function buildId(): string {
  // deploy.sh builds a clean export (no .git) and passes HEAD's sha.
  const { DRAFTS_BUILD_SHA: given } = process.env;
  let sha = given ?? '';
  if (!sha) try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }
  return `${sha || 'b'}-${Date.now().toString(36)}`;
}

export default defineConfig({
  root,
  publicDir: 'public',
  base: '/',
  build: {
    outDir: fileURLToPath(new URL('../dist-drafts', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
  },
  plugins: [{
    name: 'drafts-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: buildId(), time: new Date().toISOString() }) });
    },
  }],
});
