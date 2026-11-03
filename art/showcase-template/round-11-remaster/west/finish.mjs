// Burn the caption strip onto each picked remaster: node art/showcase-template/round-11-remaster/west/finish.mjs [id,...]
// v2: reads tmp/ks-remaster-west-v2/out/<id>-<pick>.png (pick from shots.json "pick"), writes <id>.jpg here (<= 250 KB);
// shots with "keep": "v1" (Jake kept the v1 frame) are skipped. The strip:
// a dark strip on top with "<ID> · <title>" and the one-line caption, then the 1024 x 1536 frame.
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../../../tmp/ks-remaster-west-v2/out');
const only = process.argv[2]?.split(',');
for (const s of JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8')).shots) {
  if ((only && !only.includes(s.id)) || s.keep === 'v1') continue;
  const src = join(out, `${s.id}${s.pick ? '-' + s.pick : ''}.png`), dst = join(here, `${s.id}.jpg`);
  for (let q = 82; ; q -= 6) {
    execFileSync('magick', [
      '(', '-size', '1024x', '-background', '#16181b', '-fill', '#f08a24', '-font', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '-pointsize', '38',
      `caption:${s.id.toUpperCase()} · ${s.title}`, ')',
      '(', '-size', '1024x', '-background', '#16181b', '-fill', '#e6e6e6', '-font', '/System/Library/Fonts/Supplemental/Arial.ttf', '-pointsize', '25', `caption:${s.caption}`, ')',
      '-bordercolor', '#16181b', '-border', '18x8', '-append', '-resize', '1024x', '(', src, '-resize', '1024x1536!', ')', '-append',
      '-quality', String(q), dst]);
    const { size } = statSync(dst);
    if (size <= 250_000 || q <= 40) { console.log(s.id, size, 'q' + q); break; }
  }
}
