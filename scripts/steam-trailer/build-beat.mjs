// E466 TRAILERS TR5 — the alpha trailer's build beat: a real Claude Code session (an asciinema recording of a session
// building a Sky Reach prop in a scratch worktree) beside two of Sky Reach's grey-to-final time-lapses
// (progress/far-reach/timelapse-*.mp4: the same view at each of 25 commits). Nothing is staged: the terminal is the
// recording, sped up to fit; the time-lapses are the commit captures.
//
//   node scripts/steam-trailer/build-beat.mjs <session.cast> <out.mp4> [--dur 8.13]
//
// Layout (1920×1080, the site's abyss): the terminal on the left (rendered by agg, the asciinema GIF renderer, at the
// recording's own size, scaled to fit 960 px), two time-lapse panels on the right (their 30 fps chip cropped off). The
// bottom-left stays clear for the trailer's "Built in Claude Code" caption.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const [CAST, OUT] = argv;
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i === -1 ? d : argv[i + 1]; };
const DUR = Number(opt('dur', '8.13'));
const HOLD = 1.0; // the session's last screen (its summary) holds this long at the end
const FPS = 60;
const TMP = `${OUT}.parts`;
mkdirSync(TMP, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

// the recording's length: the last event's time (asciicast v2/v3 lines are [t, kind, data]; v3 times are intervals)
// the session ends where the user typed /exit: everything after it (Claude Code's resume hint) is cut
const lines = readFileSync(CAST, 'utf8').trim().split('\n');
const header = JSON.parse(lines[0]);
const all = lines.slice(1).map((l) => JSON.parse(l));
const exitAt = all.findIndex((e) => typeof e[2] === 'string' && e[2].includes('/exit'));
const events = exitAt > 0 ? all.slice(0, exitAt) : all;
writeFileSync(`${TMP}/session.cast`, `${[lines[0], ...events.map((e) => JSON.stringify(e))].join('\n')}\n`);
const v3 = header.version === 3;
const length = v3 ? events.reduce((s, e) => s + e[0], 0) : events.at(-1)[0];
const speed = length / (DUR - HOLD);
console.log(`[build-beat] session ${length.toFixed(0)} s → ${(DUR - HOLD).toFixed(2)} s (${speed.toFixed(0)}×)`);

// the terminal: agg renders the cast at the chosen speed (a GIF), ffmpeg turns it into the clip with the held last frame
// (no idle cap here: the recording already capped idle at 2 s, and agg's cap would shorten the clip below the beat)
execFileSync('agg', ['--speed', String(speed), '--fps-cap', '30', '--font-size', '22', '--idle-time-limit', '100000', '--last-frame-duration', '0', `${TMP}/session.cast`, `${TMP}/term.gif`], { stdio: 'inherit' });
ff(['-i', `${TMP}/term.gif`, '-vf', `fps=${FPS},scale=960:880:force_original_aspect_ratio=decrease:flags=lanczos,tpad=stop_mode=clone:stop_duration=${DUR},trim=duration=${DUR},format=yuv444p`,
  '-c:v', 'libx264', '-qp', '6', '-pix_fmt', 'yuv444p', `${TMP}/term.mkv`]);

// the time-lapses: 26.6 s each, fitted to the beat; the 30 fps chip (the top 44 px) cropped
const LAPSES = ['progress/far-reach/timelapse-aerial-overview.mp4', 'progress/far-reach/timelapse-h2-windmill.mp4'];
LAPSES.forEach((f, k) => {
  const d = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
  ff(['-i', f, '-vf', `crop=iw:ih-44:0:44,setpts=PTS*${(DUR / d).toFixed(5)},fps=${FPS},scale=400:-2:flags=lanczos,trim=duration=${DUR},format=yuv444p`,
    '-an', '-c:v', 'libx264', '-qp', '6', '-pix_fmt', 'yuv444p', `${TMP}/lapse-${k}.mkv`]);
});

// compose on the abyss: terminal at (60, 60), the panels at the right with a cyan hairline frame each
const frame = (i) => `[${i}:v]pad=iw+4:ih+4:2:2:color=0x8fe3ff@0.55[f${i}]`;
ff(['-f', 'lavfi', '-i', `color=c=0x050a12:s=1920x1080:r=${FPS}:d=${DUR}`, '-i', `${TMP}/term.mkv`, '-i', `${TMP}/lapse-0.mkv`, '-i', `${TMP}/lapse-1.mkv`,
  '-filter_complex', [
    frame(1), frame(2), frame(3),
    '[0:v][f1]overlay=56:56:shortest=1[a]',
    '[a][f2]overlay=1066:96:shortest=1[b]',
    '[b][f3]overlay=1490:96:shortest=1,format=yuv420p[v]',
  ].join(';'),
  '-map', '[v]', '-r', String(FPS), '-c:v', 'libx264', '-crf', '12', '-preset', 'slow', '-pix_fmt', 'yuv420p', OUT]);
console.log(`[build-beat] wrote ${OUT}`);
