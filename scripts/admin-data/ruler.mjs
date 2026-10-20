#!/usr/bin/env node
// The SHARD-PLATFORM ruler data for the admin Plan card (G458: outcome-only accounting). One committed file,
// progress/shard-platform/ruler/ruler.json, refreshed from `node scripts/shard-platform.mjs --json --source-progress` measured in the
// build mirror on a commit (never the shared working tree). The admin build only reads the committed file.
//
//   node scripts/admin-data/ruler.mjs [--rev=HEAD]       measure <rev> in the `check` mirror slot, rewrite ruler.json
//   then: git commit -m "chore(admin): refresh the plan ruler" -- progress/shard-platform/ruler/ruler.json \
//           src/game/shard/portShares.json
// It also rewrites SHARD SELECT's PORTED table from the new ruler (scripts/gen-port-shares.mjs, E486); pre-commit
// refuses a ruler.json committed without its matching table.
//
// Whole plan = 60 % × M3 + 40 % × M2 (a range while M2 has unknown checks). Per shard: custom lines ÷ frozen legacy
// lines (lower is better; goal 20 %, 10 % for Sky Reach and Signal Dunes). No effort, hours or projections.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as v from 'valibot';
import { writePortShares } from '../gen-port-shares.mjs';

export const RULER_PATH = 'progress/shard-platform/ruler/ruler.json';
export const RULER_CHART = 'progress/shard-platform/ruler/custom-vs-hours.jpg';
export const RULER_COMMAND = 'node scripts/shard-platform.mjs --json --source-progress';
export const RULER_SCHEMA = 'shard-platform-ruler/1';

// Keep signed cuts: platform growth can exceed the custom shard reduction.
const criterionSchema=v.object({verdict:v.picklist(['pass','fail','unknown']),evidence:v.string()});
const floorSummarySchema=v.object({ready:v.number(),fail:v.number(),unknown:v.number(),total:v.number()});

const netLinesSchema = v.array(v.object({
  wave: v.string(), revision: v.string(), customCut: v.nullable(v.number()),
  platformGrowth: v.number(), netCut: v.nullable(v.number()),
  layers: v.object(Object.fromEntries(['engine', 'game', 'format', 'sdk'].map(layer => [layer,
    v.object({ before: v.number(), after: v.number(), growth: v.number() })]))),
}));
const componentStatesSchema = v.record(v.pipe(v.string(), v.regex(/^C[1-9]$/u)),
  v.pipe(v.object({ closed: v.boolean(), state: v.exactOptional(v.picklist(['closed', 'closing', 'open'])),
    lines: v.record(v.string(), v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0)))) }),
    v.check(row => !row.closed || Object.keys(row.lines).length > 0 && Object.values(row.lines).every(lines => lines === 0), 'closed components require every shard at zero'),
    v.check(row => row.state === undefined || (row.state === 'closed') === row.closed, 'component state must match closure')));
const componentWavesSchema = v.array(v.object({ id: v.string(), components: componentStatesSchema }));

/** The six legacy shards, in wave order. */
export const SHARDS = /** @type {const} */ ([
  { slug: 'pine-hollow', name: 'Pine Hollow', wave: 'W2', goal: 20 },
  { slug: 'driftwood-isle', name: 'Driftwood', wave: 'W2', goal: 20 },
  { slug: 'far-reach', name: 'Sky Reach', wave: 'W1', goal: 10 },
  { slug: 'sunscar-dunes', name: 'Signal Dunes', wave: 'W1', goal: 10 },
  { slug: 'nalati-grasslands', name: 'Nalati', wave: 'W3', goal: 20 },
  { slug: 'nine-dragon-stack', name: 'Nine Dragon', wave: 'W3', goal: 20 },
]);

/** The mini-plan order (G471): W1 below 10%, then W2 below 20%, then W3. Every wave closes on its shard goals.
 * @type {readonly {id:string;label:string;shards:readonly string[];goal:number;until:string|null;start:Record<string,number>|null}[]} */
export const WAVES = [
  { id: 'W1', label: 'W1 · Sky + Signal under 10%', shards: ['far-reach', 'sunscar-dunes'], goal: 10, until: null, start: null },
  { id: 'W2', label: 'W2 · Pine + Driftwood under 20%', shards: ['pine-hollow', 'driftwood-isle'], goal: 20,
    until: null, start: { 'pine-hollow': 107.6, 'driftwood-isle': 104.2 } },
  { id: 'W3', label: 'W3 · Nalati + Nine', shards: ['nalati-grasslands', 'nine-dragon-stack'], goal: 20, until: null, start: null },
  { id: 'NEXT', label: 'NEXT', shards: [], goal: 20, until: null, start: null },
];

