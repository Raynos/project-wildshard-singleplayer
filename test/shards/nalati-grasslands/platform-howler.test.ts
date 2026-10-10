// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the frozen shipping decisions.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Authenticate the source-body inventory.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { speciesBrains, type BrainedSpecies } from '../../../src/sdk/speciesBrains';
import { AnimalSim } from '../../../src/engine/entities/AnimalSim';
import { PackBrain, type PackPorts } from '../../../src/engine/ai/pack';
import { Rng } from '../../../src/engine/core/rng';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { readHowlerSpec, type HowlerPorts, type HowlerSpec } from '../../../src/engine/ai/packHowler';
import { NALATI_PACK_BRAIN } from '../../../src/shards/nalati-grasslands/data/brains';
import { KokboriOracle } from '../../fixtures/nalati-kokbori-oracle/shipping';
import bodies from '../../fixtures/nalati-kokbori-oracle/shipping.json' with { type: 'json' };
import source from '../../fixtures/nalati-kokbori-oracle/source.json' with { type: 'json' };

const spec: HowlerSpec = {
  initialHowl: 8, engagedHowl: 3, phaseCooldown: 1, interruptedHowl: 12, nextHowl: 11, randomHowl: 4,
  pathSeconds: 0.6, pathNear: 6, homePathSeconds: 2, homeStop: 3, homeReset: 4, meleeRadius: 3.8, grassHeight: 0.6, hiddenDamage: 2,
  fields: { howl: 'howl', low: 'low', snarl: 'snarl' },
  speeds: { home: 6, watched: 7, hold: 4, hunt: 8, bite: 6 },
  turns: { home: 3, den: 1.5, hold: 3, howl: 1, hunt: 3.5, bite: 4 },
  hold: { watchedDot: 0.9, minRadius: 24, maxRadius: 32, sidestep: 0.6, arrival: 2, watchedLow: 0.6, low: 0.2 },
  hunt: { snarlDistance: 8, attackDistance: 3.5, moveDistance: 2.5 },
  bite: { seconds: 0.9, phase: 0.7, range: 3.2, damage: 22, cooldown: 1.8 },
  howl: { growSeconds: 0.3, seconds: 1.2, radius: 2, speed: 11, span: 12, strength: 0.85, stagger: 1, scare: 80 },
};

function policy(ports: HowlerPorts<AnimalSim>) {
  return speciesBrains([{ id: 'species.test.howler', kind: 'howler', label: 'Howler',
    walkSpeed: 1.8, chargeSpeed: 11, chargeDamage: 22,
    variants: [{ id: 'leader', label: 'Leader', weight: 1, rarity: 'legendary', scale: [2.6, 2.6], hp: 650 }],
    brain: { archetype: 'pack-howler', data: spec } }], []).howler('howler', ports);
}

