#!/usr/bin/env node
// SHARD-PLATFORM W1 C1 (G407): before / after pixel parity for Sky Reach and Signal Dunes while their static world pieces
// move to baked generator outputs. The capture is the shards' look-parity proofs (scripts/proof-sky-look-parity.mjs,
// scripts/proof-signal-look-parity.mjs) with `--poses=c1`: iPhone 16 Pro portrait at DPR 2 on Metal, phone and desktop
// tiers, the capture clock and pinned Math.random, a plain scene render with every time uniform held, so two captures of
// one build are byte-identical. This script adds the C1 close-ups' PNGs, a labelled contact sheet and a labelled
// BASE | CANDIDATE | DIFF board (JPEG ≤ 500 KB) with each pose's differing-pixel count.
//   scripts/browser-lane.sh node scripts/w1-c1-parity.mjs capture --url=<DEVSERVER preview> --out=<dir> [--shards=sky,signal]
//   node scripts/w1-c1-parity.mjs sheet --run=<dir> --out=<dir>
//   node scripts/w1-c1-parity.mjs compare --base=<dir> --candidate=<dir> --out=<dir> [--tier=phone|desktop] [--all]
// compare exits 1 when draws, triangles, GPU bytes, programs, shader sources, colliders or any pixel moved.
// Recipe and baseline: progress/shard-platform/w1-c1-parity/README.md.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SHARDS = { sky: { slug: 'far-reach', proof: 'scripts/proof-sky-look-parity.mjs' }, signal: { slug: 'sunscar-dunes', proof: 'scripts/proof-signal-look-parity.mjs' } };
const [mode] = process.argv.slice(2);
const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const need = (name) => { const value = arg(name); if (value === undefined) throw new Error(`${mode} requires --${name}=…`); return value; };
const magick = (args) => execFileSync('magick', args, { stdio: ['ignore', 'ignore', 'inherit'] });
// macOS ships Arial here; elsewhere ImageMagick's default font
const FONT = existsSync('/System/Library/Fonts/Supplemental/Arial.ttf') ? ['-font', '/System/Library/Fonts/Supplemental/Arial.ttf'] : [];
const TILE = 300; // px per panel on the boards (the capture is 804 × 1362)

/** @typedef {{tier:string, pose:string, calls:number, triangles:number, width:number, height:number, pixels:string, raw?:string}} Row */
/** @param {string} dir @returns {{build:string, tiers:Record<string, Record<string, unknown>>, rows:Row[]}} */
const summary = (dir) => JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8'));
/** readPixels is bottom-up: flip into a PNG @param {Row} row @param {string} png */
const toPng = (row, png) => { if (row.raw !== undefined && existsSync(row.raw)) magick(['-size', `${row.width}x${row.height}`, '-depth', '8', `rgba:${row.raw}`, '-flip', '-alpha', 'off', png]); };
const pngOf = (dir, row) => join(dir, 'png', `${row.tier}-${row.pose}.png`);

/** One labelled panel: the image scaled to TILE wide under a dark caption strip. @param {string} src @param {string[]} lines @param {string} out */
function panel(src, lines, out) {
  magick([src, '-resize', `${TILE}x`, '-background', '#111', '-gravity', 'North', '-splice', `0x${lines.length * 17 + 6}`, '-fill', 'white', ...FONT, '-pointsize', '13', '-annotate', '+0+3', lines.join('\n'), out]);
}
/** Stack rows of panels into one JPEG at most 500 KB. @param {string[][]} grid @param {string} out @param {string} work */
function board(grid, out, work) {
  const rows = grid.map((cells, i) => { const row = join(work, `row-${String(i)}.png`); magick([...cells, '+append', row]); return row; });
  const full = join(work, 'board.png'); magick([...rows, '-background', '#111', '-append', full]);
  for (const [quality, scale] of [[80, 100], [70, 100], [60, 90], [55, 75], [50, 60], [45, 50]]) {
    magick([full, '-resize', `${String(scale)}%`, '-strip', '-sampling-factor', '4:2:0', '-quality', String(quality), out]);
    if (statSync(out).size <= 500_000) return;
  }
  throw new Error(`${out} is over 500 KB at the smallest setting`);
}

