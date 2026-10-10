import { PINE_LANES, PINE_STRIKES } from '../../src/shards/pine-hollow/combat/strikes';
import { BOAR } from '../../src/game/systems/species/boar';
import { BEAR } from '../../src/game/systems/species/bear';
import * as THREE from 'three';
import { describe, expect, it, vi, afterAll } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { LaneCharge } from '../../src/shards/pine-hollow/combat/ctx';
import { Animal } from '../../src/engine/entities/AnimalView';
import { AnimalFactory } from '../../src/engine/entities/AnimalFactory';
import { legacyConstants } from '../fake/legacySource';
import { creature } from '../fake/creature';
import { fakeWorld } from '../fake/world';
import { HorseHerd } from '../fixtures/nalati-group-oracle/herd';
import { Pack } from '../fixtures/nalati-group-oracle/pack';
import { NALATI_PACK_BRAIN, NALATI_HERD_BRAIN } from '../../src/shards/nalati-grasslands/data/brains';
import { ANTLER_KING_FIGHT } from '../../src/shards/pine-hollow/data/kingFight';
import { KING_TUNING } from '../../src/shards/nalati-grasslands/data/goldenKingFight';
import { TITAN_TUNING } from '../../src/shards/nalati-grasslands/data/stormTitanFight';
import { invokeLegacy, legacyActor } from '../fake/legacyActor';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);
const island = 'src/shards/driftwood-isle/species/', species = 'src/shards/nalati-grasslands/species/', nalati = 'src/shards/nalati-grasslands/combat/', pine = 'src/shards/pine-hollow/combat/';
const tuning = [
  ['S1 crab snap', `${island}crab.ts`, { SNAP_R: 1.6, SNAP_DAMAGE: 10, WINDUP: 0.5, SNAP_DUR: 0.78 }],
  ['S1 crab holding ring', 'src/shards/driftwood-isle/runtime/crabDecision.ts', { HOLD_R: 3.6 }],
  ['S2 monkey bite', `${island}monkeyPolicy.ts`, { BITE_R: 1.3, BITE_DAMAGE: 6, BITE_DUR: 0.9 }],
  ['S3 monkey coconut release', `${island}monkeyPolicy.ts`, { THROW_R: 14, THROW_DUR: 1, THROW_RELEASE: 0.62 }],
  ['S4 sailor swing', `${island}sailor.ts`, { SWING_R: 1.8, HIT_R: 1.9, SWING_DAMAGE: 14, WINDUP: 0.6, SWING_DUR: 0.9 }],
  ['S5/S6 captain cuts', `${island}captainPolicy.ts`, { SWING_R: 2.3, HIT_R: 2.5, SWING_DMG: 24, WINDUP: [0, 0.7, 0.62, 0.5], COOLDOWN: [0, 1.4, 1.2, 0.8] }],
  ['S7 captain burst', `${island}captainPolicy.ts`, { BURST_R: 3, BURST_DMG: 16, UNDER_T: 1.1, SINK_EVERY: [0, 0, 7, 5] }],
  ['S8/S9 boar/bear charge', 'src/engine/ai/hunt.ts', { BOAR_CHARGE: 7.5, CHARGE_HIT_DIST: 1.4, CHARGE_ARC: THREE.MathUtils.degToRad(50), CHARGE_COMMIT: 4.5, CHARGE_COMMIT_TURN: 1.1 }],
  ['S11 balbal slam', `${species}balbal.ts`, { ATK_T: 2.9, W_END: 0.52, S_END: 0.58, HIT_R: 3.1, HIT_CONE: 0.96, DAMAGE: 30, KURGAN_DAMAGE: 18, COOLDOWN: 1.4 }],
  ['S12 ghost rider arrow', `${nalati}ghostRiders.ts`, { SPACING: 11, CIRCLE_R: 34, ENGAGE: 70, DISENGAGE: 115, SHOOT: 62, ARROW_SPEED: 34, ARROW_G: 5, ARROW_DMG: 10, RESPAWN: 60 }],
] as const;
describe('strike tuning from current production declarations', () => {
  it('S10/S18 read the live declared pack lunge and guarded-herd charge tuning', () => {
    expect([NALATI_PACK_BRAIN.runSpeed, NALATI_PACK_BRAIN.biteRadius, NALATI_PACK_BRAIN.telegraphSeconds,
      NALATI_PACK_BRAIN.dashSeconds, NALATI_PACK_BRAIN.breakoffSeconds]).toEqual([9.5, 1.4, 0.4, 1.8, 1.1]);
    expect(NALATI_HERD_BRAIN.chargeSpeed).toBe(12);
  });
  it('S8/S9 the charge wind-ups are the species rows\' own (E405: the kit\'s boar 0.55 s, bear 0.65 s)', () => {
    expect(BOAR.chargeWindup).toBe(0.55); expect(BEAR.chargeWindup).toBe(0.65);
  });
  it('S36 Antler King stomp retains its4.4m radius', () => {
    expect(ANTLER_KING_FIGHT.burst.radius).toBe(4.4);
  });
  it('S35 keeps both measured Antler King sweep regions and damage24', () => {
    expect(PINE_STRIKES.sweep.shape).toEqual({ kind: 'arc', radius: 4, halfAngle: 1.31 });
    expect(PINE_STRIKES.sweep.alternatives).toEqual([{ kind: 'arc', radius: 7.1, halfAngle: 0.52, yawOffset: -0.26 }]);
    expect(PINE_STRIKES.sweep.damage).toBe(24); expect(PINE_STRIKES.sweep.windup).toBe(0.9);
  });
  it.each(tuning)('%s', (_name, file, expected) => {
    expect(legacyConstants(file, Object.keys(expected), { THREE, MathUtils: THREE.MathUtils })).toEqual(expected);
  });  // The Golden King's and the Storm Titan's tuning are rows (data/goldenKingFight.ts, data/stormTitanFight.ts).
  it.each([
    ['S19 Golden King cuts', [KING_TUNING.strikeDamage, KING_TUNING.reach], [[14, 14, 22, 22], 3]],
    ['S20 Golden King sunburst', [KING_TUNING.sunburstDamage, KING_TUNING.ringSpeed, KING_TUNING.ringMax], [25, 8.5, 17]],
    ['S21 Golden King beam', [KING_TUNING.beamRadius, KING_TUNING.beamHitRadius, KING_TUNING.beamDamage], [6.2, 1.15, 15]],
    ['S23 Titan spear', [TITAN_TUNING.spearDamage, TITAN_TUNING.spearRadius, TITAN_TUNING.spearAim, TITAN_TUNING.spearLock, TITAN_TUNING.spearStuck], [40, 4.5, 1.5, 0.5, 3]],
    ['S24 Titan whirl', [TITAN_TUNING.whirlDamage, TITAN_TUNING.whirlRadius], [15, 3.2]],
    ['S25 Titan wind charge', [TITAN_TUNING.chargeDamage, TITAN_TUNING.laneSeconds, TITAN_TUNING.flankSeconds, TITAN_TUNING.stunSeconds], [30, 1.2, 2, 4]],
    ['S26 Titan chain', [TITAN_TUNING.chainDamage, TITAN_TUNING.chainRadius, TITAN_TUNING.chainLand], [18, 3, 0.6]],
    ['S27 Titan fire', [TITAN_TUNING.cell, TITAN_TUNING.burnSeconds, TITAN_TUNING.fireDps], [4, 7, 8]],
  ] as const)('%s', (_name, actual, expected) => { expect(actual).toEqual(expected); });
});

