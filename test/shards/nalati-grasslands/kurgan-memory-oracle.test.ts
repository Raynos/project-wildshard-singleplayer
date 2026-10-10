// oxlint-disable-next-line import/no-nodejs-modules -- Fence the frozen shipping recipe and compare every geometry byte.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- The oracle is test-only source, reconstructed byte-for-byte below.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { Rng, type RngState } from '../../../src/engine/core/rng';
import { PaintKit } from '../../../src/shards/nalati-grasslands/world/paint';
import { Scope } from '../../../src/engine/app/scope';
import { ownSceneTree } from '../../../src/engine/app/sceneOwnership';
import { BossBrain, type BossPorts, type BossPresentation, type BossScript } from '../../../src/engine/ai/BossBrain';
import { KurganDungeon, DUNGEON } from '../../../src/shards/nalati-grasslands/world/KurganDungeon';
import { KurganBoss } from '../../../src/shards/nalati-grasslands/combat/goldenKing';
import { KING_DEF_PHASES } from '../../../src/shards/nalati-grasslands/data/goldenKingFight';
import { ShippingKurganDungeon } from '../../fixtures/kurgan-oracle/dungeon';
import source from '../../fixtures/kurgan-oracle/source.json' with { type: 'json' };
import { invokeLegacy, legacyActor } from '../../fake/legacyActor';
import { legacyDouble } from '../../fake/FakeGame';
import { isDev, setDev } from '../../../src/engine/core/devMode';
import { overrideSetting } from '../../../src/engine/ui/Settings';

type Dungeon = Pick<KurganDungeon, 'group' | 'colliders' | 'floorHeightAt' | 'setVisible' | 'setLid' | 'setSealed' | 'setNicheStatue' | 'setShaft' | 'showHeap' | 'clearSand' | 'addSand' | 'update'>;
const hash = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
function draws(results: readonly { value: unknown }[]): number[] {
  return results.map(r => { if (typeof r.value !== 'number') throw new Error('Expected a setup draw'); return r.value; });
}
function isGeometry(value: unknown): value is THREE.BufferGeometry { return value instanceof THREE.BufferGeometry; }
function isMaterial(value: unknown): value is THREE.Material { return value instanceof THREE.Material; }
function geometry(g: THREE.BufferGeometry): object {
  return Object.fromEntries(Object.entries(g.attributes).map(([name, a]) => {
    if (!(a instanceof THREE.BufferAttribute)) throw new Error('The shipping dungeon has plain attributes');
    return [name, { count: a.count, itemSize: a.itemSize, bytes: a.array.byteLength,
      digest: hash(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)) }];
  }));
}
function meshes(d: Dungeon, interior: boolean): object[] {
  const values: object[] = [];
  d.group.traverse(o => {
    if (!(o instanceof THREE.Mesh) || (o.name === 'kurgan-interior') !== interior) return;
    const g: unknown = o.geometry;
    if (!(isGeometry(g))) throw new Error('Missing shipping geometry');
    values.push({ name: o.name, visible: o.visible, position: o.position.toArray(), quaternion: o.quaternion.toArray(),
      scale: o.scale.toArray(), geometry: geometry(g) });
  });
  return values;
}
function dispose(d: Dungeon): void {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  d.group.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const g: unknown = o.geometry, material: unknown = o.material;
    if (isGeometry(g)) geometries.add(g);
    const list: readonly unknown[] = Array.isArray(material) ? material : [material];
    for (const m of list) if (isMaterial(m)) materials.add(m);
  });
  for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); d.group.clear();
}
function checkpoint(d: Dungeon, phase: number): void {
  d.setSealed(phase !== 0); d.setLid(0); d.clearSand();
  d.setShaft(0, 0.38); d.setShaft(1, phase === 3 ? 1 : 0); d.showHeap(phase === 3);
  for (let i = 0; i < 4; i++) d.setNicheStatue(i, phase !== 2);
  if (phase >= 2) d.addSand(2, -3, 4, 0.4);
}

it('reconstructs the frozen pre-cut shipping source byte-for-byte', () => {
  let raw = readFileSync(new URL('../../fixtures/kurgan-oracle/dungeon.ts', import.meta.url), 'utf8');
  for (const pair of source.rewrites) {
    const from = pair[0], to = pair[1];
    if (from === undefined || to === undefined) throw new Error('Missing source rewrite');
    raw = raw.replaceAll(to, from);
  }
  expect(hash(raw)).toBe(source.sha256);
});

