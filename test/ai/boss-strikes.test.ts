import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type * as Heightfield from '#engine/world/Heightfield';
import { GoldenKingFight } from '#shards/nalati-grasslands/kurganBoss';
import { StormTitanFight } from '#shards/nalati-grasslands/stormTitan';
import { AntlerKingFight } from '#shards/pine-hollow/combat/antlerKing';
import { DUNGEON } from '#shards/nalati-grasslands/world/KurganDungeon';
import { KINGS_CLEARING } from '#shards/pine-hollow/layout';
import { invokeLegacy, legacyActor } from '../fake/legacyActor';
import { creature } from '../fake/creature';

vi.mock('#engine/world/Heightfield', async (original) => ({ ...await original<typeof Heightfield>(),
  heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null }));
const noop = (): void => undefined;
const tell = (): object => ({ ring: noop, setTime: noop, hide: noop });
const visual = (): { mesh: THREE.Object3D; mat: { uniforms: { uAlpha: { value: number }; uTime: { value: number } } } } =>
  ({ mesh: new THREE.Object3D(), mat: { uniforms: { uAlpha: { value: 0 }, uTime: { value: 0 } } } });

describe('boss contacts executed through original production methods', () => {
  it.each([0, 1, 2, 3])('S19 Golden King cut%s keeps the damage sequence and .62 contact phase', (index) => {
    const f = creature('crab', 'small'); f.animal.startAttack(index === 3 ? 0.78 : 0.95);
    Object.assign(f.animal.mem, { act: 1, strike: index, hitDone: 0 });
    const hurt = vi.fn(noop), shove = vi.fn(noop);
    const fight = legacyActor(GoldenKingFight.prototype, { phase: index === 3 ? 2 : 0, dungeon: { arc: { mesh: { visible: true } } },
      host: { player: { position: f.ctx.player }, hurt }, comboLeft: 0, burstCd: 10, comboCd: 0, shove });
    for (let i = 0; i < 61; i++) {
      invokeLegacy(fight, 'fightTick', f.animal, 1, 0); f.animal.update(1 / 60, i / 60, true);
      if (i / 60 < 0.62 * (index === 3 ? 0.78 : 0.95)) expect(hurt).not.toHaveBeenCalled();
    }
    expect(hurt).toHaveBeenCalledExactlyOnceWith(index >= 2 ? 22 : 14);
    expect(shove).toHaveBeenCalledExactlyOnceWith(f.animal, index >= 2 ? 5 : 3);
  });
  it.each([false, true])('S20 sunburst jump%s dodges its one25-damage ring contact', (jump) => {
    const hurt = vi.fn(noop), dash = vi.fn(noop), vis = visual();
    const fight = legacyActor(GoldenKingFight.prototype, {
      host: { player: { position: new THREE.Vector3(5, jump ? 1 : 0, 0), dash }, hurt },
      rings: [{ active: true, delay: 0, r: 4.9, cx: 0, cz: 0, hit: false }],
      dungeon: { rings: [vis], floorHeightAt: () => 0 },
    });
    invokeLegacy(fight, 'updateRings', 1 / 60); invokeLegacy(fight, 'updateRings', 1 / 60);
    expect(hurt).toHaveBeenCalledTimes(jump ? 0 : 1); if (!jump) expect(hurt).toHaveBeenCalledWith(25);
  });
  it('S21 the Golden beam ticks15 once a second', () => {
    const hurt = vi.fn(noop), vis = visual(), line = new THREE.Object3D();
    const fight = legacyActor(GoldenKingFight.prototype, { beamK: 1, beamOn: true, mode: 'fight', beamA: 0, beamDir: 0,
      beamHitCd: 0, beamKingCd: 0, king: null, dungeon: { beam: { ...vis, line, lineMat: vis.mat } },
      host: { player: { position: new THREE.Vector3(DUNGEON.x, 0, DUNGEON.z + 6.2 * 0.85 - 0.5) }, hurt },
    });
    invokeLegacy(fight, 'updateBeam', 0.1); invokeLegacy(fight, 'updateBeam', 0.9); expect(hurt).toHaveBeenCalledExactlyOnceWith(15);
    invokeLegacy(fight, 'updateBeam', 0.1); expect(hurt).toHaveBeenCalledTimes(2);
  });
  it('S22 sand keeps the1s tell,6s pour and4-damage2/s chance inside .55m', () => {
    const draw = vi.spyOn(Math, 'random').mockReturnValue(0), hurt = vi.fn(noop), vis = visual(), tellMesh = new THREE.Object3D();
    const fight = legacyActor(GoldenKingFight.prototype, { phase: 1, mode: 'fight', streamT: 100, streams: [{ st: 1, t: 0 }],
      dungeon: { streams: [{ ...vis, tell: tellMesh, tellMat: vis.mat, x: 0, z: 0 }], sandAt: () => 0, addSand: noop },
      host: { player: { position: new THREE.Vector3(DUNGEON.x, 0, DUNGEON.z) }, hurt },
    });
    try {
      invokeLegacy(fight, 'updateStreams', 1); expect(hurt).not.toHaveBeenCalled();
      invokeLegacy(fight, 'updateStreams', 0.01); invokeLegacy(fight, 'updateStreams', 0.1); expect(hurt).toHaveBeenCalledExactlyOnceWith(4);
      invokeLegacy(fight, 'updateStreams', 6); const streams: unknown = Reflect.get(fight, 'streams'); expect(streams).toEqual([{ st: 0, t: 0 }]);
    } finally { draw.mockRestore(); }
  });
  it('S23 Sky Spear tracks, locks for the final .5s, hits40 and throws the rider after1.5s', () => {
    const hurt = vi.fn(noop), throwRider = vi.fn(noop), p = new THREE.Vector3();
    const at = new THREE.Vector3(), fight = legacyActor(StormTitanFight.prototype, { spear: 'aim', spearT: 0,
      body: { raise: 0, bend: 0 }, host: { player: { position: p }, hurt, throwRider },
      spearAt: at, spearRing: tell(), spearFork: tell(), bolt: noop, phase: 0 });
    invokeLegacy(fight, 'updateSpear', 0.9, 0); p.x = 2; invokeLegacy(fight, 'updateSpear', 0.2, 1);
    expect(at.x).toBe(0); expect(hurt).not.toHaveBeenCalled(); invokeLegacy(fight, 'updateSpear', 0.4, 1.5);
    expect(hurt).toHaveBeenCalledWith(40, expect.any(String)); expect(throwRider).toHaveBeenCalledOnce();
  });
  it('S26 chain lightning waits .6 seconds and lands18 once inside3m', () => {
    const hurt = vi.fn(noop), chain = { on: true, t: 0, x: 0, z: 0, tell: tell() };
    const fight = legacyActor(StormTitanFight.prototype, { body: { castL: 0 }, chainCd: 100, chainLeft: 0, chains: [chain],
      host: { player: { position: new THREE.Vector3(2.9, 0, 0) }, hurt }, bolt: noop, ignite: noop });
    invokeLegacy(fight, 'updateChains', 0.59, 0); expect(hurt).not.toHaveBeenCalled();
    invokeLegacy(fight, 'updateChains', 0.01, 0.6); invokeLegacy(fight, 'updateChains', 1, 1.6);
    expect(hurt).toHaveBeenCalledWith(18, expect.any(String)); expect(hurt).toHaveBeenCalledOnce();
  });
  it.each([false, true])('S36 Antler root-ring jump%s keeps its20 damage and .9m half width', (jump) => {
    const f = creature('crab', 'small'), hurt = vi.fn(noop), pos = new THREE.Vector3(KINGS_CLEARING.x, 0, KINGS_CLEARING.z + 5);
    f.animal.position.set(KINGS_CLEARING.x, 0, KINGS_CLEARING.z);
    const fight = legacyActor(AntlerKingFight.prototype, { ctx: { player: { position: pos, onGround: !jump }, hurt, trauma: noop },
      waves: [{ on: true, delay: 0, r: 4.4, hit: false, g: tell() }] });
    invokeLegacy(fight, 'tickWaves', f.animal, 1 / 60, 0); invokeLegacy(fight, 'tickWaves', f.animal, 1 / 60, 1);
    expect(hurt).toHaveBeenCalledTimes(jump ? 0 : 1); if (!jump) expect(hurt).toHaveBeenCalledWith(f.animal, 20);
  });
  it('S39 fallen lanterns deliver9 per .8s only inside the3m fire zone', () => {
    const f = creature('crab', 'small'), hurt = vi.fn(noop), flame = visual();
    const fight = legacyActor(AntlerKingFight.prototype, { ctx: { player: { position: new THREE.Vector3() }, hurt },
      fallen: [{ fallT: 1, x: 0, y: 0, z: 0, flame, ring: tell(), acc: 0 }], darkK: 0, won: false, king: f.animal });
    invokeLegacy(fight, 'hazards', 0.79, 0, true); expect(hurt).not.toHaveBeenCalled();
    invokeLegacy(fight, 'hazards', 0.02, 0.81, true); expect(hurt).toHaveBeenCalledWith(f.animal, 9);
  });
  it('S27 grass fire delivers4 every .5s and preserves8 damage/second', () => {
    const hurt = vi.fn(noop), fight = legacyActor(StormTitanFight.prototype, {
      fire: { update: noop, begin: noop, end: noop }, fireOn: true, spreadT: 100, burn: [], fireDmgT: 0,
      burningAt: () => true, host: { player: { position: new THREE.Vector3() }, mounted: () => false, hurt },
    });
    invokeLegacy(fight, 'updateFire', 0.1, 0, true); invokeLegacy(fight, 'updateFire', 0.49, 0.49, true);
    expect(hurt).toHaveBeenCalledOnce(); invokeLegacy(fight, 'updateFire', 0.02, 0.51, true);
    expect(hurt).toHaveBeenCalledTimes(2); expect(hurt).toHaveBeenCalledWith(4, expect.any(String));
  });
  it('S24 whirlwinds hit15 once per2s and lift the rider', () => {
    const hurt = vi.fn(noop), throwRider = vi.fn(noop), fight = legacyActor(StormTitanFight.prototype, {
      whirlCd: 0, whirls: [{ on: true, k: 1, x: 0, z: 0, vx: 0, vz: 0, funnel: new THREE.Object3D() }],
      debris: { count: 0, setMatrixAt: noop, instanceMatrix: { needsUpdate: false } },
      host: { player: { position: new THREE.Vector3() }, hurt, throwRider },
    });
    invokeLegacy(fight, 'updateWhirls', 0, 0, true); invokeLegacy(fight, 'updateWhirls', 0, 0, true);
    expect(hurt).toHaveBeenCalledExactlyOnceWith(15, expect.any(String)); expect(throwRider).toHaveBeenCalledOnce();
  });
});
