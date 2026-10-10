import { app } from '../../src/engine/app/runtime';
import { EliteBrain } from '../../src/engine/ai/EliteBrain';
import { canReach } from '../../src/engine/ai/reach';
import * as THREE from 'three';
import { describe, expect, it, vi, afterAll } from 'vitest';
import { overrideTerrain } from '../../src/engine/world/Heightfield';
import type { Animal } from '../../src/engine/entities/AnimalView';
import { KokboriKeeper } from '../../src/shards/nalati-grasslands/runtime/kokboriKeeper';
import { QyranKeeper } from '../../src/shards/nalati-grasslands/runtime/qyranKeeper';
import { AqbarsKeeper } from '../../src/shards/nalati-grasslands/runtime/aqbarsKeeper';
import { wildEnv } from '../../src/shards/nalati-grasslands/creatures/env';
import { invokeLegacy, legacyActor } from '../fake/legacyActor';
import { legacyMethods } from '../fake/legacySource';
import { creature } from '../fake/creature';
import { inArc, headingTo, fadeCooldown, behindPlayer, fleeHeading } from '../../src/shards/pine-hollow/combat/combatMath';
import { blackpawGoal, ghostGoal, ironhideGoal, imperialGoal } from '../fixtures/species-oracle/pineElites';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);
const file = 'src/shards/nalati-grasslands/combat/elites.ts';
const noOp = (): void => undefined;
const tell = (): object => ({ setTime: noOp, ring: noOp, hide: noOp, lane: noOp });
function elite(name: string, fields: Record<string, unknown>) {
  const f = creature('crab', 'small'), hits: number[] = [];
  const env = { reach: () => true, player: { position: f.ctx.player }, hurt: (_a: Animal, d: number): void => { hits.push(d); },
    knock: vi.fn(noOp), feed: vi.fn(noOp), sound: vi.fn(noOp), bar: { chevron: noOp }, game: f.game };
  const keeper = new AqbarsKeeper({ player: env.player, lair: { x: 0, z: 0 }, ledges: [], heightAt: () => 0,
    phase2: () => false, awareRadius: 60, isHead: () => false,
    ring: { setTime: noOp, ring: noOp, hide: noOp }, hurt: env.hurt, knock: env.knock, feed: env.feed, sound: env.sound, signature: noOp });
  if (name === 'Aqbars') keeper.restore({ ...keeper.snapshot(), st: fields['st'], stT: 0, cd: 0,
    hitDone: fields['hitDone'] ?? 0, from: fields['from'] instanceof THREE.Vector3 ? fields['from'].toArray() : [0, 0, 0],
    to: fields['to'] instanceof THREE.Vector3 ? fields['to'].toArray() : [0, 0, 0] });
  const kokbori = new KokboriKeeper({ player: env.player, lair: { x: 0, z: 0 }, phase2: () => false,
    pack: () => null, environment: () => wildEnv, random: () => 0.5,
    rings: { setTime: noOp, ring: noOp, hide: noOp }, hurt: env.hurt, feed: env.feed, sound: env.sound, signature: noOp });
  const qyran = new QyranKeeper({ player: env.player, rock: { x: 0, z: 0, top: 0 }, phase2: () => false,
    heightAt: () => 0, wind: () => ({ x: 0, z: 0 }), random: () => 0.5, isHead: () => false,
    tell: { setTime: noOp, aim: noOp, chevron: noOp, hide: noOp },
    hurt: env.hurt, knock: env.knock, feed: env.feed, sound: env.sound, signature: noOp });
  if (name === 'Kokbori') kokbori.restore({ ...kokbori.snapshot(), st: fields['st'], bit: fields['bit'] });
  if (name === 'Qyran') qyran.restore({ ...qyran.snapshot(), st: fields['st'], centre: [0, 0, 0],
    tgt: fields['tgt'] instanceof THREE.Vector3 ? fields['tgt'].toArray() : [0, 0, 0] });
  const proto = legacyMethods(file, name, { app, THREE, _v: new THREE.Vector3(), _w: new THREE.Vector3(), heightAt: () => 0, wildEnv });
  const actor = legacyActor(proto, { animal: f.animal, env, engagement: noOp, p2: false, stT: 0, cd: 0,
    toPlayer: (a: Animal) => ({ d: a.position.distanceTo(f.ctx.player), yaw: Math.atan2(f.ctx.player.x - a.position.x, f.ctx.player.z - a.position.z) }),
    ...fields, ...(name === 'Aqbars' ? { keeper } : name === 'Kokbori' ? { keeper: kokbori } : name === 'Qyran' ? { keeper: qyran } : {}) });
  return { ...f, actor, env, hits, keeper, kokbori, qyran };
}

