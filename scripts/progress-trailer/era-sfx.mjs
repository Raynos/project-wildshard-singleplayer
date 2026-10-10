// era-sfx.mjs — the film's sound on disk with its receipts (PROGRESS-TRAILER §3.4, PT8, E468): extracts every audio file
// the historical takes played from that SHA's own tree, gathers the recorded synth (era-audio.mjs) and the generated
// trailer families, writes the manifest and a listening reel.
//
//   node scripts/progress-trailer/era-sfx.mjs --sfx=<scratch>/sfx [--manifest=progress/progress-trailer/pt8/sfx-manifest.json]
//     [--reel=progress/progress-trailer/pt8/sfx-reel.mp3]
//
// <sfx>/era/**/<name>.json are era-audio.mjs's recordings. Each file one of them logged playing on days 8 / 15 / 22 is
// taken with `git show <sha>:public<url>` (a sprite clip cut at the offset / duration the build played it) into
// <sfx>/files/<label>/<family>.wav (48 kHz 24-bit), its licence from that set's sfx.json provenance. HEAD's rows are
// named by family (EXTRA_HEAD: the cold open's grapple on Nine Dragon). Generated families come from <sfx>/sfx-best
// (sfx_pick.py on scripts/progress-trailer/sfx-jobs.json) and <sfx>/trailer-reuse (the alpha trailer's picks).
// The reel peak-normalises each one-shot to −3 dBFS and each bed to −20 dB RMS (a listening check, not the mix).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const REPO = resolve(import.meta.dirname, '../..');
const arg = (k, d = '') => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const SFX = resolve(arg('sfx'));
const MANIFEST = resolve(REPO, arg('manifest', 'progress/progress-trailer/pt8/sfx-manifest.json'));
const REEL = resolve(REPO, arg('reel', 'progress/progress-trailer/pt8/sfx-reel.mp3'));

const BUILDS = {
  '568a1463': { label: 'd01', day: 1 }, '2d2c5815': { label: 'd08', day: 8 },
  '19a43463': { label: 'd15', day: 15 }, 'c9aaa62a': { label: 'd22', day: 22 },
};
const HEAD = execFileSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
// HEAD's cold open (the grapple across Nine Dragon's void, landing on the lower gallery): by family from its sfx.json
const EXTRA_HEAD = [
  ['nine-dragon-stack', 'feizhua.fire'], ['nine-dragon-stack', 'feizhua.zip'], ['nine-dragon-stack', 'feizhua.reel'],
  ['nine-dragon-stack', 'feizhua.bite'], ['nine-dragon-stack', 'feizhua.dock'], ['nine-dragon-stack', 'jian.swing'],
  ['nine-dragon-stack', 'step.stone.1'], ['nine-dragon-stack', 'nd.market'], ['nine-dragon-stack', 'nd.well'],
  ['nine-dragon-stack', 'lantern'], ['best', 'land'], ['best', 'land-hard'],
];
const CODE_CREDIT = 'the build\'s own procedural WebAudio code (no third-party audio); no credit needed';

const git = (sha, path) => execFileSync('git', ['-C', REPO, 'show', `${sha}:${path}`], { maxBuffer: 1 << 28 });
const ff = (args) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); };
const json = (p) => JSON.parse(readFileSync(p, 'utf8'));
const rel = (p) => relative(SFX, p);

// every recording era-audio.mjs wrote
const recs = [];
const scan = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) scan(p);
    else if (e.name.endsWith('.json')) { const r = json(p); if (r.sha && r.outputs) recs.push(r); }
  }
};
scan(join(SFX, 'era'));