it('captures the shipping post-static RNG continuation without changing the oracle', () => {
  const boundaries: { state: RngState; triangles: number }[] = [];
  // oxlint-disable-next-line typescript/unbound-method -- Reapply the shipping method with its original receiver to observe its exact boundary.
  const finish = PaintKit.prototype.finish;
  const capture = vi.spyOn(PaintKit.prototype, 'finish').mockImplementation(function captureStatic(this: PaintKit, ...args: Parameters<PaintKit['finish']>) {
    const geo = finish.apply(this, args);
    const state = this.rng.snapshot();
    if (state.initial === 0xb0551) boundaries.push({ state, triangles: geo.getAttribute('position').count / 3 });
    return geo;
  });
  const oracle = new ShippingKurganDungeon().build();
  try {
    expect(boundaries).toEqual([{ state: { version: 1, state: 1996222552, initial: 0xb0551, scrambledFork: false }, triangles: 111316 }]);
  }
  finally { capture.mockRestore(); dispose(oracle); }
});

it('preserves boot movables, FX, colliders, floors and every seeded setup draw', () => {
  const next = vi.spyOn(Rng.prototype, 'next');
  const oracle = new ShippingKurganDungeon().build();
  const shippingDraws = draws(next.mock.results); next.mockClear();
  const actual = new KurganDungeon().build();
  try {
    expect(draws(next.mock.results)).toEqual(shippingDraws);
    expect(actual.group.visible).toBe(false); expect(meshes(actual, false)).toEqual(meshes(oracle, false));
    expect(actual.colliders).toEqual(oracle.colliders);
    for (const [x, z] of [[0, 0], [0, 20], [0, -8.3], [-5, -2], [30, 30]]) {
      if (x === undefined || z === undefined) throw new Error('Missing floor point');
      expect(actual.floorHeightAt(DUNGEON.x + x, DUNGEON.z + z)).toBe(oracle.floorHeightAt(DUNGEON.x + x, DUNGEON.z + z));
    }
  } finally { next.mockRestore(); dispose(actual); dispose(oracle); }
});

it('lazy boot skips the static primary RNG prefix and retains the exact movable draw suffix', () => {
  const values: { state: number; value: number }[] = [];
  // oxlint-disable-next-line typescript/unbound-method -- Reapply each original draw to the same RNG receiver while recording its continuation.
  const original = Rng.prototype.next;
  const next = vi.spyOn(Rng.prototype, 'next').mockImplementation(function recordPrimaryDraw(this: Rng) {
    const state = this.snapshot(), value = original.call(this);
    if (state.initial === 0xb0551) values.push({ state: state.state, value });
    return value;
  });
  const oracle = new ShippingKurganDungeon().build(), shipping = values.splice(0);
  const actual = new KurganDungeon().build(true);
  try {
    const boundary = shipping.findIndex(row => row.state === 1996222552);
    expect(boundary).toBeGreaterThan(0);
    expect(values).toEqual(shipping.slice(boundary));
    expect(values.length).toBeGreaterThan(0);
    expect(meshes(actual, true)).toEqual([]);
    expect(meshes(actual, false)).toEqual(meshes(oracle, false));
    expect(actual.tris).toBe(oracle.tris);
  } finally { next.mockRestore(); dispose(actual); dispose(oracle); }
});

it('the real boss boot follows Memory saver ON without dropping collision or movables', () => {
  const previousDev = isDev(); setDev(true); overrideSetting('memorySaver', 'on');
  const actual = new KurganDungeon(), add = vi.fn(), scene = new THREE.Scene();
  const boss = legacyActor(KurganBoss.prototype, { dungeon: actual, spareLight: new THREE.PointLight(), ctx: { game: { scene }, registry: { add } } });
  try {
    boss.build();
    expect(actual.group.parent).toBe(scene); expect(actual.group.visible).toBe(false);
    expect(add).toHaveBeenCalledTimes(2); expect(actual.colliders.length).toBeGreaterThan(0);
    expect(meshes(actual, false).length).toBeGreaterThan(0);
    expect(actual.group.getObjectByName('kurgan-interior')).toBeUndefined();
  } finally { dispose(actual); overrideSetting('memorySaver', null); setDev(previousDev); }
});

it('matches every static byte and preserved checkpoint state on entry, exit and re-entry', () => {
  const oracle = new ShippingKurganDungeon().build(), actual = new KurganDungeon().build(true);
  try {
    expect(meshes(actual, true)).toEqual([]);
    expect(meshes(actual, false)).toEqual(meshes(oracle, false));
    expect(actual.colliders).toEqual(oracle.colliders);
    let firstInterior: THREE.Object3D | undefined;
    for (const phase of [0, 2, 3, 0]) {
      checkpoint(oracle, phase); checkpoint(actual, phase);
      oracle.setVisible(true); actual.setVisible(true);
      oracle.update(1 / 60, phase + 1); actual.update(1 / 60, phase + 1);
      expect(meshes(actual, true)).toEqual(meshes(oracle, true));
      const interior = actual.group.getObjectByName('kurgan-interior');
      firstInterior ??= interior;
      expect(interior).toBe(firstInterior);
      expect(actual.group.children.map(child => child.name)).toEqual(oracle.group.children.map(child => child.name));
      expect(meshes(actual, false)).toEqual(meshes(oracle, false));
      expect(actual.colliders).toEqual(oracle.colliders);
      oracle.setVisible(false); actual.setVisible(false);
    }
  } finally { dispose(actual); dispose(oracle); }
});

