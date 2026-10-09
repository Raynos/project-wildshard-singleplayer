// The marketing site's build (MARKETING-SITE MS4, E465): its own root, its own public/, its own output. Nothing from
// the game's src/ or vite plugins: the sites share the repo, not a bundle (as drafts/, J15).
//   pnpm build:site   → dist-site/
// It also emits /version.json, which site/tools/deploy.sh reads back to check the live build.
import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = import.meta.dirname;

function buildId(): string {
  // deploy.sh builds a clean export (no .git) and passes HEAD's sha.
  const { SITE_BUILD_SHA: given } = process.env;
  let sha = given ?? '';
  if (!sha) try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }
  return `${sha || 'b'}-${Date.now().toString(36)}`;
}
const BUILD = buildId();

function versionJson(): Plugin {
  return {
    name: 'site-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD, time: new Date().toISOString() }) });
    },
  };
}

export default defineConfig({
  root,
  publicDir: 'public',
  base: '/',
  build: {
    outDir: fileURLToPath(new URL('../dist-site', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
  },
  plugins: [versionJson()],
});
