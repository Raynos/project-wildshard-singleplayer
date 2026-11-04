#!/usr/bin/env node
// DL23 (E529, G1006, G1008): one recorded load, from the ENTER WORLD tap through 30 s of play, against Jake's bar:
// "every second a bar needs to be moving … no stalls. We can't fucking freeze the browser", and after control "the
// shard's normal fps from second one, no frame over 250 ms". The input is drive.mjs's <mode>-timeline.jsonl (card polls
// every ~200 ms, page frame stamps from a requestAnimationFrame sampler, events); the output is the run's timeline JSON
// (seconds after the tap) with a pass / fail per bar line.
//   node scripts/loading-flow/analyse.mjs <run-dir> [cold|warm|upgrade ...]   # writes <run-dir>/timeline.json, prints the verdicts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** What the player sees on the card; a change in any of these is "something moved" (the clock alone does not count). */
const CARD = ['shown', 'slug', 'tier', 'dl', 'dlPct', 'su', 'suPct', 'line', 'rows', 'lastRow', 'err'];
export const BAR = { stillS: 1, unnamedStepS: 3, loadingFrameMs: 250, playFrameMs: 250, playS: 30 };

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
/** A held step names its wait when the card's foot says what it waits for, or works on a sub-step other than the step's
 *  own title ('Now working on: World program links' under 'step 27 / 30 · First drawn frames'). */
const named = (foot, step) => {
  if (typeof foot !== 'string') return false;
  // 'Reading 8 files · 0.0 MB' is the stage's tally of reads already done (src/engine/boot/waits.ts stageReads), not
  // what it waits on: Nine's step 27 sat 3.5 s behind it with no read in flight
  if (/waiting for: Reading \d+ files · [\d.]+ MB(?: · [\d.]+ s)?$/u.test(foot)) return false;
  if (/waiting for:/iu.test(foot)) return true;
  const work = /working on: (.+)$/iu.exec(foot)?.[1]?.trim();
  const title = (step ?? '').replace(/^step \d+ \/ \d+ · /u, '').trim();
  return work !== undefined && work !== '' && work !== title && !title.endsWith(work);
};
/** The wait text without its running seconds, so one wait is listed once. */
const waitName = (foot) => foot.replaceAll(/ · \d+(?:\.\d+)? s\b/gu, '').replace(/^No reported progress for [\d.]+ s · /u, '');

/** Frame gaps from the sampler's stamps (page epoch ms), split at a page change so a navigation is not a frame. */
function frameGaps(rows) {
  const gaps = [];
  let last = null;
  for (const row of rows) {
    if (row.ev !== 'frames') continue;
    for (const at of row.f) {
      const epoch = row.origin + at;
      if (last !== null && last.origin === row.origin && epoch > last.epoch) gaps.push({ at: epoch, ms: epoch - last.epoch });
      last = { origin: row.origin, epoch };
    }
  }
  return gaps;
}

