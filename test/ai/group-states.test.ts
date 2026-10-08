import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi, afterAll } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import { Pack } from '../fixtures/nalati-group-oracle/pack';
import { HorseHerd } from '../fixtures/nalati-group-oracle/herd';
import { Flock } from '../../src/shards/nalati-grasslands/creatures/flock';
import { wildEnv } from '../../src/shards/nalati-grasslands/creatures/env';
import { speciesDef } from '../../src/engine/entities/species/registry';
import { creature } from '../fake/creature';
import { invokeLegacy } from '../fake/legacyActor';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);
const env = { ...wildEnv };
beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0.5); });
afterEach(() => { Object.assign(wildEnv, env); vi.restoreAllMocks(); });

function packFixture(): { pack: Pack; f: ReturnType<typeof creature>; step: (n: number) => void } {
  const f = creature('crab', 'small');
  const members = Array.from({ length: 4 }, (_, i) => {
    const a = creature('crab', 'small').animal; a.variant = i === 0 ? 'alpha' : 'wolf';
    a.position.set(i * 2, 0, 0); return a;
  });
  const pack = new Pack(members, 0, 0); let t = 0;
  return { pack, f, step(n): void { for (let i = 0; i < n; i++) { t += 0.1; f.ctx.t = t; pack.tick(f.ctx); } } };
}