describe('private Nalati elite strikes executed from their production class methods', () => {
  it('S13 Aqbars swipes twice at .45/.8 and recovers for1.4 seconds', () => {
    const f = elite('Aqbars', { st: 'swipe', hitDone: 0 }); f.animal.startAttack(1);
    for (let i = 0; i < 61; i++) {
      invokeLegacy(f.actor, 'act', f.animal, { ...f.ctx, dt: 1 / 60 }); f.animal.update(1 / 60, i / 60, true);
      if (i < 27) expect(f.hits).toEqual([]);
    }
    expect(f.hits).toEqual([14, 14]); expect(f.keeper.snapshot().cd).toBe(1.4); expect(f.animal.attackPhase).toBe(-1);
  });
  it.each([0, 2])('S14 Aqbars landing offsets%s preserve damage35 or the open miss window', (offset) => {
    const f = elite('Aqbars', { st: 'tell', ring: tell(), from: new THREE.Vector3(), to: new THREE.Vector3(0, 0, 1), goal: null,
      standY: () => 0, def: { awareR: 60 } }); f.ctx.player.x = offset;
    for (let i = 0; i < 120; i++) {
      invokeLegacy(f.actor, 'tick', 1 / 60, i / 60, true, false);
      if (i < 95) expect(f.hits).toEqual([]);
    }
    expect(f.hits).toEqual(offset === 0 ? [35] : []);
    expect(f.keeper.state).toBe(offset === 0 ? 'stalk' : 'open');
  });
  it('S15 Kokbori hits22 at .7 of a .9s bite then takes1.8 seconds to recover', () => {
    const f = elite('Kokbori', { st: 'hunt', bit: false, chase: (_a: Animal, _c: unknown, _d: number, yaw: number) => yaw }); f.animal.startAttack(0.9);
    for (let i = 0; i < 56; i++) {
      invokeLegacy(f.actor, 'act', f.animal, { ...f.ctx, dt: 1 / 60 }); f.animal.update(1 / 60, i / 60, true);
      f.animal.position.set(0, 0, 0);
      if (i < 38) expect(f.hits).toEqual([]);
    }
    expect(f.hits).toEqual([22]); expect(f.kokbori.snapshot().cd).toBeCloseTo(1.8);
  });
  it.each([2.39, 2.41])('S16 Qyran landing separation%s keeps the2.4m radius', (offset) => {
    const f = elite('Qyran', { st: 'stoop', centre: { x: 0, z: 0 }, lineMat: { uniforms: { uTime: { value: 0 } } },
      tgt: new THREE.Vector3(0, 0.9, 1), line: { visible: true }, aim: noOp });
    f.ctx.player.x = offset; f.animal.position.set(0, 0, 1); f.animal.mem['altY'] = 1;
    invokeLegacy(f.actor, 'tick', 1 / 60, 0, true, false);
    expect(f.hits).toEqual(offset < 2.4 ? [30] : []);
    expect(f.qyran.snapshot().st).toBe(offset < 2.4 ? 'climb' : 'ground');
  });
  it('S17 Qara Batyr tells for1.3s, charges for38 once and does not repeat a contact', () => {
    const f = elite('QaraBatyr', { st: 'wheel', lane: tell(), rider: null, c0: new THREE.Vector3(), c1: new THREE.Vector3(), struck: false });
    for (let i = 0; i < 78; i++) { invokeLegacy(f.actor, 'tick', 1 / 60, i / 60, true, false); expect(f.hits).toEqual([]); }
    expect(Reflect.get(f.actor, 'st')).toBe('charge');
    invokeLegacy(f.actor, 'tick', 1 / 60, 2, true, false); invokeLegacy(f.actor, 'tick', 1 / 60, 2.1, true, false);
    expect(f.hits).toEqual([38]); expect(f.env.knock).toHaveBeenCalledOnce();
  });
});

