// Phone-tier texture files: for every public/assets/tex/<id>/{diffuse,nor_gl,arm}.jpg wider than
// 1024 px or heavier than 350 KB, write <kind>_1k.jpg beside it (≤ 1024², q82). The phone tier requests these (src/core/assets.ts
// texUrl) instead of downloading a 2048² file it would shrink anyway. Idempotent; needs ImageMagick.
import { readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT = 'public/assets/tex';
let made = 0, kept = 0;
for (const id of readdirSync(ROOT)) {
  const dir = join(ROOT, id);
  if (!statSync(dir).isDirectory()) continue;
  for (const kind of ['diffuse', 'nor_gl', 'arm']) {
    const src = join(dir, `${kind}.jpg`), out = join(dir, `${kind}_1k.jpg`);
    if (!existsSync(src)) continue;
    const w = Number(execFileSync('magick', ['identify', '-format', '%w', src]).toString());
    if (w <= 1024 && statSync(src).size < 350 * 1024) continue; // small enough: the loader falls back to the base file
    if (existsSync(out) && statSync(out).mtimeMs >= statSync(src).mtimeMs) { kept++; continue; }
    execFileSync('magick', [src, '-resize', '1024x1024', '-quality', '82', '-strip', out]);
    made++;
  }
}
console.log(`tex-tiers: ${made} written, ${kept} up to date`);
