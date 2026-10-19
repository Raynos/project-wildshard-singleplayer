// oxlint-disable-next-line import/no-nodejs-modules -- Compile both preserved and observation-only Wasm guests for exact command equivalence.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { generateDecisionBindings } from '@wildshard/sdk/decisionScriptBindings';
import { DecisionHost, type DecisionScript } from '@wildshard/engine/script/decision';
import { createScriptScenario, type ScenarioCommand } from '@wildshard/sdk/scriptScenario';
import { DRIFTWOOD_REGULAR_DECISIONS, DRIFTWOOD_REGULAR_FIELDS, DRIFTWOOD_REGULAR_MOVES, DRIFTWOOD_REGULAR_STRIKES } from '../src/shards/driftwood-isle/generators/driftwoodRegularCombat';
import { MANTIS_PHASE_DECISIONS, MANTIS_PHASE_FIELDS } from '../src/shards/driftwood-isle/generators/mantisPhaseDecision';

const original = DRIFTWOOD_REGULAR_DECISIONS.filter(row => row.id === 'driftwood.splinter-mantis.decision');
const fields = [...DRIFTWOOD_REGULAR_FIELDS, ...MANTIS_PHASE_FIELDS];
const registries = { actors: new Map([['driftwood.splinter-mantis', 1]]), fields: new Map(fields.map(row => [row.name, row.id])),
  moves: new Map(DRIFTWOOD_REGULAR_MOVES.map((row, i) => [row.id, i + 10])), strikes: new Map(DRIFTWOOD_REGULAR_STRIKES.map((row, i) => [row.id, i + 20])) };
let products: Awaited<ReturnType<typeof compileDecisionScripts>>[];
beforeAll(async () => {
  products = await Promise.all([original, MANTIS_PHASE_DECISIONS].map(rows => compileDecisionScripts(rows, registries,
    new Map(rows.map(row => [row.source, readFileSync(`src/shards/driftwood-isle/${row.source}`, 'utf8')])), { asLineCeiling: 100 })));
});
function make(index: number) {
  const product = products[index], row = product?.rows[0], blob = product?.blobs[0];
  if (row === undefined || blob === undefined) throw new Error('Missing compiled guest');
  const script: DecisionScript = { ...row, ids: generateDecisionBindings(row, registries).map.ids,
    reads: ['nearestPlayer', 'distance', 'field', 'alive', 'strikeState', 'stunned'], lists: [] };
  return createScriptScenario(DecisionHost, { bytes: blob.bytes, script, seed: 17,
    binding: { id: 1, script: row.id, self: 1, actors: [1], instance: 0 },
    actors: [{ id: 1, at: [0, 0, 0], fields: Object.fromEntries(fields.map(f => [f.id, f.default])) }], players: [{ id: 99, at: [0, 0, 8] }] });
}
const tactics = (commands: readonly ScenarioCommand[]) => commands.filter(row => row[0] !== 'field' || !['posePhase', 'poseClock'].includes(String(row[2])));
const tacticalState = (state: Readonly<Record<string, number | boolean>>) => Object.fromEntries(Object.entries(state).filter(([name]) => !['posePhase', 'poseClock'].includes(name)));

test('original and observer guests emit identical tactical commands and original state through all strike phases, interruptions and death', () => {
  const pair = [make(0), make(1)];
  const compare = () => { expect(tactics(pair[1]?.commands() ?? [])).toEqual(pair[0]?.commands()); expect(tacticalState(pair[1]?.state() ?? {})).toEqual(pair[0]?.state()); };
  for (const s of pair) s.send('start'); compare();
  for (const s of pair) s.advance(.3); compare(); // approach at unchanged speed/target
  for (const s of pair) s.world.setActor({ id: 99, at: [0, 0, 2] });
  for (const s of pair) s.advance(.1); compare();
  for (const phase of [1, 2, 2, 2, 3, 0]) {
    for (const s of pair) { const actor = s.world.snapshot().actors?.[0]; if (actor === undefined) throw new Error('Missing actor'); s.world.setActor({ ...actor, strikeState: phase }); s.advance(.3); }
    compare();
  }
  for (const s of pair) s.send('strike.done', 'enemy', 'first', false); compare();
  for (const phase of [1, 2, 2, 3, 0]) {
    for (const s of pair) { const actor = s.world.snapshot().actors?.[0]; if (actor === undefined) throw new Error('Missing actor'); s.world.setActor({ ...actor, strikeState: phase }); s.advance(.2); }
    compare();
  }
  for (const s of pair) s.send('strike.done', 'enemy', 'second', true); compare();
  for (const s of pair) s.advance(1.8); compare();
  for (const s of pair) { const actor = s.world.snapshot().actors?.[0]; if (actor === undefined) throw new Error('Missing actor'); s.world.setActor({ ...actor, stunned: true }); s.advance(.2); } compare();
  for (const s of pair) s.send('hit', 'enemy', 99, 12, .5); compare();
  for (const s of pair) s.send('death', 'enemy', 99); compare();
  for (const s of pair) { s.send('strike.done', 'enemy', 'first', false); s.advance(4); } compare();
});

test('phase clock resets only on authoritative phase transitions and continues throughout a long active lane', () => {
  const s = make(1); s.send('start');
  for (const phase of [1, 2, 3, 0]) {
    const actor = s.world.snapshot().actors?.[0]; if (actor === undefined) throw new Error('Missing actor');
    s.world.setActor({ ...actor, strikeState: phase }); s.advance(.1);
    expect(s.state()['posePhase']).toBe(phase); expect(s.state()['poseClock']).toBe(0);
    s.advance(1); expect(s.state()['poseClock']).toBeCloseTo(1);
  }
});

test('new guest contains the exact original tactics, not a rewritten simulation', () => {
  const old = readFileSync('src/shards/driftwood-isle/behaviour/splinterMantis.as', 'utf8');
  const next = readFileSync('src/shards/driftwood-isle/behaviour/splinterMantisPhase.as', 'utf8');
  expect(next.split('\n// Presentation-only observations')[0]).toBe(old.replace('export function onTick(dt:f64):void {', 'function tactics(dt:f64):void {'));
});