const manifests = new Map(); // `${sha}:${set}` → sfx.json
const setJson = (sha, set) => {
  const k = `${sha}:${set}`;
  if (!manifests.has(k)) { try { manifests.set(k, JSON.parse(git(sha, `public/assets/sfx/${set}/sfx.json`).toString())); } catch { manifests.set(k, null); } }
  return manifests.get(k);
};
// the family a file belongs to in its set (oneshots list several takes; beds / hums one)
const familyOf = (m, file) => {
  for (const [k, v] of Object.entries(m?.oneshots ?? {})) if (v.files?.includes(file)) return { family: k, kind: 'oneshot', gain: v.gain };
  for (const kind of ['beds', 'hums']) for (const [k, v] of Object.entries(m?.[kind] ?? {})) if (v.file === file) return { family: k, kind: kind.slice(0, -1), gain: v.gain, loopStart: v.loopStart, loopEnd: v.loopEnd };
  return { family: file.replace(/-\d-[0-9a-f]{8}\.\w+$/u, ''), kind: 'oneshot' };
};
const licenceOf = (m, file) => {
  const p = (m?.provenance ?? []).find((r) => r.file === file);
  return { source: p?.source ?? p?.model ?? null, licence: p?.licence ?? null, seed: p?.seed ?? null, credit: m?.credit ?? null };
};

const extracted = new Map(); // key → row
function extract(sha, label, url, offset, duration, playedBy) {
  const m = /^\/assets\/sfx\/([^/]+)\/(.+)$/u.exec(url);
  if (!m) return;
  const [, set, file] = m, man = setJson(sha, set);
  let clip = file, cut = null;
  if (man?.sprite?.file === file) { // a sprite: the clip whose [start, dur] the build played
    const hit = Object.entries(man.sprite.clips).find(([, [s, d]]) => Math.abs(s - offset) < 0.02 && (duration === null || Math.abs(d - duration) < 0.02));
    if (!hit) return;
    clip = hit[0]; cut = hit[1];
  }
  const fam = familyOf(man, clip);
  const key = `${label}:${set}:${clip}`;
  const prev = extracted.get(key);
  if (prev) { if (!prev.playedBy.includes(playedBy)) prev.playedBy.push(playedBy); return; }
  const dir = join(SFX, 'files', label);
  mkdirSync(dir, { recursive: true });
  const src = join(dir, `.src-${file}`);
  writeFileSync(src, git(sha, `public${url}`));
  const out = join(dir, `${fam.family}--${clip.replace(/\.\w+$/u, '')}.wav`);
  ff(['-i', src, ...(cut ? ['-ss', String(cut[0]), '-t', String(cut[1])] : []), '-ar', '48000', '-c:a', 'pcm_s24le', out]);
  spawnSync('rm', [src]);
  extracted.set(key, {
    id: `${label}/${fam.family}/${clip.replace(/\.\w+$/u, '')}`, kind: 'extracted', build: label, sha, set, family: fam.family, type: fam.kind,
    source: `${sha.slice(0, 9)}:public${url}${cut ? ` [sprite clip ${clip} at ${cut[0]} s for ${cut[1]} s]` : ''}`,
    file: rel(out), gain: fam.gain, loopStart: fam.loopStart, loopEnd: fam.loopEnd, ...licenceOf(man, clip), playedBy: [playedBy],
  });
}

for (const r of recs) {
  const b = BUILDS[r.sha.slice(0, 8)];
  if (!b || b.label === 'd01') continue;
  for (const f of [...(r.files ?? []), ...(r.loopsPlaying ?? [])]) {
    for (const url of f.url.split(' | ')) extract(r.sha, b.label, url, f.offset ?? 0, f.duration ?? null, r.name);
  }
}
for (const [set, family] of EXTRA_HEAD) {
  const man = setJson(HEAD, set);
  const one = man?.oneshots?.[family]?.files?.[0] ?? man?.beds?.[family]?.file ?? man?.hums?.[family]?.file;
  if (!one) { console.log(`HEAD ${set} ${family}: not in sfx.json`); continue; }
  const cut = man.sprite?.clips?.[one];
  extract(HEAD, 'head', `/assets/sfx/${set}/${cut ? man.sprite.file : one}`, cut?.[0] ?? 0, cut?.[1] ?? null, 'cold open (by family, sfx.json)');
}

