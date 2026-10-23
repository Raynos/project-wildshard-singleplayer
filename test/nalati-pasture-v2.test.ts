import { beforeAll, expect, test } from 'vitest';
import { compileReturnProjectionV2 } from '../src/sdk/returnProjectionV2';
import { readDecisionSources } from '../src/sdk/buildDecisionScripts';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { Rng } from '../src/engine/core/rng';
import programs from '../src/shards/nalati-grasslands/behaviour/titan.generated.json' with { type: 'json' };
import pasture from '../src/shards/nalati-grasslands/behaviour/pasture.generated.json' with { type: 'json' };

// R10b (3): the shared pasture/wind/fire programme (nalati.pasture-wind) selected as v2 answers every original signal
// exactly as its ABI1 witness: outputs (f64, -0), refusals and the borrowed RNG.
let built: Awaited<ReturnType<typeof compileReturnProjectionV2>>;
beforeAll(async () => {
  const row = programs.wind.script;
  const ids = (values: Readonly<Record<string, string>>): Map<string, number> => new Map(Object.values(values).sort().map((name, index) => [name, index + 1]));
  built = await compileReturnProjectionV2(row, { fields: ids(row.fields), signals: ids(row.signals), channels: ids(row.channels) },
    readDecisionSources(new URL('../src/shards/nalati-grasslands/', import.meta.url).pathname), { asLineCeiling: 2837 });
}, 300_000);

test('the pasture programme keeps its exact ABI1 witness, shared by wind, fire and pasture', () => {
  expect(built.legacy).toStrictEqual({ script: programs.wind.script, bytes: programs.wind.bytes });
  expect(programs.fire).toStrictEqual(programs.wind);
  expect({ script: pasture.script, bytes: pasture.bytes }).toStrictEqual(built.legacy);
});

const FLAGS = new Set(['alive', 'blocked', 'broken', 'drivenOff', 'hit', 'mounted', 'open', 'packAlive', 'present', 'preyAlive', 'raiding', 'ready', 'spawned', 'taken', 'tracking', 'wolf']);
const COUNTS = new Set(['count', 'index', 'mode', 'raids', 'cracks', 'cracksNow', 'patrolA', 'spread', 'seed']);
const CLOCKS = new Set(['dt', 't', 'time', 'cd', 'crackCd', 'pendingT', 'raidT', 'restT', 'burn']);
function value(name: string, random: Rng): number {
  const r = random.next();
  if (r < 0.04) return -0;
  if (FLAGS.has(name)) return r < 0.5 ? 0 : 1;
  if (COUNTS.has(name)) return Math.floor(random.next() * 9);
  if (name === 'dt') return random.next() * 0.25;
  if (CLOCKS.has(name)) return random.next() < 0.2 ? 0 : (random.next() - 0.2) * 40;
  if (name === 'radius' || name === 'distance' || name === 'amount' || name === 'force') return random.next() * 80;
  return (random.next() - 0.5) * 300;
}

test('every pasture/wind/fire signal answers as the ABI1 witness on the same descriptor and borrowed RNG', () => {
  const old = ReturnProgram.page(built.legacy), next = ReturnProgram.page({ ...built.legacy, v2: built.candidate });
  const fields = built.candidate.fields, signals = built.candidate.signals, fuzz = new Rng(20261023);
  let answered = 0, refused = 0;
  for (let round = 0; round < 300; round++) for (const signal of signals) {
    const frame = Object.fromEntries(fields.map(name => [name, value(name, fuzz)]));
    const candidates = Array.from({ length: Math.floor(fuzz.next() * 9) }, () => Object.fromEntries(fields.map(name => [name, value(name, fuzz)])));
    const a = new Rng(round * 31 + 7), b = new Rng(round * 31 + 7);
    let expected: unknown, actual: unknown;
    try { expected = old.project(signal, frame, a, candidates); } catch { expected = 'refused'; }
    try { actual = next.project(signal, frame, b, candidates); } catch { actual = 'refused'; }
    expect(actual, `${signal} round ${round}`).toStrictEqual(expected);
    for (const [key, out] of Object.entries(expected === 'refused' ? {} : expected as Record<string, number>))
      expect(Object.is((actual as Record<string, number>)[key], out), `${signal}.${key} round ${round}`).toBe(true);
    expect(b.snapshot(), `${signal} rng round ${round}`).toStrictEqual(a.snapshot());
    if (expected === 'refused') refused++; else answered++;
  }
  expect(answered).toBeGreaterThan(signals.length * 100);
  expect(refused + answered).toBe(300 * signals.length);
});