describe('Pine elite contacts and the nonattacking Ghost Stag', () => {
  function pine(name: string, fields: Record<string, unknown>) {
    const f = creature('crab', 'small'), hits: number[] = [], path = 'test/fixtures/species-oracle/pineElites.ts';
    const globals = { THREE, Math, canReach, headingTo, inArc, fadeCooldown, behindPlayer, fleeHeading, blackpawGoal, ghostGoal, ironhideGoal, imperialGoal, heightAt: () => 0,
      inChunk: () => true, voice: (): void => undefined, _v: new THREE.Vector3() };
    const proto = legacyMethods(path, name, globals), base = legacyMethods(path, 'PineEliteScript', globals);
    Object.setPrototypeOf(base, EliteBrain.prototype); Object.setPrototypeOf(proto, base);
    const env = { reach: () => true, player: { position: f.ctx.player, yaw: 0 }, hurt: (_a: Animal, d: number): void => { hits.push(d); },
      trauma: noOp, stun: vi.fn(noOp), god: false, voice: noOp, show: noOp, heightAt: () => 0, inChunk: () => true,
      fx: { fade: noOp, reappear: noOp, burstOut: noOp, roar: noOp } };
    const actor = legacyActor(proto, { env, ports: { player: env.player, random: Math.random }, p2: false, modeT: 0, sig: noOp, def: { lair: { x: 0, z: 0 }, leashR: 110 }, ...fields });
    return { ...f, actor, env, hits };
  }
  it.each([false, true])('S30 Blackpaw roar god%s hits12 and stuns1.3s after1.1s', (god) => {
    const f = pine('Blackpaw', { mode: 'roar', modeT: 1.1, roarCd: 0, ringR: 8, ring: tell() }); f.env.god = god;
    invokeLegacy(f.actor, 'fight', f.animal, 1 / 60, 0);
    expect(f.hits).toEqual(god ? [] : [12]); expect(f.env.stun).toHaveBeenCalledTimes(god ? 0 : 1);
    if (!god) expect(f.env.stun).toHaveBeenCalledWith(1.3);
  });
  it('S32 Blackpaw swipe lands22 only once as its delay expires', () => {
    const f = pine('Blackpaw', { mode: 'swipe', swipeT: 0.1, roarCd: 0, ring: tell() });
    invokeLegacy(f.actor, 'fight', f.animal, 0.09, 0); expect(f.hits).toEqual([]);
    invokeLegacy(f.actor, 'fight', f.animal, 0.02, 0.11); invokeLegacy(f.actor, 'fight', f.animal, 0.02, 0.13);
    expect(f.hits).toEqual([22]);
  });
  it.each([false, true])('S40 Ghost Stag phase2%s fades without attacking, then reappears14–18m behind', (p2) => {
    // the stag's rolls are its own seeded stream (combat/eliteStreams.ts): a mid draw puts it 16 m behind
    const f = pine('GhostStag', { p2, streams: { fight: { next: () => 0.5 } } });
    invokeLegacy(f.actor, 'fade', f.animal); expect(f.animal.hidden).toBe(true);
    expect(Reflect.get(f.actor, 'fadeT')).toBe(2); expect(Reflect.get(f.actor, 'cd')).toBe(p2 ? 2.4 : 4.5);
    invokeLegacy(f.actor, 'comeBack', f.animal); expect(f.animal.hidden).toBe(false); expect(f.hits).toEqual([]);
    expect(f.animal.position.distanceTo(f.ctx.player)).toBeCloseTo(16); expect(Reflect.get(f.actor, 'mode')).toBe('stare');
  });
});