/** @typedef {{slug:string;name:string;wave:string;goal:number;custom:number;legacy:number;pct:number;grid:'pass'|'fail'|'unknown';criteria:Record<string,string>;frameFloor?:import('../shard-milestones.mjs').Criterion}} RulerShard */
/** @typedef {{revision:string;at:string;basis:string;shards:Record<string,number>}} RulerPoint */
/** @typedef {{id:string;startedAt:string;start:Record<string,number>;endedAt:string|null}} RulerWaveState */
/** @typedef {{schema:string;command:string;revision:string;committedAt:string;measuredAt:string;basis:string;
 *   plan:{lower:number;upper:number};m3:{cut:number;mustGo:number;fraction:number};m2:{ready:number;fail:number;unknown:number;total:number};
 *   frameFloor?:{ready:number;fail:number;unknown:number;total:number};netLines?:import('./ruler.mjs').RulerNetLines[];customSectionFailures?:string[];shards:RulerShard[];native:string[];wave:{id:string;label:string;until:string|null;pct:number;shards:string[];goal:number};
 *   components?:Record<string,{closed:boolean;state?:'closed'|'closing'|'open';lines:Record<string,number|null>}>;
 *   componentWaves?:{id:string;components:Record<string,{closed:boolean;state?:'closed'|'closing'|'open';lines:Record<string,number|null>}>}[];
 *   waves:RulerWaveState[];history:RulerPoint[];events:{at:string;label:string}[]}} Ruler */