function fixture() {
  const row = nalatiBake().actors.find(a => a.kind === 'wolf');
  if (row === undefined) throw new Error('Missing actual native canid recipe');
  // The policy proof uses real canid state/motion. The deferred Kokbori rig/body admission is a separate host slice.
  const actor = new AnimalSim(row.spec, row.seed, row.scale, row.id, { heightAt: () => 0, random: () => 0.5 });
  const members = Array.from({ length: 5 }, (_, i) => new AnimalSim(row.spec, i / 10, 1, `pack:${String(i)}`, { heightAt: () => 0, random: () => 0.5 }));
  members.forEach((a, i) => { a.place(i - 2, 0, 4); });
  const rng = new Rng(19001), events: unknown[][] = [], player = { position: new Vector3(0, 0, 30) };
  const environment = { playerCrouched: false, playerFwdX: 0, playerFwdZ: -1, grassHeightAt: (): number => 1,
    playerMounted: false, playerHealth01: 1 };
  const packPorts: PackPorts<AnimalSim> = { sharedRng: () => rng, environment: () => environment,
    visibility: () => 0, hearing: () => 0, downwind: () => false, inBounds: () => true, normalY: () => 1,
    register: () => undefined, bite: () => { throw new Error('No pack drive in this elite policy proof'); } };
  const pack = new PackBrain(members, 0, 0, NALATI_PACK_BRAIN, packPorts); pack.initialize();
  let phase2 = false;
  const ports: HowlerPorts<AnimalSim> = { player, lair: { x: 0, z: 0 }, pack: () => pack,
    phase2: () => phase2, environment: () => environment, random: () => rng.next(),
    rings: { setTime: t => { events.push(['time', t]); }, ring: (x, z, r, strength) => { events.push(['ring', x, z, r, strength]); }, hide: () => { events.push(['hide']); } },
    hurt: (_a, amount) => { events.push(['hurt', amount]); },
    regrouped: () => { events.push(['feed', 'Kokbori calls the pack back — and comes for you']); },
    interrupted: () => { events.push(['feed', 'The howl breaks — the pack scatters']); },
    closed: () => { events.push(['feed', 'PACK HOWL — the pack closes in']); },
    howl: at => { events.push(['sound', 'wolf_howl', ...at]); }, signature: () => { events.push(['signature']); } };
  const oraclePorts = { ...ports, feed: (text: string): void => { events.push(['feed', text]); },
    sound: (cue: 'wolf_howl', at: Vector3): void => { events.push(['sound', cue, ...at]); } };
  return { actor, members, pack, rng, player, environment, ports, oraclePorts, events, phase: (on: boolean): void => { phase2 = on; } };
}

it('matches the shipping howl, interruption, regroup, hidden damage and bite law with real canid/pack state', () => {
  const frozen = readFileSync('test/fixtures/nalati-kokbori-oracle/shipping.ts', 'utf8');
  for (const [name, body] of Object.entries(bodies)) expect(frozen.split(`// BEGIN SHIPPING ${name}\n`)[1]?.split(`\n// END SHIPPING ${name}`)[0]).toBe(body);
  expect(createHash('sha256').update(readFileSync('test/fixtures/nalati-kokbori-oracle/shipping.json')).digest('hex')).toBe(source.sha256);
  const a = fixture(), b = fixture(), keeper = policy(a.ports), old = new KokboriOracle(b.oraclePorts, b.actor);
  const states = new Set<string>(), outputs = new Set<string>();
  let time = 0;
  for (let tick = 0; tick < 2400; tick++) {
    const dt = tick % 7 === 0 ? 1 / 30 : 1 / 60; time += dt;
    const cycle = tick % 800;
    if (cycle === 0) { a.actor.place(0, 0, 0); b.actor.place(0, 0, 0); a.phase(false); b.phase(false); keeper.reset(a.actor); old.reset(); keeper.spawned(a.actor); old.spawned(); }
    if (cycle === 450) { a.phase(true); b.phase(true); keeper.enterPhase2(a.actor); old.enterPhase2(); }
    for (const f of [a, b]) {
      f.player.position.set(cycle < 450 ? 0 : 2, 0, cycle < 450 ? 30 : 1);
      f.environment.playerCrouched = tick % 3 === 0;
      f.environment.playerFwdZ = tick % 31 < 15 ? -1 : 1;
      if (tick === 180) f.actor.lastHitT = time;
    }
    keeper.tick(a.actor, dt, time, cycle < 650, cycle >= 650); old.tick(dt, time, cycle < 650, cycle >= 650);
    const context = { dt: 0.1, player: a.player.position, pathYaw: (actor: AnimalSim, x: number, z: number): number => Math.atan2(x - actor.position.x, z - actor.position.z) };
    if (tick % 6 === 0) { keeper.think(a.actor, context); old.think(b.actor, context); }
    keeper.act(a.actor); old.act(b.actor, context); a.actor.step(dt); b.actor.step(dt);
    states.add(keeper.snapshot().st);
    for (const event of a.events) { if (typeof event[0] === 'string') outputs.add(`${event[0]}:${String(event[1])}`); }
    expect(a.events).toEqual(b.events); a.events.length = 0; b.events.length = 0;
    if (tick % 20 === 0) {
      expect(keeper.snapshot()).toEqual(old.snapshot()); expect(a.actor.snapshot()).toEqual(b.actor.snapshot());
      expect(a.pack.snapshot()).toEqual(b.pack.snapshot()); expect(a.rng.snapshot()).toEqual(b.rng.snapshot());
      for (const point of [a.player.position, new Vector3(20, 0, 20)]) expect(keeper.damage(a.actor, point)).toBe(old.damage(b.actor, point));
    }
  }
  expect(states).toEqual(new Set(['den', 'hold', 'howl', 'hunt', 'home']));
  expect(outputs.has('feed:The howl breaks — the pack scatters')).toBe(true);
  expect(outputs.has('feed:PACK HOWL — the pack closes in')).toBe(true);
  expect(outputs.has('hurt:22')).toBe(true);
});

