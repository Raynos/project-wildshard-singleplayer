// SHARD-PLATFORM op-ship38 (G326, E435): the push-CI boot smoke's own standalone case (scripts/parity/boot-smoke.mjs
// `bootCase`: the real title ▸ SHARD SELECT ▸ ENTER WORLD, ten live gameplay frames, no fatal / console error / HTTP error)
// on each shard's shardfile folder (`?chunk=<slug>` is the shardfile shard since SF73; its legacy copy is `<slug>-legacy`).
// Muted Metal Chromium, iPhone portrait, phone tier. Developer on for the shards still Developer-only.
//   scripts/browser-lane.sh node progress/shard-platform/ship38/boot.mjs <preview-url> <out-dir> <slug[:dev],...>
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { bootCase } from '../../../scripts/parity/boot-smoke.mjs';

const [base, out, list] = process.argv.slice(2);
if (!base || !out || !list) throw new Error('usage: boot.mjs <preview-url> <out-dir> <slug[:dev],...>');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
let failed = 0;
try {
  for (const item of list.split(',')) {
    const [slug, dev] = item.split(':');
    try {
      const result = await bootCase(browser, base, 'standalone', out, slug, dev === 'dev');
      console.log(`${slug}: gameplay PASS in ${result.elapsedMs} ms, shard=${result.shard}, frame=${result.frame}, faults=${result.faults.length}`);
    } catch (error) { failed++; console.log(`${slug}: FAIL ${String(error).slice(0, 400)}`); }
  }
} finally { await browser.close(); }
process.exitCode = failed > 0 ? 1 : 0;