describe('current group brains before S2.3 migration', () => {
  it('pack senses, shadows, encircles, regroups once, then breaks and calms down', () => {
    const { pack, f, step } = packFixture(), phases = [pack.phase];
    pack.onPhase = (phase) => { phases.push(phase); }; f.ctx.player.set(0, 0, 8); f.ctx.playerSpeed = 3;
    step(4); expect(pack.phase).toBe('shadow'); step(1); expect(pack.phase).toBe('encircle');
    const flank = pack.members[1]; if (flank === undefined) throw new Error('missing flank');
    flank.alive = false; step(1); expect(pack.phase).toBe('regroup'); step(37);
    expect(pack.phase).toBe('encircle'); expect(f.sounds.filter((s) => s === 'wolf_howl')).toHaveLength(1);
    pack.scare(0, 0); step(1); expect(pack.phase).toBe('break');
    expect(pack.members.every((a) => a.mem['lunge'] === 0)).toBe(true);
    f.ctx.player.z = 100; step(1); expect(pack.phase).toBe('roam'); step(10);
    expect(pack.awareness).toBe(0);
    expect(phases).toEqual(['roam', 'shadow', 'encircle', 'regroup', 'encircle', 'break', 'roam']);
  });
  it('a raid overrides sensing, death ends the hunt, and one tick runs once for all members', () => {
    const { pack, f, step } = packFixture(), prey = { position: new THREE.Vector3(0, 0, 8), yaw: 0, alive: true, applyDamage: () => false };
    expect(pack.raid(prey)).toBe(true); step(1); expect(pack.prey).toBe(prey); expect(pack.phase).toBe('shadow');
    const awareness = pack.awareness; pack.tick(f.ctx); expect(pack.awareness).toBe(awareness);
    expect(pack.raid(prey)).toBe(false); prey.alive = false; step(1);
    expect(pack.prey).toBeNull(); expect(pack.phase).toBe('roam');
  });
  it('a dead alpha breaks the pack instead of regrouping', () => {
    const { pack, step } = packFixture();
    if (pack.alpha === null) throw new Error('missing alpha'); pack.alpha.alive = false;
    step(1); expect(pack.phase).toBe('break');
  });
  it('stallion watches, warns, displays, charges, wheels and watches again at the old thresholds', () => {
    const f = creature('crab', 'small'), st = f.animal; st.variant = 'stallion';
    const herd = new HorseHerd([st]), states = [herd.stallionState];
    herd.onStallionState = (state) => { states.push(state); }; st.mem['aw'] = 0.5;
    f.ctx.player.z = 8;
    const tick = (dt: number): void => { invokeLegacy(herd, 'stallionTick', f.ctx, dt, 8); };
    tick(0.1); expect(herd.stallionState).toBe('warn');
    Reflect.set(herd, 'sT', 1.21); tick(0.1); expect(herd.stallionState).toBe('display');
    Reflect.set(herd, 'sT', 2.21); tick(0.1); expect(herd.stallionState).toBe('charge');
    Reflect.set(herd, 'sT', 4.51); tick(0.1); expect(herd.stallionState).toBe('wheel');
    Reflect.set(herd, 'sT', 2.21); tick(0.1); expect(herd.stallionState).toBe('watch');
    expect(states).toEqual(['watch', 'warn', 'display', 'charge', 'wheel', 'watch']);
  });
  it('a beaten stallion recovers after 90s; ridden horses release and resume their guard', () => {
    const f = creature('crab', 'small'), st = f.animal; st.variant = 'stallion';
    const herd = new HorseHerd([st]), beaten = vi.fn((): void => undefined); herd.onBeaten = beaten;
    st.hp = st.maxHp * 0.24; invokeLegacy(herd, 'stallionTick', f.ctx, 0.1, 0);
    expect(herd.stallionState).toBe('beaten'); expect(beaten).toHaveBeenCalledOnce();
    invokeLegacy(herd, 'stallionTick', f.ctx, 89.8, 0); expect(herd.stallionState).toBe('beaten');
    invokeLegacy(herd, 'stallionTick', f.ctx, 0.2, 0); expect(herd.stallionState).toBe('watch'); expect(st.hp).toBeCloseTo(st.maxHp * 0.3);
    herd.setRidden(st); expect(herd.stallionState).toBe('ridden'); expect(st.mem['ridden']).toBe(1);
    const steer = vi.spyOn(f.ctx, 'steer'); herd.drive(st, f.ctx); expect(steer).not.toHaveBeenCalled();
    herd.setRidden(null); expect(st.mem['ridden']).toBe(0); expect(herd.stallionState).toBe('watch');
  });
  it('a stampede costs 30 trust, settles after its flight, then resumes grazing', () => {
    const f = creature('crab', 'small'), herd = new HorseHerd([f.animal]);
    f.ctx.calm = true; f.ctx.player.z = 100; herd.trust = 65; herd.stampede(0, -8);
    expect(herd.mode).toBe('flee'); expect(herd.stampeding).toBe(true); expect(herd.trust).toBe(35);
    Reflect.set(herd, 'modeT', 16); f.ctx.t = 0.1; herd.tick(f.ctx);
    expect(herd.mode).toBe('settle'); expect(herd.stampeding).toBe(false);
    Reflect.set(herd, 'modeT', 7); f.ctx.t = 0.2; herd.tick(f.ctx); expect(herd.mode).toBe('graze');
    expect(f.animal.mem['aw']).toBeLessThanOrEqual(0.2);
  });
});