it('restores mid-howl without a draw, repeats the actual keeper/body suffix, and refuses invalid state atomically', () => {
  const a = fixture(), b = fixture(), keeper = policy(a.ports), restored = policy(b.ports);
  keeper.spawned(a.actor);
  for (let i = 0; i < 182; i++) keeper.tick(a.actor, 1 / 60, i / 60, true, false);
  const saved = keeper.snapshot(); expect(saved.st).toBe('howl'); expect(saved.howlHit).toBe(-Infinity);
  const before = b.rng.snapshot(); restored.restore(saved); expect(b.rng.snapshot()).toEqual(before);
  b.actor.restore(a.actor.snapshot()); b.pack.restore(a.pack.snapshot()); b.rng.restore(a.rng.snapshot()); a.events.length = 0;
  for (let i = 0; i < 120; i++) {
    keeper.tick(a.actor, 1 / 60, (182 + i) / 60, true, false); restored.tick(b.actor, 1 / 60, (182 + i) / 60, true, false);
    expect(restored.snapshot()).toEqual(keeper.snapshot()); expect(b.actor.snapshot()).toEqual(a.actor.snapshot());
    expect(b.pack.snapshot()).toEqual(a.pack.snapshot()); expect(b.rng.snapshot()).toEqual(a.rng.snapshot());
    expect(b.events).toEqual(a.events); a.events.length = 0; b.events.length = 0;
  }
  for (const invalid of [{ ...saved, extra: 1 }, { ...saved, st: 'fake' }, { ...saved, cd: Number.NaN }, { ...saved, howlHit: Infinity }]) {
    const current = restored.snapshot(); expect(() => restored.restore(invalid)).toThrow(); expect(restored.snapshot()).toEqual(current);
  }
});

it('strictly admits declared tuning and refuses invalid ranges and aliases before construction', () => {
  expect(readHowlerSpec(spec)).toEqual(spec);
  for (const value of [{ ...spec, extra: 1 }, { ...spec, nextHowl: Number.NaN }, { ...spec, pathSeconds: 0 },
    { ...spec, hold: { ...spec.hold, minRadius: 40 } }, { ...spec, fields: { ...spec.fields, howl: 'low' } }]) {
    expect(() => readHowlerSpec(value)).toThrow();
  }
});

it('refuses absent, non-howler and non-native admission without drawing the shared stream', () => {
  const f = fixture(), before = f.rng.snapshot();
  const row: BrainedSpecies = { id: 'species.test.howler', kind: 'howler', label: 'Howler', walkSpeed: 1.8, chargeSpeed: 11, chargeDamage: 22,
    variants: [{ id: 'leader', label: 'Leader', weight: 1, rarity: 'legendary', scale: [2.6, 2.6], hp: 650 }] };
  const absent = speciesBrains([row], []);
  expect(() => absent.howler('howler', f.ports)).toThrow(/does not declare/u);
  const admitted = speciesBrains([{ ...row, brain: { archetype: 'pack-howler', data: spec } }], []);
  expect(() => admitted.bind('howler')).toThrow(/explicit frame\/pack/u);
  expect(() => admitted.policy('howler', f.actor)).toThrow(/explicit frame\/pack/u);
  expect(() => admitted.decision('howler', f.actor)).toThrow(/not a native decision/u);
  expect(f.rng.snapshot()).toEqual(before);
});
