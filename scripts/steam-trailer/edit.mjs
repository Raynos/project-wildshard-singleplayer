// E168 Steam trailer — the conform: EDL → graded 1080p60 picture with titles, muxed with the mix.
//
//   node scripts/steam-trailer/edit.mjs <framesDir> <edl.json> <titlesDir> <mix.wav|-> <out.mp4>
//
// Per clip (edl.clips[]: { shot, in, dur, grade?, flashIn? }), from the capture's 4K 120 fps JPEG sequence:
//   tmix over the `sub` sub-frames (a 180° shutter at 2 sub-frames: real motion blur) → every sub-th frame (60 fps)
//   → Lanczos 3840×2160 → 1920×1080 (supersampled AA) → the shard's finishing grade → a lossless-ish intermediate.
// Then: concat (hard cuts on the beat), white flash-frames where a clip asks for one (the shard changes), the title PNG
// sequences (titles.mjs) overlaid at their times, a vignette + fine film grain over everything, and the final H.264
// High 1080p60 encode (Steam: ≥ 1920×1080, H.264, ≥ 5000 kbps; we give ~30 Mb/s) with 320 kb/s AAC.
// `edl.size` [w, h] (default 1920×1080): the Nine Dragon teaser's phone cut is 1080×1920 from 2160×3840 portrait captures.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const [FR, EDL, TITLES, MIX, OUT] = process.argv.slice(2);
const edl = JSON.parse(readFileSync(EDL, 'utf8'));
const FPS = 60;
const [W, H] = edl.size ?? [1920, 1080];
const TMP = `${OUT}.parts`;
mkdirSync(TMP, { recursive: true });
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

// finishing grades: small moves — each shard keeps its own look (toon / painterly / photoreal), this only seats them in
// one film. eq in gamma-space; colorbalance for a whisper of split-tone.
const GRADES = {
  driftwood: 'eq=contrast=1.04:saturation=1.06:gamma=0.99,colorbalance=rs=-0.01:bs=0.02:rh=0.02:bh=-0.01',
  nalati: 'eq=contrast=1.05:saturation=1.03:gamma=0.98,colorbalance=rs=-0.02:bs=0.03:rh=0.03:gh=0.01:bh=-0.02',
  pine: 'eq=contrast=1.07:saturation=1.02:gamma=0.97,colorbalance=rs=-0.03:gs=-0.01:bs=0.04:rh=0.04:gh=0.01:bh=-0.03',
  night: 'eq=contrast=1.08:saturation=0.98:gamma=0.97,colorbalance=rs=-0.02:bs=0.05:rh=0.02:bh=-0.01',
  // Nine Dragon Stack carries its own Jiehua grade (the learned LUT, the shoulder): only a touch of contrast to seat it
  'nine-dragon': 'eq=contrast=1.04:saturation=1.03:gamma=0.99',
  none: 'null',
};

const parts = [];
edl.clips.forEach((c, k) => {
  if (c.shot === 'black') { // a held black (the beat before the final hit)
    const out = `${TMP}/${String(k).padStart(2, '0')}-black.mkv`;
    parts.push(out);
    const frames = Math.round((c.at + c.dur) * FPS) - Math.round(c.at * FPS);
    ff(['-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=${FPS}`, '-frames:v', String(frames), '-vf', 'format=yuv444p', '-c:v', 'libx264', '-qp', '4', '-pix_fmt', 'yuv444p', out]);
    return;
  }
  const dir = `${FR}/${c.shot}`;
  const meta = JSON.parse(readFileSync(`${dir}/meta.json`, 'utf8'));
  // frames from the cut's absolute times (per-clip rounding would drift ~3 frames over 20 cuts)
  const sub = meta.sub, start = Math.round(c.in * FPS) * sub, frames = Math.round((c.at + c.dur) * FPS) - Math.round(c.at * FPS);
  const f = (n) => `${dir}/${String(n).padStart(6, '0')}.jpg`;
  if (!existsSync(f(start)) || !existsSync(f(start + frames * sub - 1))) throw new Error(`${c.shot}: sub-frames ${start}..${start + frames * sub - 1} not captured`);
  const out = `${TMP}/${String(k).padStart(2, '0')}-${c.shot}.mkv`;
  parts.push(out);
  if (existsSync(out) && !edl.rebuild) return;
  const vf = [
    sub > 1 ? `tmix=frames=${sub}` : null,
    sub > 1 ? `select='not(mod(n\\,${sub}))'` : null,
    `setpts=N/(${FPS}*TB)`,
    // JPEG is full-range BT.601 4:2:0 at 4K; out is limited-range BT.709 — at 1080 the 4K chroma is full 4:4:4
    `scale=${W}:${H}:flags=lanczos+accurate_rnd+full_chroma_int:in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709`,
    GRADES[c.grade ?? meta.shard] ?? 'null',
    c.flashIn ? `fade=t=in:st=0:d=${c.flashIn}:color=white` : null,
    c.fadeOut ? `fade=t=out:st=${(c.dur - c.fadeOut).toFixed(3)}:d=${c.fadeOut}:color=black` : null,
    'format=yuv444p',
  ].filter(Boolean).join(',');
  // -frames:v is an OUTPUT limit here (after -i): the clip's 60 fps frame count, not its sub-frames (it read into the handles)
  ff(['-framerate', String(FPS * sub), '-start_number', String(start), '-i', `${dir}/%06d.jpg`, '-frames:v', String(frames),
    '-vf', vf, '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-qp', '4', '-pix_fmt', 'yuv444p', out]);
  console.log(`[edit] ${c.shot} ${c.in}+${c.dur}s`);
});

writeFileSync(`${TMP}/list.txt`, parts.map((p) => `file '${p}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', `${TMP}/list.txt`, '-c', 'copy', `${TMP}/picture.mkv`]);

// the finish (vignette + grain), the titles over it, then the encode
const inputs = ['-i', `${TMP}/picture.mkv`];
// the finish sits under the type: the vignette would grey the titles' white and cyan, the grain would crawl on them
const chains = ['[0:v]vignette=angle=0.42:mode=forward,noise=c0s=3:c0f=t+u[pic]'];
let last = '[pic]';
(edl.titles ?? []).forEach((t, k) => {
  inputs.push('-framerate', String(FPS), '-i', `${TITLES}/${t.id}/%05d.png`);
  chains.push(`[${k + 1}:v]format=rgba,setpts=PTS-STARTPTS+${t.at}/TB[t${k}]`);
  chains.push(`${last}[t${k}]overlay=eof_action=pass:format=yuv444[v${k}]`);
  last = `[v${k}]`;
});
chains.push(`${last}format=yuv420p[vout]`);
const audio = MIX && MIX !== '-' ? ['-i', MIX] : [];
const aIdx = (edl.titles ?? []).length + 1;
ff([...inputs, ...audio, '-filter_complex', chains.join(';'), '-map', '[vout]', ...(audio.length > 0 ? ['-map', `${aIdx}:a`] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-level', '4.2', '-crf', '14', '-maxrate', '40M', '-bufsize', '80M',
  '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-r', String(FPS), '-g', '30',
  ...(audio.length > 0 ? ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000'] : []), '-shortest', '-movflags', '+faststart', OUT]);
console.log(`[edit] wrote ${OUT}`);
