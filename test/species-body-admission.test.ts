// oxlint-disable-next-line import/no-nodejs-modules -- Compare every native trace sample through a stable digest.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Native test loads the shipping physics bytes.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import * as v from 'valibot';
import { CreatureBodyRecipeSchema, type CreatureBodyRecipe } from '../src/format/creatures';
import { admitSpeciesBrains, bindSpeciesBody, type SpeciesBodyObservation } from '../src/game/plugin/brain';
import { Rng } from '../src/engine/core/rng';
import { loadRapier, type Rapier } from '../src/engine/physics/rapier';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel } from '../src/engine/sim';
import type { AnimalSim } from '../src/engine/entities/AnimalSim';
import type { KeptPolicy } from '../src/game/shardfile/homeKeeper';
import { SKY_SPECIES_BRAINS } from '../src/shards/far-reach/data/brains';
import { RAM_DATA, DIVE_DATA, BURST_DATA } from '../src/shards/far-reach/data/strikes';
import { strike } from '../src/sdk/species';
import { skySpecs } from './fake/sky-specs';
import { CRAB_BRAIN, SAILOR_BRAIN, MONKEY_BRAIN } from '../src/shards/driftwood-isle/data/brains';
import { flockBrain as shippingBrain } from './fixtures/species-oracle/skyFlock';

let rapier: Rapier;
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
const HOME = { x: 7, z: -4, r: 12, y: 0 };
const recipe = (flight: boolean): CreatureBodyRecipe => ({ kind: 'animal', motion: flight ? 'flight' : 'ground', attack: 'unlimited',
  stunned: 'look-hold', contact: { kind: 'environment', halfArc: 70 * Math.PI / 180 } });
const catalogue = () => admitSpeciesBrains(SKY_SPECIES_BRAINS.map(row => ({ ...row, body: recipe(row.flight !== undefined) })),
  [strike(RAM_DATA), strike(DIVE_DATA), strike(BURST_DATA)]);