/** @param {Array<Record<string, any>>} rows one mode's timeline.jsonl rows, in order */
export function analyse(rows) {
  const events = new Map(rows.filter(row => row.ev !== 'poll' && row.ev !== 'frames').map(row => [row.ev, row]));
  const tap = events.get('tapEnter')?.t;
  if (tap === undefined) throw new Error('no tapEnter event: the run never reached ENTER WORLD');
  const rec = events.get('recStart')?.recStart ?? tap;
  const T = (ms) => round((ms - tap) / 1000);
  const polls = rows.filter(row => row.ev === 'poll' && row.t >= tap);
  const controlRow = polls.find(row => row.control === true);
  const control = controlRow?.t ?? null;
  const end = control ?? polls.at(-1)?.t ?? tap;

  const firsts = {};
  const first = (key, row, extra = {}) => { if (!(key in firsts)) firsts[key] = { t: T(row.t), ...extra }; };
  for (const row of polls) {
    if (row.shown) first('cardAppears', row, { clock: row.clock, styled: row.styled ?? null });
    if (row.clock && row.clock !== '00:00.0') first('clockMoves', row, { clock: row.clock });
    if (row.slug && row.tier) first('slugTierFill', row, { slug: row.slug, tier: row.tier.split(' · ')[0] });
    const mb = /^Spawn view · ([\d.]+) MB of/u.exec(row.dl ?? '');
    if (mb && Number(mb[1]) > 0) first('downloadMoves', row, { dl: row.dl });
    if (row.dlPct === '100' || ((row.dl ?? '').startsWith('Spawn view') && !(row.dl ?? '').includes(' of '))) first('download100', row, { dl: row.dl });
    if (row.suPct && !['0', '—'].includes(row.suPct)) first('setupMoves', row, { pct: row.suPct, step: row.su });
    if (row.control) first('control', row);
  }

  // card unchanged for a second or more between the tap and control (clock excluded: it ticks on a frozen card)
  const still = [];
  let from = null;
  const loading = polls.filter(row => row.t <= end);
  for (let i = 0; i < loading.length; i++) {
    const row = loading[i];
    if (from === null) { from = row; continue; }
    // the foot's wait counts (files, MB) move the card; its running seconds and 'No reported progress for' are a clock
    const same = CARD.every(key => row[key] === from[key]) && waitName(row.foot ?? '') === waitName(from.foot ?? '');
    if (!same || i === loading.length - 1) {
      const s = (row.t - from.t) / 1000;
      if (s >= BAR.stillS && from.shown) still.push({ from: T(from.t), to: T(row.t), s: round(s), step: from.su, pct: from.suPct, dl: from.dl, foot: from.foot ?? null });
      from = row;
    }
  }
  // a setup step (its text and %) unchanged for 3 s; it passes when the card names what it waits on, with no unnamed
  // stretch of a second or more inside it (a one-poll blip between two named waits is not a silent step)
  const stalls = [];
  from = null;
  let held = [];
  for (let i = 0; i < loading.length; i++) {
    const row = loading[i];
    if (from === null) { if (row.shown) { from = row; held = [row]; } continue; }
    if (row.su !== from.su || row.suPct !== from.suPct || i === loading.length - 1) {
      const s = (row.t - from.t) / 1000;
      if (s >= BAR.unnamedStepS) {
        let quiet = 0, quietFrom = null;
        for (const poll of [...held, row]) {
          if (poll !== row && !named(poll.foot, from.su)) quietFrom ??= poll.t;
          else if (quietFrom !== null) { quiet = Math.max(quiet, poll.t - quietFrom); quietFrom = null; }
        }
        stalls.push({ from: T(from.t), to: T(row.t), s: round(s), step: from.su, pct: from.suPct, named: quiet < 1000,
          longestUnnamedS: round(quiet / 1000), waits: [...new Set(held.filter(poll => named(poll.foot, from.su)).map(poll => waitName(poll.foot)))].slice(0, 4) });
      }
      from = row; held = [row];
    } else held.push(row);
  }

  const gaps = frameGaps(rows);
  const worst = (list) => list.reduce((a, b) => (b.ms > a.ms ? b : a), { at: tap, ms: 0 });
  const loadGaps = gaps.filter(g => g.at > tap && g.at <= end);
  const loadWorst = worst(loadGaps);
  /** fps, per-second counts and the longest frame of `frames` ({at, ms}) in the play window after control */
  const playStats = (frames, source) => {
    const stop = control + BAR.playS * 1000;
    const inside = frames.filter(g => g.at > control && g.at <= stop);
    const seen = inside.length > 0 ? (inside.at(-1).at - control) / 1000 : 0;
    const perSecond = [];
    for (let s = 0; s < BAR.playS; s++) perSecond.push(inside.filter(g => g.at > control + s * 1000 && g.at <= control + (s + 1) * 1000).length);
    const top = worst(inside);
    const settled = perSecond.slice(10).filter(n => n > 0).sort((a, b) => a - b);
    return { source, sampledS: round(seen), frames: inside.length, fps: seen > 0 ? round(inside.length / seen) : 0,
      firstSecondFps: perSecond[0], settledFps: settled.length > 0 ? settled[Math.floor(settled.length / 2)] : 0,
      lowestSecondFps: Math.min(...perSecond.slice(0, Math.max(1, Math.floor(seen)))),
      longestFrameMs: Math.round(top.ms), longestFrameAt: T(top.at), framesOver250: inside.filter(g => g.ms > BAR.playFrameMs).length, perSecond };
  };
  let play = null;
  if (control !== null) {
    // the game's drawn frames (it paces its draws, so the page's rAF can tick at 60 while the world draws at 5): each poll
    // reads frames drawn since start and the 120-slot ring of their times; the new slots spread over the poll interval
    const drawn = [];
    let prev = null;
    for (const row of polls) {
      if (!row.drawn) continue;
      if (prev !== null && row.drawn.n > prev.drawn.n && row.origin === prev.origin) {
        const k = Math.min(row.drawn.ms.length, row.drawn.n - prev.drawn.n), size = row.drawn.ms.length;
        for (let j = 0; j < k; j++) {
          const ms = row.drawn.ms[(row.drawn.i - k + j + size * 2) % size];
          drawn.push({ at: prev.t + ((row.t - prev.t) * (j + 1)) / k, ms });
        }
      }
      prev = row;
    }
    const page = playStats(gaps, 'page requestAnimationFrame');
    // what the player did: metres walked and boarded, top speed on the board (drive.mjs's walk, then hoverboard + boost)
    const motion = { walkM: 0, boostM: 0, boostTopMps: 0, boostEngaged: false };
    let last = null;
    for (const row of polls) {
      if (row.t < control || row.t > control + BAR.playS * 1000 || !row.player) continue;
      if (last !== null) {
        const d = Math.hypot(row.player.x - last.x, row.player.z - last.z);
        if (row.play === 'boost') { motion.boostM += d; motion.boostEngaged ||= row.player.boost === true && row.player.hover === true; motion.boostTopMps = Math.max(motion.boostTopMps, row.player.v); }
        else if (row.play === 'walk') motion.walkM += d;
      }
      last = row.player;
    }
    motion.walkM = Math.round(motion.walkM); motion.boostM = Math.round(motion.boostM);
    play = { ...(drawn.length > 0 ? { ...playStats(drawn, 'game drawn frames'), page } : { ...page, page: null }), motion };
  }

  const errors = [...new Set(polls.map(row => row.err).filter(Boolean))];
  const retryShown = polls.some(row => row.retry === true);
  const bar = {
    reachesControl: control !== null,
    styledFromFirstFrame: firsts.cardAppears?.styled !== false && polls.filter(row => row.shown && row.t <= end).every(row => row.styled !== false),
    cardMovesEverySecond: still.length === 0,
    noLoadingFrameOver250ms: loadGaps.length > 0 && loadWorst.ms <= BAR.loadingFrameMs,
    everyLongStepNamed: stalls.every(s => s.named),
    playNoFrameOver250ms: play !== null && play.frames > 0 && play.framesOver250 === 0 && (play.page?.framesOver250 ?? 0) === 0,
    // "normal fps from second one": no second of the first five below 80 % of the shard's settled rate (seconds 10-30)
    playSteadyFromSecondOne: play !== null && play.frames > 0 && play.perSecond.slice(0, 5).every(n => n >= 0.8 * play.settledFps),
    stuckShowsRetry: control !== null || retryShown,
    // the play window really walked and boosted (an unmoved player would read a smooth standstill)
    playWalkedAndBoosted: play !== null && play.motion.walkM >= 5 && play.motion.boostEngaged && play.motion.boostM > play.motion.walkM,
  };
  return {
    unit: 'seconds after the ENTER WORLD tap',
    shard: events.get('tapEnter')?.shard ?? null,
    tapAtRecordingS: round((tap - rec) / 1000),
    milestones: firsts,
    controlS: control === null ? null : T(control),
    cardStill_ge1s: still,
    setupStalls_ge3s: stalls,
    loading: { frames: loadGaps.length, longestFrameMs: Math.round(loadWorst.ms), longestFrameAt: T(loadWorst.at),
      framesOver250: loadGaps.filter(g => g.ms > BAR.loadingFrameMs).length },
    play,
    errors,
    retryShown,
    bar,
    pass: Object.values(bar).every(Boolean),
  };
}

