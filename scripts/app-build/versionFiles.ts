import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashTree } from './assetHashes';
import { assetIndex } from './gen';

// Build stamp: short git sha + build time. Written into each document by build-app,
// never into content-hashed runtime modules, and written as /version.json so the app can tell when the server has a newer build
// (iOS home-screen PWAs have no address bar, so the title screen offers the reload).
function buildId(): string {
  const { VERCEL_GIT_COMMIT_SHA: commitSha } = process.env;
  let sha = (commitSha ?? '').slice(0, 7);
  try { sha ||= execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }
  return `${sha || 'b'}-${Date.now().toString(36)}`;
}

/** version.json (the build id), asset-index.json and asset-manifest.json beside the bundle (was vite.config.ts's
 *  version plugin): scripts/build-app.mjs writes them right after the bundler, before the documents are stamped from
 *  version.json and before the service worker counts them. */
export function writeVersionFiles(outDir: string): void {
  writeFileSync(join(outDir, 'version.json'), JSON.stringify({ build: buildId(), time: new Date().toISOString() }));
  writeFileSync(join(outDir, 'asset-index.json'), assetIndex());
  writeFileSync(join(outDir, 'asset-manifest.json'), JSON.stringify(hashTree('assets')));
}