if (mode === 'capture') {
  const url = need('url'), out = need('out');
  for (const key of (arg('shards') ?? 'sky,signal').split(',')) {
    if (!Object.hasOwn(SHARDS, key)) throw new Error(`unknown shard ${key} (sky, signal)`);
    const shard = SHARDS[key];
    const dir = join(out, key); mkdirSync(join(dir, 'png'), { recursive: true });
    const run = spawnSync('node', [shard.proof, `--url=${url}`, `--output=${join(dir, 'summary.json')}`, `--raw=${join(dir, 'raw')}`, '--poses=c1'], { cwd: ROOT, stdio: 'inherit' });
    if (run.status !== 0) throw new Error(`${shard.proof} failed (${String(run.status)})`);
    for (const row of summary(dir).rows) toPng(row, pngOf(dir, row));
    console.log(`w1-c1-parity: ${key} captured into ${dir}`);
  }
} else if (mode === 'sheet') {
  const run = need('run'), out = need('out'), tier = arg('tier') ?? 'phone';
  mkdirSync(out, { recursive: true });
  for (const key of Object.keys(SHARDS)) {
    const dir = join(run, key); if (!existsSync(join(dir, 'summary.json'))) continue;
    const s = summary(dir), work = join(dir, 'work'); mkdirSync(work, { recursive: true });
    const cells = s.rows.filter((r) => r.tier === tier).map((r) => {
      const cell = join(work, `sheet-${r.pose}.png`);
      panel(pngOf(dir, r), [`${SHARDS[key].slug} · ${r.pose}`, `${String(r.calls)} draws · ${String(r.triangles)} tris · ${tier} · ${s.build}`], cell);
      return cell;
    });
    const grid = []; for (let i = 0; i < cells.length; i += 3) grid.push(cells.slice(i, i + 3));
    board(grid, join(out, `${key}-${tier}-sheet.jpg`), work);
    console.log(`w1-c1-parity: ${join(out, `${key}-${tier}-sheet.jpg`)}`);
  }
} else if (mode === 'compare') {
  const baseRun = need('base'), candRun = need('candidate'), out = need('out'), tier = arg('tier') ?? 'phone', all = process.argv.includes('--all');
  mkdirSync(out, { recursive: true });
  const report = {}; let moved = false;
  for (const key of Object.keys(SHARDS)) {
    const bd = join(baseRun, key), cd = join(candRun, key); if (!existsSync(join(bd, 'summary.json')) || !existsSync(join(cd, 'summary.json'))) continue;
    const a = summary(bd), b = summary(cd), work = join(cd, 'work'); mkdirSync(work, { recursive: true });
    const lines = [], grid = [];
    for (const [t, fields] of Object.entries(a.tiers)) for (const [field, value] of Object.entries(fields)) if (JSON.stringify(value) !== JSON.stringify(b.tiers[t]?.[field])) lines.push(`${t}: ${field} ${JSON.stringify(value)} → ${JSON.stringify(b.tiers[t]?.[field])}`);
    for (const [i, ra] of a.rows.entries()) {
      const rb = b.rows.at(i);
      if (rb === undefined || rb.pose !== ra.pose || rb.tier !== ra.tier) { lines.push(`${ra.tier}/${ra.pose}: missing in candidate`); continue; }
      for (const field of ['calls', 'triangles', 'width', 'height']) if (ra[field] !== rb[field]) lines.push(`${ra.tier}/${ra.pose}: ${field} ${String(ra[field])} → ${String(rb[field])}`);
      let differ = 0;
      const same = ra.pixels === rb.pixels, haveRaw = ra.raw !== undefined && rb.raw !== undefined && existsSync(ra.raw) && existsSync(rb.raw);
      if (!same && !haveRaw) { lines.push(`${ra.tier}/${ra.pose}: pixels differ (no raw frames kept to count them)`); continue; }
      if (!same && haveRaw) {
        const pa = readFileSync(ra.raw), pb = readFileSync(rb.raw), diff = Buffer.alloc(pa.length);
        for (let p = 0; p < pa.length; p += 4) {
          const hit = pa[p] !== pb[p] || pa[p + 1] !== pb[p + 1] || pa[p + 2] !== pb[p + 2];
          if (hit) differ++;
          // differing pixels magenta; the rest the base at a third of its brightness
          diff[p] = hit ? 255 : pa[p] / 3; diff[p + 1] = hit ? 0 : pa[p + 1] / 3; diff[p + 2] = hit ? 255 : pa[p + 2] / 3; diff[p + 3] = 255;
        }
        writeFileSync(join(work, 'diff.rgba'), diff);
        magick(['-size', `${String(ra.width)}x${String(ra.height)}`, '-depth', '8', `rgba:${join(work, 'diff.rgba')}`, '-flip', '-alpha', 'off', join(work, `diff-${ra.tier}-${ra.pose}.png`)]);
        lines.push(`${ra.tier}/${ra.pose}: ${String(differ)} of ${String(pa.length / 4)} pixels differ`);
      }
      report[`${key}/${ra.tier}/${ra.pose}`] = { differ, base: { calls: ra.calls, triangles: ra.triangles }, candidate: { calls: rb.calls, triangles: rb.triangles } };
      if (ra.tier !== tier || (same && !all) || !existsSync(pngOf(bd, ra)) || !existsSync(pngOf(cd, rb))) continue;
      const cells = [['BASE', a.build, pngOf(bd, ra), ra], ['CANDIDATE', b.build, pngOf(cd, rb), rb]].map(([label, build, png, r], j) => {
        const cell = join(work, `cmp-${ra.pose}-${String(j)}.png`);
        panel(png, [`${label} ${build} · ${SHARDS[key].slug} · ${ra.pose}`, `${String(r.calls)} draws · ${String(r.triangles)} tris`], cell);
        return cell;
      });
      const diffCell = join(work, `cmp-${ra.pose}-2.png`);
      panel(same ? pngOf(bd, ra) : join(work, `diff-${ra.tier}-${ra.pose}.png`), [same ? 'DIFF: identical' : `DIFF: ${String(differ)} px differ (magenta)`, `${ra.tier} · ${ra.pose}`], diffCell);
      grid.push([...cells, diffCell]);
    }
    if (lines.length > 0) moved = true;
    console.log(`${key}: ${lines.length === 0 ? `${a.build} = ${b.build} on ${String(a.rows.length)} rows (pixels, draws, triangles, GPU bytes, programs, shaders, colliders)` : lines.join(`\n${key}: `)}`);
    if (grid.length > 0) { board(grid, join(out, `${key}-${tier}-compare.jpg`), work); console.log(`w1-c1-parity: ${join(out, `${key}-${tier}-compare.jpg`)}`); }
  }
  writeFileSync(join(out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.exit(moved ? 1 : 0);
} else throw new Error('usage: w1-c1-parity.mjs capture|sheet|compare (see the header)');
