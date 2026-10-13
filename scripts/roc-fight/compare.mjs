#!/usr/bin/env node
// G393 (sp-o130): a labelled BEFORE | AFTER comparison of two scripts/roc-fight/capture.mjs outputs: the two contact
// sheets stacked (BEFORE over AFTER, every still already labelled with its build and frame), the two clips side by side
// (each run's own beats, so the panes line up only where the fights do), and a fact diff (the canonical headless fight
// from the witness tape and the page fight) as JSON and as a short Markdown table.
//   node scripts/roc-fight/compare.mjs --before=<capture dir> --after=<capture dir> --out=<dir>
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const arg = (/** @type {string} */ name) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const beforeArg = arg('before'), afterArg = arg('after'), outArg = arg('out');
if (beforeArg === undefined || afterArg === undefined || outArg === undefined) throw new Error('Requires --before=<dir> --after=<dir> --out=<dir>');
const before = resolve(beforeArg), after = resolve(afterArg), out = resolve(outArg);
mkdirSync(out, { recursive: true });
/** @typedef {Record<string, unknown>} Obj */
const load = (/** @type {string} */ dir) => /** @type {Obj} */ (JSON.parse(readFileSync(join(dir, 'facts.json'), 'utf8')));
const a = load(before), b = load(after);
const obj = (/** @type {unknown} */ v) => /** @type {Obj} */ (v !== null && typeof v === 'object' ? v : {});

/** The headline numbers of each fight, before → after. */
const KEYS = {
  headless: ['endpointTick', 'victoryTick', 'crownTick', 'fightTicks', 'attempts', 'fightHitsTaken', 'fightDamageTaken', 'journeyHitsTaken', 'minPlayerHp', 'stoops', 'hash'],
  page: ['fightFrames', 'fightTicks', 'attempts', 'hitsTaken', 'damageTaken', 'minPlayerHp', 'stoops'],
};
/** @type {{ side: string; key: string; before: unknown; after: unknown; delta: number | null }[]} */
const rows = [];
for (const [side, keys] of Object.entries(KEYS)) for (const key of keys) {
  const x = obj(a[side])[key], y = obj(b[side])[key];
  rows.push({ side, key, before: x ?? null, after: y ?? null, delta: typeof x === 'number' && typeof y === 'number' ? Math.round((y - x) * 100) / 100 : null });
}
/** The encounter changes (state / phase / attempts) side by side. */
const changes = (/** @type {Obj} */ facts, /** @type {string} */ side) => /** @type {Obj[]} */ (obj(facts[side]).changes ?? []);
/** @type {Record<string, { before: Obj[]; after: Obj[] }>} */
const encounter = {};
for (const side of ['headless', 'page']) encounter[side] = { before: changes(a, side), after: changes(b, side) };
const same = rows.every(row => JSON.stringify(row.before) === JSON.stringify(row.after)) && Object.values(encounter).every(e => JSON.stringify(e.before) === JSON.stringify(e.after));
const diff = { before: { label: a.label, build: a.build, deterministic: a.deterministic }, after: { label: b.label, build: b.build, deterministic: b.deterministic }, identical: same, rows, encounter };
writeFileSync(join(out, 'diff.json'), `${JSON.stringify(diff, null, 1)}\n`);
const cell = (/** @type {unknown} */ v) => (typeof v === 'string' && v.length > 16 ? `${v.slice(0, 12)}…` : JSON.stringify(v));
const lines = [`# Roc fight: ${String(a.label)} ${String(a.build).slice(0, 9)} vs ${String(b.label)} ${String(b.build).slice(0, 9)}`, '',
  same ? 'Every headline fact and every encounter change is identical.' : 'Facts differ (rows with a delta or a changed value below).', '',
  '| fight | fact | before | after | delta |', '|---|---|---|---|---|',
  ...rows.map(row => `| ${row.side} | ${row.key} | ${cell(row.before)} | ${cell(row.after)} | ${row.delta === null ? (JSON.stringify(row.before) === JSON.stringify(row.after) ? '=' : '≠') : String(row.delta)} |`), ''];
for (const [side, e] of Object.entries(encounter)) {
  lines.push(`## ${side} encounter changes`, '', '| before | after |', '|---|---|');
  const unit = side === 'page' ? 'frame' : 'tick';
  for (let i = 0; i < Math.max(e.before.length, e.after.length); i++) {
    const show = (/** @type {Obj | undefined} */ c) => c === undefined ? '—' : `${unit} ${String(c[unit])}: ${String(c.state)} p${String(Number(c.phase) + 1)} HP ${String(c.rocHp)}`;
    lines.push(`| ${show(e.before[i])} | ${show(e.after[i])} |`);
  }
  lines.push('');
}
writeFileSync(join(out, 'diff.md'), `${lines.join('\n')}\n`);
const ff = (/** @type {string[]} */ args) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); if (r.status !== 0) throw new Error(`ffmpeg ${args.join(' ')}`); };
// the sheets: BEFORE over AFTER (each still carries its own label)
ff(['-i', join(before, 'sheet.jpg'), '-i', join(after, 'sheet.jpg'), '-filter_complex', '[0][1]vstack=inputs=2', '-q:v', '6', join(out, 'sheets.jpg')]);
// the clips: BEFORE | AFTER, the shorter one holding its last frame
if (existsSync(join(before, 'clip.mp4')) && existsSync(join(after, 'clip.mp4'))) {
  ff(['-i', join(before, 'clip.mp4'), '-i', join(after, 'clip.mp4'), '-filter_complex', '[0]tpad=stop=-1:stop_mode=clone[l];[1]tpad=stop=-1:stop_mode=clone[r];[l][r]hstack=inputs=2:shortest=0',
    '-t', String(Math.max(...[before, after].map(dir => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', join(dir, 'clip.mp4')], { encoding: 'utf8' }).stdout) || 0))),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '32', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(out, 'clips.mp4')]);
}
console.log(lines.slice(0, 3).join('\n'));
console.log(`wrote ${join(out, 'diff.md')}, diff.json, sheets.jpg, clips.mp4`);
process.exitCode = same ? 0 : 1;
