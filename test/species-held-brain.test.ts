// oxlint-disable-next-line import/no-nodejs-modules -- Load the shipping native physics binary.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { admitSpeciesBrains, bindSpeciesBody, type HeldSpeciesControl } from '../src/game/plugin/brain';
import { createSimHost, SIM_API_VERSION, type SimLevel } from '../src/engine/sim';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { Rng } from '../src/engine/core/rng';
import { skySpecs } from './fake/sky-specs';
import { stormRocBrain } from './fixtures/far-reach/heldRaptor';
import { ROC_PROFILE, ROC_STRIKES, SKY_BODY_ROWS } from '../src/shards/far-reach/data/brains';
import { STORM_ROC_DATA } from '../src/shards/far-reach/data/species';
import { strike } from '../src/sdk/species';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const row = { ...STORM_ROC_DATA, body: SKY_BODY_ROWS.flight, brain: { archetype: 'raptor', data: ROC_PROFILE } } as const;
const catalogue = () => admitSpeciesBrains([row], ROC_STRIKES.map(value => strike(value)));
const level: SimLevel = { version: SIM_API_VERSION, id: 'held-body-arena', seed: 6417,
  ground: { size: 500, height: -1000 }, player: { at: { x: ROC_PROFILE.lap.x, y: ROC_PROFILE.lap.y - 10, z: ROC_PROFILE.lap.z }, yaw: 0, speed: 5 },
  entities: [], quests: [], weapon: { id: 'test.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1,
    recover: 0.1, cooldown: 1, range: 1, damage: 0, tags: [] } };
function fixture(next: boolean) {
  const host = createSimHost(level, { rapier }), stream = new Rng(357), spec = skySpecs().get(row.kind);
  if (spec === undefined) throw new Error('Missing actual held species spec');
  const actor = host.spawn({ id: 'fixture.body', spec, seed: 0.5, scale: 1, at: ROC_PROFILE.perch, yaw: ROC_PROFILE.perch.yaw });
  const shared = { host, stream, attacks: { kind: 'unlimited', limit: Infinity } } as const, brains = catalogue();
  let control: HeldSpeciesControl | null = null;
  const policy = next ? brains.body(row.kind, actor, shared) : bindSpeciesBody(actor, SKY_BODY_ROWS.flight, shared, ports => {
    const brain = stormRocBrain(actor, ports.shove); control = brain; return brain;
  });
  control = next ? brains.held(row.kind, actor) : control;
  if (policy === null || control === null) throw new Error('Missing real held controller');
  return { host, actor, stream, brains, policy, control };
}

it('admits every held phase and strike before a body exists', () => {
  expect(() => catalogue().bind(row.kind)).toThrow('trusted body authority');
  expect(() => admitSpeciesBrains([row], [])).toThrow('undeclared strike');
  expect(() => admitSpeciesBrains([{ ...row, brain: { archetype: 'raptor', data: { ...ROC_PROFILE, inventedAuthority: true } } }], ROC_STRIKES.map(value => strike(value)))).toThrow();
});

it('runs the same real held body, phases, contacts, RNG and continuation as the original native owner', () => {
  const before = fixture(false), after = fixture(true);
  try {
    expect(after.brains.held(row.kind, after.actor)).toBe(after.control);
    expect(after.policy.snapshot()).toBe(before.policy.snapshot());
    for (let tick = 1; tick <= 1200; tick++) {
      for (const f of [before, after]) {
        f.host.player.position.set(ROC_PROFILE.lap.x + Math.sin(tick * 0.007) * 9, level.player.at.y, ROC_PROFILE.lap.z + Math.cos(tick * 0.007) * 9);
        f.control.fighting = tick >= 10; f.control.phase = tick < 400 ? 0 : tick < 800 ? 1 : 2;
        if (tick === 1000) f.control.restart();
        if (tick % 6 === 1) f.policy.decide(0.1);
        f.policy.move(1 / 60); f.host.step();
      }
      expect(after.actor.snapshot()).toEqual(before.actor.snapshot());
      expect(after.policy.snapshot()).toBe(before.policy.snapshot());
      expect(after.host.player.position.toArray()).toEqual(before.host.player.position.toArray());
      expect(after.host.player.health.attributes).toEqual(before.host.player.health.attributes);
      expect(after.stream.snapshot()).toEqual(before.stream.snapshot());
      if (tick === 600) {
        const saved = after.policy.snapshot(), actual = after.actor.snapshot();
        after.policy.restore(saved); expect(after.actor.snapshot()).toEqual(actual); expect(after.policy.snapshot()).toBe(saved);
      }
    }
    expect(() => after.brains.held('foreign-kind', after.actor)).toThrow('declared live body');
    expect(() => after.brains.body(row.kind, after.actor, { host: before.host, stream: after.stream, attacks: { kind: 'unlimited', limit: Infinity } })).toThrow('actual host');
    expect(() => after.brains.body(row.kind, after.actor, { host: after.host, stream: after.stream, attacks: { kind: 'unlimited', limit: Infinity } })).toThrow('owning controller');
  } finally { before.host.dispose(); after.host.dispose(); }
});