const level: SimLevel = { version: SIM_API_VERSION, id: 'native-body-arena', seed: 71,
  ground: { size: 100, height: 0 }, player: { at: { x: 7, y: 0, z: -2 }, yaw: 0, speed: 5 }, entities: [], quests: [],
  weapon: { id: 'test.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.1, cooldown: 1, range: 1, damage: 0, tags: [] } };
interface Fixture { host: SimHost; actor: AnimalSim; brain: KeptPolicy; rng: Rng }
function fixture(kind: string, next: boolean): Fixture {
  const spec = skySpecs().get(kind);
  if (spec === undefined) throw new Error('Missing actual native species recipe');
  const host = createSimHost(level, { rapier }), rng = new Rng(357);
  const actor = host.spawn({ id: 'test.body', spec, seed: 0.5, scale: 1, at: { x: 19, y: spec.flight === undefined ? 0 : 14, z: -4 }, yaw: 0 });
  const brain = next ? catalogue().body(kind, actor, { host, stream: rng, home: HOME, attacks: { kind: 'unlimited', limit: Infinity } })
    : shippingBrain(kind, spec.label, actor, HOME, { host, rng });
  if (brain === null) throw new Error('Declared species must bind its actual body');
  return { host, actor, rng, brain };
}
function drive(f: Fixture, tick: number): void {
  f.host.player.position.set(HOME.x + Math.sin(tick * 0.004) * 3, tick >= 6000 && tick < 7000 ? 5 : 0,
    HOME.z + (tick < 600 || tick >= 4000 && tick < 5000 ? 80 : 2));
  if (tick === 1500 && f.actor.kind === 'skyGoat') f.actor.position.set(HOME.x + HOME.r - 0.1, 0, HOME.z);
  if (tick === 2200 && f.actor.kind === 'skyGoat') f.actor.position.y = -2;
  if (tick === 7500) f.actor.alive = false;
  if (tick === 7600) f.actor.alive = true;
  f.host.step();
  if (tick % 6 === 0) f.brain.decide(0.1);
  f.brain.move(1 / 60);
}
it.each(['skyGoat', 'driftRay', 'galeWisp'])('%s binds the admitted body with 10k exact shipping policy/body/contact/RNG samples and quiet restore', kind => {
  const old = fixture(kind, false), next = fixture(kind, true), expected = createHash('sha256'), actual = createHash('sha256');
  const sample = (f: Fixture): string => JSON.stringify({ actor: f.actor.snapshot(), policy: f.brain.snapshot(), rng: f.rng.snapshot(),
    health: f.host.player.health.snapshot(), player: f.host.player.position.toArray() });
  try {
    for (let tick = 0; tick < 10000; tick++) {
      drive(old, tick); drive(next, tick); expected.update(sample(old)); actual.update(sample(next));
      if (tick === 1400 || tick === 3400 || tick === 6400) {
        const state = next.brain.snapshot(), before = sample(next);
        const restored = catalogue().body(kind, next.actor, { host: next.host, stream: next.rng, home: HOME, attacks: { kind: 'unlimited', limit: Infinity } });
        if (restored === null) throw new Error('Missing declared restore body');
        restored.restore(state); next.brain = restored;
        expect(sample(next)).toBe(before); expect(next.brain.snapshot()).toBe(old.brain.snapshot());
      }
    }
    expect(actual.digest('hex')).toBe(expected.digest('hex'));
  } finally { next.host.dispose(); old.host.dispose(); }
});
it('refuses foreign bodies, inferred flight/home and invented unlimited attack authority without changing any native state', () => {
  const f = fixture('driftRay', false), foreign = createSimHost(level, { rapier }), brains = catalogue();
  const before = JSON.stringify({ actor: f.actor.snapshot(), rng: f.rng.snapshot(), host: { state: f.host.state, bodies: [...f.host.entities.keys()] } });
  try {
    expect(() => brains.body('driftRay', f.actor, { host: foreign, stream: f.rng, home: HOME, attacks: { kind: 'unlimited', limit: Infinity } })).toThrow('actual host');
    expect(() => brains.body('driftRay', f.actor, { host: f.host, stream: f.rng, attacks: { kind: 'unlimited', limit: Infinity } })).toThrow('actual body home');
    expect(() => brains.body('driftRay', f.actor, { host: f.host, stream: f.rng, home: HOME, attacks: { kind: 'unlimited', limit: 3 } })).toThrow('actual attack authority');
    const wrong = admitSpeciesBrains(SKY_SPECIES_BRAINS.map(row => Object.assign(structuredClone(row), { body: recipe(false) })), [strike(RAM_DATA), strike(DIVE_DATA), strike(BURST_DATA)]);
    expect(() => wrong.body('driftRay', f.actor, { host: f.host, stream: f.rng, home: HOME, attacks: { kind: 'unlimited', limit: Infinity } })).toThrow('declared motor');
    expect(JSON.stringify({ actor: f.actor.snapshot(), rng: f.rng.snapshot(), host: { state: f.host.state, bodies: [...f.host.entities.keys()] } })).toBe(before);
  } finally { foreign.dispose(); f.host.dispose(); }
});
it('preserves the held-look stun law without running a decision, a clock or a draw', () => {
  const f = fixture('skyGoat', true), state = f.brain.snapshot(), stream = f.rng.snapshot();
  try {
    const saved = f.actor.snapshot(); saved.motion.stunT = 1; f.actor.restore(saved); f.brain.decide(0.1);
    expect(f.actor.desiredSpeed).toBe(0); expect(f.actor.turnRate).toBe(1);
    expect(f.actor.lookTarget.toArray()).toEqual(f.host.player.position.toArray()); expect(f.actor.lookWeight).toBe(1);
    expect(f.brain.snapshot()).toBe(state); expect(f.rng.snapshot()).toEqual(stream);
  } finally { f.host.dispose(); }
});
it('admits bounded actor contact IDs and refuses unsupported native families rather than manufacturing their missing authority', () => {
  const actorBody: CreatureBodyRecipe = { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none',
    contact: { kind: 'actor', halfArc: 70 * Math.PI / 180, move: 'sunscar.duneStrider.contact' } };
  expect(v.parse(CreatureBodyRecipeSchema, actorBody)).toEqual(actorBody);
  for (const value of [{ ...actorBody, contact: { ...actorBody.contact, halfArc: Infinity } }, { ...actorBody, arbitraryGrant: true }])
    expect(() => v.parse(CreatureBodyRecipeSchema, value)).toThrow();
  const brains = [{ archetype: 'skirmisher', data: CRAB_BRAIN }, { archetype: 'guardian', data: SAILOR_BRAIN }, { archetype: 'perch-hunter', data: MONKEY_BRAIN }] as const;
  for (const brain of brains) expect(() => admitSpeciesBrains([{ id: 'test.species', kind: 'unsupported', label: 'Unsupported', variants: [], brain, body: actorBody }], []))
    .toThrow('no admitted native body protocol');
});
it('passes through the real keeper claim and clock with no automatic token grant', () => {
  const f = fixture('skyGoat', false);
  let claims = 0; const observed: { ports: SpeciesBodyObservation | null } = { ports: null };
  try {
    const native = bindSpeciesBody(f.actor, { kind: 'animal', motion: 'ground', attack: 'keeper', stunned: 'none',
      contact: { kind: 'actor', halfArc: 1, move: 'test.body.contact' } }, { host: f.host, stream: f.rng, attacks: { kind: 'keeper', claim: () => { claims++; return false; } } },
    ports => { observed.ports = ports; return { think: c => { expect(c.claim(f.actor)).toBe(false); }, act: () => undefined, snapshot: () => 'unchanged', restore: () => undefined }; });
    expect(claims).toBe(0); f.host.step(); native.decide(0.1); expect(claims).toBe(1);
    const ports: SpeciesBodyObservation | null = observed.ports;
    if (ports === null) throw new Error('Missing actual native observation');
    expect(ports.t).toBe(f.host.clock.now); expect(ports.dt).toBe(0.1); expect(ports.rng).toBe(f.rng);
  } finally { f.host.dispose(); }
});