it('disposes the late static geometry exactly once through the real delegated scene owner', () => {
  const owner = new Scope('lazy-kurgan'), actual = new KurganDungeon().build(true);
  ownSceneTree(actual.group, owner, { isAcquired: () => false });
  actual.setVisible(true);
  const interior = actual.group.getObjectByName('kurgan-interior');
  if (!(interior instanceof THREE.Mesh) || !(interior.geometry instanceof THREE.BufferGeometry)) throw new Error('Missing static mesh');
  const released = vi.fn<() => void>(); interior.geometry.addEventListener('dispose', released);
  owner.dispose(); owner.dispose();
  expect(released).toHaveBeenCalledOnce(); expect(actual.group.children).toEqual([]);
});

it('uses the real entry fade before showing the chamber and preserves immediate entry', () => {
  const dungeon = new KurganDungeon().build(true), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const player = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), yaw: 0, pitch: 0, moveScale: 1 };
  const fade = vi.fn(), arm = vi.fn(), present = vi.fn();
  const boss = legacyActor(KurganBoss.prototype, { dungeon, ctx: { player, game: { scene, camera } },
    play: { animals: { group: new THREE.Group(), calm: false }, setWeaponsEnabled: vi.fn() },
    boss: { arm, disarm: vi.fn(), engaged: false }, fight: { setPresent: present }, ui: { fade },
    fadeT: -1, pending: null, inside: false, locked: false, slow: false });
  try {
    invokeLegacy(boss, 'enter'); expect(fade).toHaveBeenCalledWith(true, 220);
    boss.update(0.23, 0.23); expect(dungeon.group.visible).toBe(false); expect(meshes(dungeon, true)).toEqual([]); expect(arm).not.toHaveBeenCalled();
    boss.update(0.02, 0.25); expect(dungeon.group.visible).toBe(true); expect(arm).toHaveBeenCalledOnce();
    expect(fade).toHaveBeenLastCalledWith(false, 420); expect(present).toHaveBeenLastCalledWith(true);
    invokeLegacy(boss, 'exit', false); expect(dungeon.group.visible).toBe(false);
    invokeLegacy(boss, 'enter', true); expect(dungeon.group.visible).toBe(true); expect(arm).toHaveBeenCalledTimes(2);
  } finally { dispose(dungeon); }
});

it('restores the real boss continuation without allocating static dressing, then enters at its checkpoint', () => {
  const actual = new KurganDungeon().build(true), oracle = new ShippingKurganDungeon().build();
  const reset = vi.fn((phase: number) => { checkpoint(actual, phase); });
  const script = legacyDouble<BossScript>({ reset, seal: (on: boolean) => actual.setSealed(on), setInvulnerable: () => undefined });
  const brain = new BossBrain({ id: 'golden-king', name: '', title: '', retryTitle: '', intro: 4.2, introShort: 1.4,
    phases: KING_DEF_PHASES, reward: {} }, script, legacyDouble<BossPorts>({}), legacyDouble<BossPresentation>({}),
  { defeated: false, rewardTaken: false, kills: 0 });
  const player = { position: new THREE.Vector3(), velocity: new THREE.Vector3(), yaw: 0, pitch: 0, moveScale: 1 };
  const boss = legacyActor(KurganBoss.prototype, { dungeon: actual, ctx: { player, game: { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() } },
    play: { animals: { group: new THREE.Group(), calm: false }, setWeaponsEnabled: vi.fn() }, boss: brain,
    fight: { setPresent: vi.fn() }, inside: false, locked: false, slow: false });
  try {
    const saved = { ...brain.snapshot(), phase: 2, checkpoint: 2, attempts: 3 };
    brain.restore(saved); expect(brain.snapshot()).toEqual(saved);
    expect(reset).not.toHaveBeenCalled(); expect(meshes(actual, true)).toEqual([]);
    invokeLegacy(boss, 'enter', true);
    expect(reset).toHaveBeenCalledExactlyOnceWith(2); expect(brain.phase).toBe(2);
    checkpoint(oracle, 2); oracle.setVisible(true);
    expect(meshes(actual, true)).toEqual(meshes(oracle, true));
    expect(meshes(actual, false)).toEqual(meshes(oracle, false));
  } finally { dispose(actual); dispose(oracle); }
});