// generated families: this plan's picks + the alpha trailer's reused ones
const generated = [];
const pickRows = (picksPath, prefix, reused) => {
  if (!existsSync(picksPath)) return;
  const picks = json(picksPath);
  for (const [fam, p] of Object.entries(picks)) {
    const fileName = basename(p.file ?? `tr-${fam}.wav`).replace(/^tr-tr-/u, 'tr-');
    const file = join(SFX, prefix, fileName);
    if (!existsSync(file)) continue;
    const sa3 = /Stable Audio/u.test(p.model);
    generated.push({
      id: `trailer/${fam.replace(/^tr-/u, '')}`, kind: 'generated', file: rel(file), engine: p.model, seed: p.seed, clapRank: p.clap_rank, clapP: p.clap_p,
      reusedFrom: reused ?? undefined, perModelBest: p.per_model_best,
      licence: sa3 ? 'Stability AI Community License (free < USD 1M revenue; register for commercial use) + Gemma terms (T5Gemma encoder)' : 'Apache-2.0 (MOSS-SoundEffect v2.0)',
      credit: sa3 ? 'Sound effects: Stable Audio 3 Medium — Powered by Stability AI' : 'Sound effects: MOSS-SoundEffect v2',
    });
  }
};
pickRows(join(SFX, 'sfx-best', 'picks.json'), 'sfx-best', null);
pickRows(join(SFX, 'trailer-reuse', 'alpha-picks.json'), 'trailer-reuse', 'scripts/steam-trailer/sfx-jobs.json (the alpha trailer\'s pick, E466)');

const recorded = recs.map((r) => {
  const b = BUILDS[r.sha.slice(0, 8)] ?? { label: r.sha.slice(0, 8) };
  const chunk = /(?:^|&)chunk=([^&]+)/u.exec(r.query)?.[1] ?? 'pine-hollow'; // every build's default shard is Pine Hollow
  return {
    id: `${b.label}/${r.kind}/${r.name.replace(/^(take|bed)-/u, '')}@${chunk}`,
    kind: 'recorded', build: b.label, sha: r.sha, type: r.kind, file: rel(r.outputs[0].wav), query: r.query,
    how: r.js ? `era-audio.mjs calls: ${r.js}` : r.shot ? `era-audio.mjs take: shots/${r.shot}.mjs in real time${r.opt && Object.keys(r.opt).length > 0 ? ` --opt=${JSON.stringify(r.opt)}` : ''}` : `era-audio.mjs bed at ${JSON.stringify(r.spot)}`,
    lead: r.lead ?? 0, sec: r.sec, maxDb: r.outputs[0].maxDb, meanDb: r.outputs[0].meanDb,
    filesPlayed: [...new Set((r.files ?? []).map((f) => f.url.split('/').pop()))], loopsPlaying: [...new Set((r.loopsPlaying ?? []).map((f) => f.url.split('/').pop()))],
    events: r.events?.map((e) => ({ ...e, t: Math.round(e.t * 1000) / 1000 })),
    credit: (r.files ?? []).length + (r.loopsPlaying ?? []).length > 0 ? 'the build\'s own mix: its synth plus the files listed (see their extracted rows for licences)' : CODE_CREDIT,
  };
}).sort((a, b) => a.id.localeCompare(b.id));

const ext = [...extracted.values()].sort((a, b) => a.id.localeCompare(b.id));
const manifest = {
  _doc: 'PROGRESS-TRAILER PT8 (E468, §3.4): every sound the film may use. `file` is relative to the SFX scratch folder (`root`). recorded = the build\'s own AudioContext output (era-audio.mjs; lead = seconds of pre-roll before the call / the take\'s frame 0); extracted = the file that build played, from its own tree (`source` = sha:path); generated = MOSS-SoundEffect v2 vs Stable Audio 3 Medium, CLAP-picked (sfx_pick.py). Days 1 and 8 synthesise what has no file; days 8, 15 and 22 play the files listed under each recording.',
  root: SFX, head: HEAD, builds: Object.fromEntries(Object.entries(BUILDS).map(([k, v]) => [v.label, k])),
  credits: ['Sound effects: MOSS-SoundEffect v2 · Stable Audio 3 Medium — Powered by Stability AI'],
  notes: existsSync(join(SFX, 'notes.json')) ? json(join(SFX, 'notes.json')) : [],
  recorded, extracted: ext, generated,
};
mkdirSync(join(MANIFEST, '..'), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`manifest: ${recorded.length} recorded, ${ext.length} extracted, ${generated.length} generated → ${relative(REPO, MANIFEST)}`);