/** @param {unknown} value @returns {value is Record<string,unknown>} */
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** @param {unknown} value @param {string} where @returns {number} */
function num(value, where) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Ruler: ${where} is not a nonnegative number`);
  return value;
}
/** @param {unknown} value @param {string} where @returns {string} */
function str(value, where) {
  if (typeof value !== 'string' || value === '') throw new Error(`Ruler: ${where} is not a string`);
  return value;
}
const pct1 = (/** @type {number} */ x) => Math.round(x * 10) / 10;

/** One wave's progress: the mean over its shards of (start − now) ÷ (start − goal), each clamped to 0..1.
 * @param {Partial<Record<string,number>>} start @param {Partial<Record<string,number>>} now @param {readonly string[]} shards @param {number} goal */
export function wavePercent(start, now, shards, goal) {
  if (shards.length === 0) return 0;
  const parts = shards.map((slug) => {
    const from = start[slug], to = now[slug];
    if (from === undefined || to === undefined || from <= goal) return to !== undefined && to <= goal ? 1 : 0;
    return Math.max(0, Math.min(1, (from - to) / (from - goal)));
  });
  return pct1((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

/** The ruler's `--json` output + the previous file → the next file. Pure: the clock and the commit time are arguments.
 * @param {unknown} raw @param {Ruler|null} prev @param {{revision:string;committedAt:string;now:string}} at @returns {Ruler} */
export function nextRuler(raw, prev, at) {
  if (!isObject(raw) || !isObject(raw._summary)) throw new Error(`Ruler: ${RULER_COMMAND} printed no _summary`);
  const summary = raw._summary, progress = summary.progress;
  if (!isObject(progress) || !isObject(progress.m3) || !isObject(progress.m2) || !isObject(progress.plan)) throw new Error('Ruler: _summary.progress lacks m3 / m2 / plan');
  /** @type {string[]} */
  const bases = [];
  const shards = SHARDS.map(({ slug, name, wave, goal }) => {
    const row = raw[slug];
    if (!isObject(row) || !isObject(row.m3)) throw new Error(`Ruler: ${slug} has no m3 row`);
    const custom = num(row.m3.customLines, `${slug}.m3.customLines`), legacy = num(row.m3.legacyLines, `${slug}.m3.legacyLines`);
    if (legacy === 0) throw new Error(`Ruler: ${slug} has no legacy lines`);
    bases.push(str(row.m3.basis, `${slug}.m3.basis`));
    const grid = isObject(row.gridReady) ? row.gridReady : {};
    const verdict = grid.verdict === 'pass' || grid.verdict === 'fail' ? grid.verdict : 'unknown';
    const criteria = isObject(grid.criteria) ? Object.fromEntries(Object.entries(grid.criteria).map(([k, criterion]) => [k, isObject(criterion) && typeof criterion.verdict === 'string' ? criterion.verdict : 'unknown'])) : {};
    const frameFloor=v.parse(criterionSchema,grid.frameFloor??{verdict:'unknown',evidence:'No qualified exact-SHA frame-floor receipt'});
    return { slug, name, wave, goal, custom, legacy, pct: pct1((custom / legacy) * 100), grid: verdict, criteria,frameFloor };
  });
  const kinds = [...new Set(bases)];
  if (kinds.length !== 1) throw new Error('Ruler: the shards disagree on the basis');
  const basis = kinds.join('');
  const native = Object.keys(raw).filter((slug) => slug !== '_summary' && !SHARDS.some((s) => s.slug === slug)).sort();
  const m2total = num(progress.m2.total, 'm2.total'), ready = num(progress.m2.ready, 'm2.ready'), unknown = num(progress.m2.unknown, 'm2.unknown');
  /** @type {Partial<Record<string,number>>} */
  const now = Object.fromEntries(shards.map((s) => [s.slug, (s.custom / s.legacy) * 100]));
  const events = [...(prev?.events ?? [])];
  if (prev && prev.basis !== basis) events.push({ at: at.now, label: `P4 re-base: the ruler moves from the ${prev.basis} basis to ${basis}` });
  // Old reports may have closed W2 on the cancelled midnight deadline.
  // Restart that schedule under G471 while retaining its measurement history.
  const superseded = prev !== null && (prev.wave.until !== null || prev.waves.some(wave => wave.id === 'W1 spike'));
  if (superseded) events.push({ at: at.now, label: 'G471: waves follow the mini-plan goals; midnight close cancelled' });
  /** @type {RulerWaveState[]} */
  const waves = structuredClone(superseded ? [] : prev?.waves ?? []);
  /** @type {Partial<Record<string,number>>} */
  const last = prev?.history.at(-1)?.shards ?? now;
  let current = WAVES[WAVES.length - 1];
  for (const wave of WAVES) {
    let state = waves.find((w) => w.id === wave.id);
    if (!state) {
      state = { id: wave.id, startedAt: at.now, start: wave.start ?? Object.fromEntries(wave.shards.map((slug) => [slug, last[slug] ?? now[slug] ?? 0])), endedAt: null };
      if (wave.id === 'W2') state.startedAt = '2026-10-14T04:19:00Z';
      else events.push({ at: at.now, label: `${wave.id} starts` });
      waves.push(state);
    }
    if (state.endedAt === null) {
      const done = wave.shards.length > 0 && wave.shards.every((slug) => (now[slug] ?? Infinity) <= wave.goal);
      if (done && wave.id !== 'NEXT') {
        state.endedAt = at.now;
        events.push({ at: state.endedAt, label: `${wave.id} closes` });
      }
    }
    if (state.endedAt === null) { current = wave; break; }
  }
  const currentState = waves.find((w) => w.id === current.id);
  const history = [...(prev?.history ?? [])];
  if (history.at(-1)?.revision !== at.revision) history.push({ revision: at.revision, at: at.committedAt, basis, shards: now });
  return {
    schema: RULER_SCHEMA, command: RULER_COMMAND, revision: at.revision, committedAt: at.committedAt, measuredAt: at.now, basis,
    plan: { lower: num(progress.plan.lower, 'plan.lower'), upper: num(progress.plan.upper, 'plan.upper') },
    m3: { cut: num(progress.m3.cut, 'm3.cut'), mustGo: num(progress.m3.mustGo, 'm3.mustGo'), fraction: num(progress.m3.fraction, 'm3.fraction') },
    m2: { ready, fail: m2total - ready - unknown, unknown, total: m2total },
    frameFloor: {ready:shards.filter(row=>row.frameFloor.verdict==='pass').length,fail:shards.filter(row=>row.frameFloor.verdict==='fail').length,
      unknown:shards.filter(row=>row.frameFloor.verdict==='unknown').length,total:shards.length},
    netLines: v.parse(netLinesSchema, summary.netLines),
    ...(summary.components === undefined ? {} : { components: v.parse(componentStatesSchema, summary.components) }),
    ...(summary.waves === undefined ? {} : { componentWaves: v.parse(componentWavesSchema, summary.waves) }),
    // G514: budget overruns are recorded, never a reason to skip a measurement.
    customSectionFailures: v.parse(v.array(v.string()), summary.customSectionFailures ?? []),
    shards, native,
    wave: { id: current.id, label: current.label, until: current.until, goal: current.goal, shards: [...current.shards],
      pct: wavePercent(currentState?.start ?? {}, now, current.shards, current.goal) },
    waves, history: history.slice(-300), events,
  };
}

/** Validates a committed ruler.json for the admin build; a missing or malformed file fails the build (no fallback).
 * @param {unknown} value @returns {Ruler} */
export function readRuler(value) {
  if (!isObject(value) || value.schema !== RULER_SCHEMA) throw new Error(`Ruler: ${RULER_PATH} is not ${RULER_SCHEMA}`);
  if (typeof value.revision !== 'string' || !/^[a-f\d]{40}$/u.test(value.revision)) throw new Error('Ruler: revision must be a full SHA');
  for (const key of ['committedAt', 'measuredAt', 'basis', 'command']) str(value[key], key);
  const { shards, plan, m3, m2, wave } = value;
  if (!Array.isArray(shards) || shards.length !== SHARDS.length) throw new Error('Ruler: six shards required');
  for (const s of shards) {
    if (!isObject(s)) throw new Error('Ruler: a shard row is not an object');
    const slug = str(s.slug, 'shard slug');
    for (const key of ['custom', 'legacy', 'pct', 'goal']) num(s[key], `${slug}.${key}`);
    if(s.frameFloor!==undefined)v.parse(criterionSchema,s.frameFloor);
    if (s.grid !== 'pass' && s.grid !== 'fail' && s.grid !== 'unknown') throw new Error(`Ruler: ${slug}.grid invalid`);
  }
  if (!isObject(plan) || !isObject(m3) || !isObject(m2) || !isObject(wave)) throw new Error('Ruler: plan, m3, m2 and wave are objects');
  for (const key of ['lower', 'upper']) if (num(plan[key], `plan.${key}`) > 1) throw new Error(`Ruler: plan.${key} above 1`);
  num(m3.fraction, 'm3.fraction'); num(m2.total, 'm2.total'); num(wave.pct, 'wave.pct');
  // Existing snapshots predate G496; newly measured snapshots always carry it.
  if(value.frameFloor!==undefined)v.parse(floorSummarySchema,value.frameFloor);
  if (value.netLines !== undefined) v.parse(netLinesSchema, value.netLines);
  if (value.components !== undefined) v.parse(componentStatesSchema, value.components);
  if (value.componentWaves !== undefined) v.parse(componentWavesSchema, value.componentWaves);
  if (value.customSectionFailures !== undefined) v.parse(v.array(v.string()), value.customSectionFailures);
  if (!Array.isArray(value.history) || !Array.isArray(value.events) || !Array.isArray(value.native)) throw new Error('Ruler: history, events and native are arrays');
  return /** @type {Ruler} */ (/** @type {unknown} */ (value));
}

/** Retain history across a scoring correction; the old aggregate is replaced by the fresh measurement.
 * @param {unknown} value @param {Ruler['plan']} plan @returns {Ruler} */
export function readRulerHistory(value, plan) {
  return readRuler(isObject(value) ? { ...value, plan } : value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const repo = resolve(import.meta.dirname, '../..');
  const rev = process.argv.slice(2).find((a) => a.startsWith('--rev='))?.slice(6) ?? 'HEAD';
  const git = (/** @type {string[]} */ ...args) => execFileSync('git', ['-C', repo, ...args]).toString('utf8').trim();
  const revision = git('rev-parse', '--verify', `${rev}^{commit}`);
  const committedAt = new Date(Number(git('show', '-s', '--format=%ct', revision)) * 1000).toISOString();
  // Take the mirror first, then the build lease. The CLI prepares all ten
  // verified products (including _template) before reading section inventory.
  const out = execFileSync(process.execPath, [resolve(repo, 'scripts/build-mirror.mjs'), 'run', revision, '--slot', 'check', '--', 'python3', 'scripts/heavy-lane.py', 'build', '--', ...RULER_COMMAND.split(' ')],
    { cwd: repo, maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'inherit'] }).toString('utf8');
  const start = out.search(/^\{/mu);
  if (start === -1) throw new Error(`Ruler: ${RULER_COMMAND} printed no JSON`);
  const file = resolve(repo, RULER_PATH);
  // --seed=<json> {history, events}: only for the first file, e.g. the series a custom-vs-hours chart measured.
  const seed = process.argv.slice(2).find((a) => a.startsWith('--seed='))?.slice(7);
  const seeded = seed ? /** @type {Ruler} */ ({ basis: 'source', waves: [], ...JSON.parse(readFileSync(resolve(seed), 'utf8')) }) : null;
  const measured = JSON.parse(out.slice(start));
  const at = { revision, committedAt, now: new Date().toISOString() };
  const fresh = nextRuler(measured, null, at);
  const prev = existsSync(file) ? readRulerHistory(JSON.parse(readFileSync(file, 'utf8')), fresh.plan) : seeded;
  const next = readRuler(nextRuler(measured, prev, at));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, `${JSON.stringify(next, null, 1)}\n`);
  renameSync(`${file}.tmp`, file);
  writePortShares(repo);
  console.info(`ruler ${revision.slice(0, 9)}: plan ${pct1(next.plan.lower * 100)}–${pct1(next.plan.upper * 100)} %, M3 ${pct1(next.m3.fraction * 100)} %, M2 ${next.m2.ready}/${next.m2.total}; ${next.wave.id} ${next.wave.pct} % → ${RULER_PATH}`);
}