/** Real flock arrays and decisions, with only the GPU instance writer omitted. */
function flockFixture(): Flock {
  const f = creature('crab', 'small'), flock = new Flock(f.sky, { x: 0, z: 0, count: 3, seed: 357 });
  Reflect.set(flock, 'mesh', { boundingSphere: null }); Reflect.set(flock, 'px', new Float32Array([-2, 0, 2]));
  Reflect.set(flock, 'shuffle', new Float32Array([5, 5, 5])); Reflect.set(flock, 'tT', 100);
  return flock;
}
function flockThink(flock: Flock, player = new THREE.Vector3(0, 0, 100), speed = 0, wolves: readonly ReturnType<typeof creature>['animal'][] = []): void {
  invokeLegacy(flock, 'think', 0.1, player, speed, wolves);
}
function flockSpeeds(flock: Flock): number[] {
  const speeds: unknown = Reflect.get(flock, 'dspd');
  if (!(speeds instanceof Float32Array)) throw new Error('flock speed array moved'); return [...speeds];
}
describe('current flock scripts before migration', () => {
  it('grazes undisturbed, panics from a living wolf, and recovers after five seconds', () => {
    const flock = flockFixture(); flockThink(flock); expect(flock.panicking).toBe(false); expect(flockSpeeds(flock)).toEqual([0, 0, 0]);
    const wolf = creature('crab', 'small').animal; wolf.position.z = -10; flockThink(flock, undefined, 0, [wolf]);
    expect(flock.panicking).toBe(true); expect(flockSpeeds(flock)[0]).toBeCloseTo(4.6 * 0.85);
    wolf.alive = false; for (let i = 0; i < 50; i++) flockThink(flock, undefined, 0, [wolf]);
    expect(flock.panicking).toBe(false);
  });
  it('lets a crouched player creep to 3m in long grass; a walking player scares it at 6m', () => {
    const flock = flockFixture(); wildEnv.playerCrouched = true; wildEnv.grassHeightAt = () => 1;
    flockThink(flock, new THREE.Vector3(0, 0, 4), 2); expect(flock.panicking).toBe(false);
    wildEnv.playerCrouched = false; flockThink(flock, new THREE.Vector3(0, 0, 4), 2); expect(flock.panicking).toBe(true);
  });
  it('steps aside for its dog, and a raided sheep dies once and scares the flock', () => {
    const flock = flockFixture(), dog = creature('crab', 'small').animal; dog.position.set(0, 0, -2); flock.setDog(dog);
    expect(Flock.ofDog(dog)).toBe(flock); flockThink(flock); expect(flockSpeeds(flock).every((s) => Math.abs(s - 2.4) < 1e-6)).toBe(true);
    const prey = flock.prey(1); expect(prey.alive).toBe(true); expect(prey.applyDamage()).toBe(true);
    expect(prey.alive).toBe(false); expect(flock.alive).toBe(2); prey.applyDamage(); expect(flock.alive).toBe(2); expect(flock.panicking).toBe(true);
  });
});

describe('current balbal state scripts before migration', () => {
  it('a field warrior rises, attacks, returns at dawn, and sinks fully', () => {
    const f = creature('balbal', 'warrior'); Object.assign(f.animal.mem, { field: 1, homeX: 0, homeZ: 0, homeYaw: 0 });
    f.advance(215); expect(f.states.slice(0, 2)).toEqual(['rise', 'idle']); f.advance(210);
    expect(f.states).toContain('stalk'); expect(f.states).toContain('attack'); expect(f.hits[0]?.damage).toBe(30);
    f.animal.cancelAttack(); f.animal.mem['st'] = 1; f.animal.mem['dawn'] = 1; f.animal.position.set(0, 0, 0); f.animal.yaw = 0;
    f.advance(200); expect(f.states).toContain('wander'); expect(f.animal.mem['gone']).toBe(1); expect(f.animal.mem['rise']).toBe(0);
  });
  it('a field warrior gives up above an 8m height gap, while a chamber add emerges and stays in its bounds', () => {
    const field = creature('balbal', 'warrior'); Object.assign(field.animal.mem, { field: 1, init: 1, st: 2, rise: 1, homeX: 0, homeZ: 0 });
    field.ctx.player.y = 9; field.advance(7); expect(field.animal.mem['st']).toBe(4); expect(field.hits).toEqual([]);
    const chamber = creature('balbal', 'warrior'); Object.assign(chamber.animal.mem, { minX: -2, maxX: 2, minZ: -2, maxZ: 2 });
    chamber.ctx.player.z = 10; chamber.advance(110); expect(chamber.animal.mem['emerge']).toBe(1); expect(chamber.animal.mem['st']).toBe(2);
    chamber.animal.position.set(5, 0, 5); speciesDef('balbal').think?.(chamber.animal, chamber.ctx);
    expect(chamber.animal.position.x).toBe(2); expect(chamber.animal.position.z).toBe(2);
  });
});
