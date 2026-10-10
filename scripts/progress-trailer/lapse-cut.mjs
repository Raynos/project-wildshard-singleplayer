// lapse-cut.mjs — a lapse's contact sheet and clip from the stages lapse.mjs rendered (PROGRESS-TRAILER §3.3, row PT5;
// E468). No browser.
//
//   the contact sheet: each stage's sheet still (every stage at the same pose) side by side, labelled SHA · date (UTC−5)
//   · `git rev-list --count`, all computed from git:
//     node scripts/progress-trailer/lapse-cut.mjs sheet --lapse=scripts/progress-trailer/lapses/<name>.mjs --out=<scratch>/lapses \
//       --jpg=progress/progress-trailer/pt5/<name>-sheet.jpg [--cols=3]
//   the clip: the stages' slices in timeline order, 1920×1080 60 fps H.264, hard cuts on the stage swaps (the 2-frame flash,
//   the tick, the inset, the band and the rail are the authoring frame's, composited later), and a ≤ 4 MB 720p preview:
//     node scripts/progress-trailer/lapse-cut.mjs cut --lapse=… --out=<scratch>/lapses --mp4=<clip.mp4> [--preview=<720p.mp4>]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = resolve(import.meta.dirname, '../..');
const FPS = 60;
const arg = (k, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const git = (...a) => execFileSync('git', ['-C', REPO, ...a], { encoding: 'utf8' }).trim();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** sha → { sha, short, date ("1 Oct 14:56", UTC−5 as the trailer's cards), count (git rev-list --count) } */
export function stageFacts(sha) {
  const full = git('rev-parse', sha);
  const local = new Date(Date.parse(git('log', '-1', '--format=%cd', '--date=iso-strict', full)) - 5 * 3600 * 1000).toISOString();
  const date = `${Number(local.slice(8, 10))} ${MONTHS[Number(local.slice(5, 7)) - 1]} ${local.slice(11, 16)}`;
  return { sha: full, short: full.slice(0, 9), date, count: Number(git('rev-list', '--count', full)) };
}

async function loadLapse() {
  return (await import(pathToFileURL(resolve(arg('lapse'))).href)).lapse;
}

async function sheet() {
  const lapse = await loadLapse();
  const root = join(resolve(arg('out', 'lapses')), lapse.name);
  const args = [];
  for (const s of lapse.stages) {
    const f = stageFacts(s.sha), img = join(root, f.short, 'sheet.jpg');
    if (!existsSync(img)) throw new Error(`no sheet still for ${f.short}`);
    args.push('-label', `${f.short} · ${f.date} · ${f.count.toLocaleString('en-US')} commits`, img);
  }
  const jpg = resolve(arg('jpg'));
  const cols = arg('cols', String(Math.min(3, lapse.stages.length)));
  execFileSync('montage', [...args, '-tile', `${cols}x`, '-geometry', '640x360+6+6', '-background', '#111', '-fill', '#eee', '-font', 'Helvetica', '-pointsize', '22', '-title', lapse.title ?? lapse.name, '-quality', '82', jpg]);
  console.info(`${jpg} ${Math.round(statSync(jpg).size / 1024)} KB`);
}

async function cut() {
  const lapse = await loadLapse();
  const root = join(resolve(arg('out', 'lapses')), lapse.name);
  const seq = join(root, '_seq');
  rmSync(seq, { recursive: true, force: true });
  mkdirSync(seq);
  let n = 0;
  for (const s of lapse.stages) {
    const dir = join(root, stageFacts(s.sha).short);
    for (let f = Math.round(s.t0 * FPS); f < Math.round(s.t1 * FPS); f++) {
      const src = join(dir, `${String(f).padStart(6, '0')}.jpg`);
      if (!existsSync(src)) throw new Error(`missing ${src}`);
      symlinkSync(src, join(seq, `${String(n++).padStart(6, '0')}.jpg`));
    }
  }
  if (n !== Math.round(lapse.seconds * FPS)) throw new Error(`${n} frames, want ${lapse.seconds * FPS}`);
  const mp4 = resolve(arg('mp4'));
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', join(seq, '%06d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  let note = '';
  if (arg('preview')) {
    const preview = resolve(arg('preview'));
    // ≤ 4 MB whatever the length: the bitrate is the budget over the clip's seconds
    const kbps = Math.floor((3.6 * 8 * 1024) / lapse.seconds);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-vf', 'scale=1280:720', '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${kbps}k`, '-maxrate', `${kbps}k`, '-bufsize', `${kbps * 2}k`, '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', preview]);
    note = ` · preview ${Math.round(statSync(preview).size / 1024)} KB`;
  }
  rmSync(seq, { recursive: true, force: true });
  console.info(`${mp4} ${n} frames${note}`);
}

if (process.argv[1] === import.meta.filename) {
  const MODES = { sheet, cut };
  const mode = process.argv[2];
  if (!(mode in MODES)) throw new Error(`lapse-cut.mjs <${Object.keys(MODES).join(' | ')}> …`);
  await MODES[mode]();
}
