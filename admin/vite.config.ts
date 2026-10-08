// The admin site's build (SHARD-PLATFORM SF68, G248–G251): its own root, public/ and output, nothing from the game's
// src/ or Vite plugins. At build time it runs sp-x2's admin-data pipeline over the committed reports (G250: committed
// blobs only, no live game connection), maps that `wildshard-admin/1` bundle to the page's view (tools/view.ts) and writes
//   dist-admin/index.html, assets/*, data/bundle.json, media/** (content-hashed), media/posters/*, version.json
//   pnpm build:admin      reports from HEAD of this checkout
//   ADMIN_REV=<40-char sha> on a clean `git archive` export (no .git): admin/tools/deploy.sh
import { defineConfig, type Plugin } from 'vite';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { committedAdminTree, exportedAdminTree, writeAdminData } from '../scripts/admin-data.mjs';
import { readAdminBundle } from '../scripts/admin-data/validate.mjs';
import { toView } from './tools/view.ts';

const root = import.meta.dirname;
const repo = join(root, '..');

/** A video's first-second still (ffmpeg → JPEG), or null when ffmpeg is missing or fails: the tile then shows none. */
function poster(file: string): Buffer | null {
  try {
    return execFileSync('ffmpeg', ['-v', 'error', '-ss', '1', '-i', file, '-frames:v', '1', '-vf', 'scale=270:-2', '-q:v', '5',
      '-f', 'image2pipe', '-vcodec', 'mjpeg', '-'], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 8 * 1024 * 1024 });
  } catch {
    return null;
  }
}

function adminData(): Plugin {
  return {
    name: 'admin-data',
    generateBundle() {
      const { ADMIN_REV: rev } = process.env;
      const tree = rev ? exportedAdminTree(repo, rev) : committedAdminTree(repo, 'HEAD');
      const scratch = mkdtempSync(join(tmpdir(), 'wildshard-admin-data-'));
      try {
        const out = join(scratch, 'out');
        writeAdminData(tree, out);
        const admin = readAdminBundle(JSON.parse(readFileSync(join(out, 'bundle.json'), 'utf8')));
        const posters = new Set<string>();
        for (const m of admin.media) {
          const file = join(out, m.url);
          this.emitFile({ type: 'asset', fileName: m.url, source: readFileSync(file) });
          if (m.kind !== 'video') continue;
          const still = poster(file);
          if (!still) continue;
          posters.add(m.sha256);
          this.emitFile({ type: 'asset', fileName: `media/posters/${m.sha256}.jpg`, source: still });
        }
        const time = new Date().toISOString();
        const view = toView(admin, time, posters);
        this.emitFile({ type: 'asset', fileName: 'data/bundle.json', source: JSON.stringify(view) });
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: view.build, revision: admin.revision, time }) });
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  root,
  publicDir: 'public',
  base: '/',
  build: {
    outDir: fileURLToPath(new URL('../dist-admin', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
  },
  preview: { port: 4178, strictPort: true },
  plugins: [adminData()],
});