export function readRun(dir, mode) {
  const file = join(dir, `${mode}-timeline.jsonl`);
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, ...asked] = process.argv.slice(2);
  if (!dir) { console.error('usage: analyse.mjs <run-dir> [cold|warm|upgrade ...]'); process.exit(2); }
  const modes = asked.length > 0 ? asked : ['cold', 'warm', 'upgrade'].filter(mode => existsSync(join(dir, `${mode}-timeline.jsonl`)));
  const meta = existsSync(join(dir, 'run.json')) ? JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')) : {};
  const out = { ...meta, bar: BAR };
  for (const mode of modes) {
    const result = analyse(readRun(dir, mode));
    out[mode] = result;
    const p = result.play;
    const line = [`${mode}: ${result.pass ? 'PASS' : 'FAIL'}`, `control ${result.controlS ?? 'never'} s`, `card still ≥1 s ×${result.cardStill_ge1s.length}`,
      `unnamed ≥3 s steps ×${result.setupStalls_ge3s.filter(s => !s.named).length}`, `loading frame max ${result.loading.longestFrameMs} ms`];
    if (p) line.push(`play ${p.fps} fps (1st s ${p.firstSecondFps}, settled ${p.settledFps}) max ${p.longestFrameMs} ms`);
    console.log(line.join('  '));
    for (const [rule, ok] of Object.entries(result.bar)) if (!ok) console.log(`  ✗ ${rule}`);
  }
  writeFileSync(join(dir, 'timeline.json'), `${JSON.stringify(out, null, 1)}\n`);
}