const laneRows: { name: string; file: string; index: number; tell: number; options: { width: number; speed: number; overshoot: number; dmg: number; skid: number; reach: number } }[] = [
  { name: 'S29 Ironhide', file: `${pine}elites.ts`, index: 0, tell: 0.9, options: { width: 2.4, speed: 12.5, overshoot: 7, dmg: 30, skid: 1.1, reach: 1.7 } },
  { name: 'S31 Blackpaw', file: `${pine}elites.ts`, index: 1, tell: 0.75, options: { width: 2.6, speed: 10.5, overshoot: 5, dmg: 28, skid: 1.2, reach: 1.6 } },
  { name: 'S33 Imperial Bull', file: `${pine}elites.ts`, index: 2, tell: 1, options: { width: 2.8, speed: 11, overshoot: 8, dmg: 34, skid: 1.3, reach: 1.8 } },
  { name: 'S34 rival', file: `${pine}elites.ts`, index: 3, tell: 0.9, options: { width: 2.4, speed: 9.5, overshoot: 6, dmg: 18, skid: 1.4, reach: 1.7 } },
  { name: 'S37 Antler King', file: 'src/shards/pine-hollow/runtime/antlerKing.ts', index: 0, tell: 1.1, options: { width: 5.2, speed: 13, overshoot: 10, dmg: 32, skid: 1.6, reach: 2 } },
  { name: 'S38 thrall', file: 'src/shards/pine-hollow/runtime/antlerKing.ts', index: 1, tell: 0.7, options: { width: 2.4, speed: 9, overshoot: 5, dmg: 14, skid: 1.2, reach: 1.7 } },
];
describe('real Pine lane strikes at the body clock', () => {
  it.each(laneRows)('$name holds its tell, hits once and finishes recovery', ({ file, index, options, tell }) => {
    const key = file.endsWith('elites.ts') ? ['ironhide', 'blackpaw', 'imperial', 'rival'][index] : ['king', 'thrall'][index];
    if (key === undefined || !(key in PINE_LANES)) throw new Error('Missing authored lane row');
    const spec = PINE_LANES[key as keyof typeof PINE_LANES];
    if (spec.shape.kind !== 'lane') throw new Error('Expected lane shape');
    const actual = { width: spec.shape.width, speed: spec.motion?.speed, overshoot: spec.motion?.overshoot, dmg: spec.damage, skid: spec.recover, reach: spec.range };
    expect(spec.windup).toBe(tell);
    expect(actual).toEqual(options);
    const f = fakeWorld(), factory = new AnimalFactory(f.sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } }), model = factory.model('boar', 'sow');
    const a = new Animal(factory.instantiate(model, 0.5), model, 0.5), player = new THREE.Vector3(0, 0, 4);
    const lane = new LaneCharge(f.game.scene, 0xff4400, options), hits: { frame: number; damage: number }[] = [];
    let frame = 0; lane.start(a, player.x, player.z, tell);
    f.game.onFixed('step', (dt) => { frame++; lane.update(a, dt, frame / 60, player, (damage) => { hits.push({ frame, damage }); }); a.update(dt, frame / 60, false); }, 'lane', true);
    for (let i = 0; i < Math.floor(tell * 60) - 1; i++) f.game.advance(1 / 60);
    expect(lane.state).toBe('tell'); expect(hits).toEqual([]);
    for (let i = 0; i < 480; i++) f.game.advance(1 / 60);
    expect(hits).toHaveLength(1); expect(hits[0]?.damage).toBe(options.dmg);
    expect(hits[0]?.frame).toBeGreaterThanOrEqual(tell * 60); expect(lane.state).toBe('none'); expect(f.game.dead).toBe(false);
  });
});
describe('species strikes retain current hit timing and damage', () => {
  it.each(['small', 'big'])('S1 %s crab snaps once after .5s (big variant hits14)', (variant) => {
    const f = creature('crab', variant); f.advance(80);
    expect(f.starts[0]?.duration).toBe(0.78); expect(f.hits.map((h) => h.damage)).toEqual([variant === 'big' ? 14 : 10]);
    expect((f.hits[0]?.frame ?? 0) - (f.starts[0]?.frame ?? 0)).toBeGreaterThanOrEqual(30);
    expect((f.hits[0]?.frame ?? 0) - (f.starts[0]?.frame ?? 0)).toBeLessThanOrEqual(36);
  });
  it('S2 ground monkey bites at .405 seconds then takes 1.2 seconds to recover', () => {
    const f = creature('monkey', 'monkey'); f.advance(7);
    Object.assign(f.animal.mem, { st: 4, cd: 0, gt: 10, onGround: 1, perch: -1 }); f.advance(70);
    expect(f.starts[0]?.duration).toBe(0.9); expect(f.hits.map((h) => h.damage)).toEqual([6]);
    expect((f.hits[0]?.frame ?? 0) - (f.starts[0]?.frame ?? 0)).toBeGreaterThanOrEqual(24);
    expect(f.animal.mem['cd']).toBeGreaterThan(0.8);
  });
  it('S3 a perched monkey releases one coconut after .62 seconds', () => {
    const thrown = vi.fn((): void => undefined), f = creature('monkey', 'monkey', { perches: [new THREE.Vector3(0, 5, 0)], throwCoconut: thrown });
    f.ctx.player.z = 8; f.advance(7); f.animal.mem['cd'] = 0; f.advance(42); expect(thrown).not.toHaveBeenCalled(); f.advance(6);
    expect(f.starts[0]?.duration).toBe(1); expect(thrown).toHaveBeenCalledOnce(); expect(f.hits).toEqual([]);
    f.advance(40); expect(thrown).toHaveBeenCalledOnce(); expect(f.animal.mem['cd']).toBeGreaterThan(1.9);
  });
  it.each([[1, 0.7, 1], [0.5, 0.62, 1], [0.2, 0.5, 2]])('S5/S6 captain fraction%s keeps its phase windup%s and %s cuts', (frac, windup, cuts) => {
    const f = creature('captain', 'captain'); f.advance(7); f.animal.hp = f.animal.maxHp * frac;
    Object.assign(f.animal.mem, { st: 2, cd: 0, subT: 0 }); f.advance(130);
    expect(f.starts[0]?.duration).toBeCloseTo(windup + 0.35); expect(f.hits.map((h) => h.damage)).toEqual(Array.from({ length: cuts }, () => 24));
  });
  it('S7 captain under-water burst deals16 within3m and returns to rise', () => {
    const f = creature('captain', 'captain'); f.advance(7); f.animal.hp = f.animal.maxHp * 0.5;
    Object.assign(f.animal.mem, { st: 5, subT: 1.01, burstX: 0, burstZ: 1 }); f.advance(6);
    expect(f.hits.map((h) => h.damage)).toEqual([16]); expect(f.animal.mem['st']).toBe(1);
  });
  it.each([false, true])('S11 balbal field%s keeps its1.595s contact and30/18 damage', (field) => {
    const f = creature('balbal', 'warrior');
    Object.assign(f.animal.mem, { init: 1, st: 3, t: 0, cd: 0, field: field ? 1 : 0, rise: 1 }); f.animal.startAttack(2.9);
    f.advance(96); expect(f.hits).toEqual([]); f.advance(7);
    expect(f.hits.map((h) => h.damage)).toEqual([field ? 30 : 18]); f.advance(72); expect(f.hits).toHaveLength(1);
  });
  it('S10 wolf lunge waits .4s, bites12 once, and breaks off for1.1s', () => {
    const f = creature('crab', 'small'), a = f.animal;
    Object.assign(a.mem, { lunge: 1, lt: 0.4, bit: 0, role: 1 }); a.mods.chargeDamage = 12;
    const pack = legacyActor(Pack.prototype, { prey: null, phase: 'encircle', members: [a], bites: 0 });
    for (let i = 0; i < 4; i++) { pack.drive(a, f.ctx, true); expect(f.hits).toEqual([]); }
    pack.drive(a, f.ctx, true); expect(f.hits).toEqual([]); pack.drive(a, f.ctx, true);
    expect(f.hits.map((h) => h.damage)).toEqual([12]); expect(a.mem['lunge']).toBe(3); expect(a.mem['lt']).toBe(1.1);
  });
  it('S18 stallion charge deals its25 modifier once and wheels with5s cooldown', () => {
    const f = creature('crab', 'small'), a = f.animal; a.mods.chargeDamage = 25;
    const herd = legacyActor(HorseHerd.prototype, { stallionState: 'charge', chargeTarget: null, knockCd: 0, onStallionState: undefined });
    invokeLegacy(herd, 'driveStallion', a, f.ctx);
    expect(f.hits.map((h) => h.damage)).toEqual([25]); expect(Reflect.get(herd, 'stallionState')).toBe('wheel'); expect(Reflect.get(herd, 'chargeCd')).toBe(5);
  });
});
