// Burn the caption strip onto each remaster: east/<id>.jpg = a black strip (id + title, one-line caption) over the
// remastered frame, 720 px wide, iPhone portrait, <= 250 KB.
//   node art/showcase-template/round-11-remaster/east/finalize.mjs <png dir> [id,id...]
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pngDir = process.argv[2];
const only = process.argv[3]?.split(',');
const shots = JSON.parse(await readFile(join(here, 'shots.json'), 'utf8'));
const W = 720, FONT = '/Library/Fonts/Arial Unicode.ttf';
for (const s of shots) {
  if (only && !only.includes(s.id)) continue;
  const src = join(pngDir, s.id + '.png'), out = join(here, s.id + '.jpg');
  const head = `${s.id.toUpperCase()}  ${s.title}`;
  for (let q = 86; ; q -= 6) {
    execFileSync('magick', [
      '(', '-size', `${W - 32}x`, '-background', '#000000', '-fill', '#f08a24', '-font', FONT, '-pointsize', '27', `caption:${head}`, ')',
      '(', '-size', `${W - 32}x`, '-background', '#000000', '-fill', '#eceae6', '-font', FONT, '-pointsize', '19', `caption:${s.caption}`, ')',
      '-background', '#000000', '-gravity', 'west', '-append', '-bordercolor', '#000000', '-border', '16x10',
      '(', src, '-resize', `${W}x`, ')', '-gravity', 'center', '-append', '-strip', '-quality', String(q), out]);
    const { size } = await stat(out);
    if (size <= 250_000 || q <= 50) { console.log(s.id, size, 'q' + q); break; }
  }
}
