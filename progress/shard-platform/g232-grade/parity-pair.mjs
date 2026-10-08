// G232: SHARD SELECT parity of this source against its parent export, same lane and tier: the parent's parity record is
// the baseline (scripts/parity/compare.mjs), plus each pose image's mean absolute difference (0–255).
// node progress/shard-platform/g232-grade/parity-pair.mjs <parent out dir> <candidate out dir> <slug,…> [tier]
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { compare } from '../../../scripts/parity/compare.mjs';
const [before, after, slugs = '', tier = 'phone'] = process.argv.slice(2);
if (!before || !after || !slugs) throw new Error('Pass <parent dir> <candidate dir> <slug,…> [tier]');
/** mean absolute difference of two JPEGs (ImageMagick's MAE, normalised, × 255) */
const mae = (a, b) => {
  try { execFileSync('magick', ['compare', '-metric', 'MAE', a, b, 'null:'], { stdio: 'pipe' }); return 0; } catch (e) {
    const m = /\(([\d.e-]+)\)/u.exec(String(e.stderr)); return m ? Math.round(Number(m[1]) * 255 * 100) / 100 : null;
  }
};
const out = {};
for (const slug of slugs.split(',')) {
  const file = `${slug}.${tier}.json`, a = join(before, file), b = join(after, file);
  if (!existsSync(a) || !existsSync(b)) { out[slug] = 'unpaired'; continue; }
  const base = JSON.parse(readFileSync(a, 'utf8')), cur = JSON.parse(readFileSync(b, 'utf8'));
  const result = compare(base, cur);
  const poses = Object.keys(cur.poses ?? {}).map((pose) => [pose, mae(join(before, `${slug}.${tier}.${pose}.jpg`), join(after, `${slug}.${tier}.${pose}.jpg`))]);
  const rows = Array.isArray(result) ? result : result?.rows ?? [];
  const red = rows.filter((row) => row.verdict === 'red').map((row) => row.field);
  out[slug] = { red: red.length, redFields: red.slice(0, 8), programs: [base.boot?.render?.programs, cur.boot?.render?.programs], programKeysSame: base.boot?.render?.programKeys === cur.boot?.render?.programKeys, poses };
}
console.log(JSON.stringify(out, null, 1));
