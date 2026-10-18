// oxlint-disable-next-line import/no-nodejs-modules -- Compile the authored guest sources, never substitute a JS policy.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, test } from 'vitest';
import { DRIFTWOOD_REGULAR_BODY_BUILDERS } from '../src/shards/driftwood-isle/generators/driftwoodRegularBodies';
import { DRIFTWOOD_REGULAR_DECISIONS, DRIFTWOOD_REGULAR_FIELDS, DRIFTWOOD_REGULAR_MOVES, DRIFTWOOD_REGULAR_STRIKES } from '../src/shards/driftwood-isle/generators/driftwoodRegularCombat';
import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import { generateDecisionBindings } from '@wildshard/sdk/decisionScriptBindings';
import { DecisionHost, type DecisionScript } from '@wildshard/engine/script/decision';
import { createScriptScenario } from '@wildshard/sdk/scriptScenario';
import { parseActorMoves } from '@wildshard/format/actorMoves';
import { readCreatureStrikes } from '@wildshard/format/creatures';

const registries = {
  actors: new Map(DRIFTWOOD_REGULAR_DECISIONS.map((row, i) => [row.actors.enemy, i + 1])),
  fields: new Map(DRIFTWOOD_REGULAR_FIELDS.map(row => [row.name, row.id])),
  moves: new Map(DRIFTWOOD_REGULAR_MOVES.map((row, i) => [row.id, i + 10])),
  strikes: new Map(DRIFTWOOD_REGULAR_STRIKES.map((row, i) => [row.id, i + 20])),
};
let built: Awaited<ReturnType<typeof compileDecisionScripts>>;
beforeAll(async () => {
  const sources = new Map(DRIFTWOOD_REGULAR_DECISIONS.map(row => [row.source, readFileSync(`src/shards/driftwood-isle/${row.source}`, 'utf8')]));
  built = await compileDecisionScripts(DRIFTWOOD_REGULAR_DECISIONS, registries, sources, { asLineCeiling: 150 });
});
function scenario(index: number) {
  const row = built.rows[index]; if (row === undefined) throw new Error('Missing guest');
  const blob = built.blobs.find(value => value.file.path === row.module); if (blob === undefined) throw new Error('Missing guest bytes');
  const bindings = generateDecisionBindings(row, registries);
  const script: DecisionScript = { ...row, ids: bindings.map.ids, reads: ['nearestPlayer', 'distance', 'field', 'alive', 'strikeState', 'stunned'], lists: [] };
  const actor = index + 1;
  return createScriptScenario(DecisionHost, { bytes: blob.bytes, script, seed: 17,
    binding: { id: 1, script: row.id, self: actor, actors: [actor], instance: 0 },
    actors: [{ id: actor, at: [0, 0, 0], fields: Object.fromEntries(DRIFTWOOD_REGULAR_FIELDS.map(field => [field.id, field.default])) }],
    players: [{ id: 99, at: [0, 0, 1.5] }] });
}
test('three unrelated finite skinned bodies have valid bones and normalized weights', () => {
  const counts: number[] = [];
  for (const { build } of DRIFTWOOD_REGULAR_BODY_BUILDERS) {
    const body = build();counts.push(body.bones.length);
    expect(new Set(body.bones.map(bone => bone.name)).size).toBe(body.bones.length);
    for (const bone of body.bones) expect(bone.parent === null || body.bones.some(parent => parent.name === bone.parent)).toBe(true);
    for (const geometry of [...body.furParts, ...body.hardParts, ...body.eyeParts]) {
      const position = geometry.getAttribute('position'), skin = geometry.getAttribute('skinIndex'), weights = geometry.getAttribute('skinWeight');
      expect(position.count).toBeGreaterThan(0);expect([...position.array].every(Number.isFinite)).toBe(true);
      for (let i = 0; i < position.count; i++) { expect(weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i)).toBeCloseTo(1);expect(skin.getX(i)).toBeLessThan(body.bones.length); }
      geometry.dispose();
    }
  }
  expect(new Set(counts).size).toBe(2); // Puffer and Conch deliberately use different six-joint silhouettes; Mantis has fourteen.
});
test('strike/move declarations preserve radial retreat and two independent locked lanes', () => {
  const strikes = readCreatureStrikes(DRIFTWOOD_REGULAR_STRIKES);expect(parseActorMoves(DRIFTWOOD_REGULAR_MOVES)).toHaveLength(3);
  expect(strikes[0]).toMatchObject({ windup: .9, recover: 1.1, shape: { kind: 'ring', outer: 2.2 } });
  expect(strikes.slice(3).every(row => row.motion?.track === 'none')).toBe(true);
  expect(strikes[4]?.windup).toBe(.45);
});
test('puffer commits burst, waits recovery completion then cooldown and cancels on death', () => {
  const s = scenario(0);s.send('start');s.advance(.2);expect(s.state()['stage']).toBe(1);
  s.send('strike.done', 'enemy', 'burst', false);expect(s.state()['stage']).toBe(2);
  s.advance(1);expect(s.state()['stage']).toBe(2);s.send('death', 'enemy', 99);s.advance(4);
  expect(s.state()['cancelled']).toBe(true);expect(s.state()['stage']).toBe(5);
});
test('conch brace hit starts a separately told counter and subsequent hits cannot chain counters', () => {
  const s = scenario(1);s.send('start');s.advance(.1);s.send('hit', 'enemy', 99, 3, .95);
  expect(s.state()['stage']).toBe(3);expect(s.commands()).toContainEqual(['strike', 'enemy', 'counter', 99]);
  s.send('hit', 'enemy', 99, 3, .9);expect(s.commands().filter(command => command[0] === 'strike')).toHaveLength(0);
});
test('mantis second attack requires first completion, death clears the queued beat', () => {
  const s = scenario(2);s.send('start');s.advance(.2);expect(s.state()['stage']).toBe(1);
  s.send('strike.done', 'enemy', 'first', false);expect(s.state()['stage']).toBe(3);
  expect(s.commands()).toContainEqual(['strike', 'enemy', 'second', 99]);
  s.send('death', 'enemy', 99);s.send('strike.done', 'enemy', 'first', false);
  expect(s.commands().filter(command => command[0] === 'strike')).toHaveLength(0);
});