// the listening reel: per build its bed (4 s) and one-shots, then the generated families; a 0.5 s gap between sounds
const reelDir = join(SFX, 'reel');
mkdirSync(reelDir, { recursive: true });
const parts = [], index = [];
let at = 0;
const add = (id, file, bed) => {
  const out = join(reelDir, `${String(parts.length).padStart(3, '0')}.wav`);
  const src = join(SFX, file);
  const vol = spawnSync('ffmpeg', ['-hide_banner', '-i', src, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const peak = Number(/max_volume: (-?[\d.]+)/u.exec(vol)?.[1] ?? 0), mean = Number(/mean_volume: (-?[\d.]+)/u.exec(vol)?.[1] ?? -20);
  const gain = bed ? Math.min(-20 - mean, -1 - peak) : -3 - peak;
  ff(['-i', src, ...(bed ? ['-ss', '2', '-t', '4'] : []), '-af', `volume=${gain.toFixed(1)}dB,afade=t=out:st=${bed ? 3.7 : 30}:d=0.3,apad=pad_dur=0.5`, '-ar', '44100', '-ac', '2', out]);
  const d = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }).stdout);
  parts.push(out); index.push({ at: Math.round(at * 100) / 100, id }); at += d;
};
// the reel, in film order: the four rewind beds back to back (the cuts you hear), then each chapter's sounds, then HEAD's
// cold open and the generated families. An id ending in '/' takes the first extracted take of that family.
const REEL_PICK = [
  'd01/bed/rewind@pine-hollow', 'd08/bed/rewind@pine-hollow', 'd15/bed/rewind@pine-hollow', 'd22/bed/rewind@pine-hollow',
  'd01/oneshot/crossbowFire@pine-hollow', 'd01/oneshot/boltImpact-flesh@pine-hollow', 'd01/oneshot/kill@pine-hollow',
  'd01/oneshot/reload@pine-hollow', 'd01/oneshot/footsteps-walk@pine-hollow', 'd01/oneshot/deer_call@pine-hollow',
  'd08/bed/bed@driftwood-isle', 'd08/oneshot/whoosh-1@driftwood-isle', 'd08/oneshot/whoosh-finisher@driftwood-isle',
  'd08/oneshot/impact-flesh-combo@driftwood-isle', 'd08/oneshot/boar-vocal@driftwood-isle', 'd08/lunge/', 'd08/boar_squeal/',
  'd08/oneshot/footsteps-sand@driftwood-isle', 'd08/crossbowFire/',
  'd15/swordSwing/', 'd15/footstep-litter/', 'd15/steppe-wind/', 'd15/hoof-gravel/', 'd15/crossbowFire/',
  'd22/oneshot/whip-1@sunscar-dunes', 'd22/oneshot/whip-impact@sunscar-dunes', 'd22/crossbowFire/', 'd22/boltImpact-flesh/',
  'd22/hitMarker/', 'd22/kill/',
  'head/nd.market/', 'head/feizhua.fire/', 'head/feizhua.zip/', 'head/feizhua.reel/', 'head/feizhua.dock/', 'head/land/',
];
for (const id of REEL_PICK) {
  const r = id.endsWith('/') ? ext.find((e) => e.id.startsWith(id)) : recorded.find((e) => e.id === id);
  if (r) add(r.id, r.file, r.type === 'bed'); else console.log(`reel: no ${id}`);
}
for (const g of generated) add(g.id, g.file, false);
writeFileSync(join(reelDir, 'list.txt'), parts.map((p) => `file '${p}'`).join('\n'));
ff(['-f', 'concat', '-safe', '0', '-i', join(reelDir, 'list.txt'), '-c:a', 'libmp3lame', '-b:a', '96k', REEL]);
writeFileSync(REEL.replace(/\.mp3$/u, '.json'), `${JSON.stringify({ _doc: 'What plays when in sfx-reel.mp3 (seconds); levels normalised for listening (one-shots −3 dBFS peak, beds −20 dB RMS, 4 s each).', index }, null, 1)}\n`);
for (const p of parts) spawnSync('rm', [p]);
console.log(`reel: ${index.length} sounds, ${at.toFixed(1)} s → ${relative(REPO, REEL)}`);
