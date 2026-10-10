// assemble.mjs — cut the progress trailer (PROGRESS-TRAILER PT9, E468): the beat sheet (§2.2) as an EDL for the shared
// conform `scripts/steam-trailer/edit.mjs` (read, never edited), from this plan's takes, lapses, cards and mix.
//
//   node scripts/progress-trailer/assemble.mjs <config.json> <out.mp4>
//
// config: { work: <scratch dir>, titles: <titles.mjs output dir (one PNG sequence per card id)>, mix: <wav or "-">,
//   takes: { <shot name>: <take dir (edit.mjs frame format: %06d.jpg + meta.json)> }  — d01-hunt, w1-combo, d15-square,
//          w2-gallop, w3-hover, w3-whip, rewind (cut-rewind.py --frames-out), pt-grapple, pt-grid
//   lapses: { driftwood, pine-hollow, sky-reach: <1920×1080 60 fps full-frame clip> } (missing → a grey stand-in),
//   edlOnly: true writes edl.json and stops (mixbuild.py times the mix from it),
//   edit: { <shot>: { in, dur } } overrides of the in-points below }
// The lapse pictures are set into the authoring frame's inset (titles.html window.insetAt: 1440 × 810 at (480, 135);
// Sky Reach's last `open` s grow it to full-bleed with an in-out cubic) as finished `video` clips; the frame cards
// (rail, band, counter) overlay them. Historical clips carry no shard grade (meta shard 'none', §2.3).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [CONFIG, OUT] = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const W = cfg.work, FR = join(W, 'frames');
mkdirSync(FR, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

// the beat sheet (§2.2): [shot | lapse | black, at, dur, in, card]
const E = { ...cfg.edit };
const pick = (shot, inP, dur) => ({ in: E[shot]?.in ?? inP, dur: E[shot]?.dur ?? dur });
const BEATS = [
  { shot: 'pt-grapple', ...pick('pt-grapple', 0, 2) },
  { black: true, dur: 2, card: 'origin' },
  { black: true, dur: 3, card: 'wall-day1' },
  { shot: 'd01-hunt', ...pick('d01-hunt', 0.2, 5) },
  { lapse: 'driftwood', dur: 6, card: 'frame-week1' },
  { shot: 'w1-combo', ...pick('w1-combo', 0.1, 4) },
  { lapse: 'pine-hollow', dur: 6, card: 'frame-week2' }, // the remaster: Nine Dragon's stages don't read as growth (PT5)
  { shot: 'd15-square', ...pick('d15-square', 2.6, 2) },
  { shot: 'w2-gallop', ...pick('w2-gallop', 0.3, 2) },
  { lapse: 'sky-reach', dur: 8, card: 'frame-week3', open: 2 },
  { shot: 'w3-hover', ...pick('w3-hover', 0.3, 2.5) },
  { shot: 'w3-whip', ...pick('w3-whip', 2.0, 1.5) },
  { black: true, dur: 2, card: 'breath' },
  { shot: 'rewind', ...pick('rewind', 0, 6) },
  { shot: 'pt-grid', ...pick('pt-grid', 0.05, 8), cards: [['end-count', 2], ['end-cta', 5]] },
];

// a lapse picture set into the inset, as a finished 1080p clip
const lapseClip = (name, dur, open) => {
  const out = join(W, `lapse-${name}.mp4`), src = cfg.lapses?.[name];
  const a = dur - open;
  // insetAt: e = inOut(clamp((t − a) / open)); rect x 480(1−e), y 135(1−e), w 1440 + 480e, h 810 + 270e
  const p = open ? `clip((t-${a})/${open},0,1)` : '0';
  const e = open ? `if(lt(${p},0.5),4*pow(${p},3),1-pow(-2*${p}+2,3)/2)` : '0';
  const input = src && existsSync(src) ? ['-i', src] : ['-f', 'lavfi', '-i', `color=c=0x202428:s=1920x1080:r=60:d=${dur}`];
  ff(['-f', 'lavfi', '-i', `color=c=black:s=1920x1080:r=60:d=${dur}`, ...input, '-filter_complex',
    `[1:v]fps=60,trim=duration=${dur},setpts=PTS-STARTPTS,scale=w='trunc((1440+480*(${e}))/2)*2':h='trunc((810+270*(${e}))/2)*2':eval=frame[p];` +
    `[0:v][p]overlay=x='480*(1-(${e}))':y='135*(1-(${e}))':eval=frame:shortest=1,format=yuv420p[v]`,
    '-map', '[v]', '-t', String(dur), '-c:v', 'libx264', '-crf', '12', '-preset', 'medium', out]);
  return out;
};

const clips = [], titles = [];
let at = 0;
for (const b of BEATS) {
  if (b.shot) {
    const dir = cfg.takes[b.shot];
    if (!dir || !existsSync(join(dir, 'meta.json'))) throw new Error(`take ${b.shot} missing: ${dir}`);
    const link = join(FR, b.shot);
    rmSync(link, { force: true, recursive: false });
    symlinkSync(dir, link);
    clips.push({ shot: b.shot, in: b.in, dur: b.dur, at, ...(b.shot.startsWith('pt-') ? {} : { grade: 'none' }) });
  } else if (b.lapse) {
    clips.push({ shot: `lapse-${b.lapse}`, video: lapseClip(b.lapse, b.dur, b.open ?? 0), in: 0, dur: b.dur, at });
  } else {
    clips.push({ shot: 'black', dur: b.dur, at });
  }
  if (b.card) titles.push({ id: b.card, at });
  for (const [id, off] of b.cards ?? []) titles.push({ id, at: at + off });
  at += b.dur;
}
for (const t of titles) if (!existsSync(join(cfg.titles, t.id))) throw new Error(`card ${t.id} not rendered in ${cfg.titles}`);
const edl = { size: [1920, 1080], clips, titles, rebuild: true };
const EDL = join(W, 'edl.json');
writeFileSync(EDL, JSON.stringify(edl, null, 1));
console.log(`[assemble] ${clips.length} clips, ${titles.length} cards, ${at.toFixed(2)} s → ${EDL}`);
if (!cfg.edlOnly) execFileSync('node', [join(import.meta.dirname, '../steam-trailer/edit.mjs'), FR, EDL, cfg.titles, cfg.mix ?? '-', OUT], { stdio: 'inherit' });
