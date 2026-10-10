import * as THREE from 'three';
import { afterAll, expect, it } from 'vitest';
import { app } from '../../../src/engine/app/runtime';
import { overrideTerrain } from '../../../src/engine/world/Heightfield';
import { Animal } from '../../../src/engine/entities/AnimalView';
import { AnimalFactory } from '../../../src/engine/entities/AnimalFactory';
import type { AnimalManager } from '../../../src/engine/entities/AnimalManager';
import type { ThinkCtx } from '../../../src/engine/entities/species/registry';
import { BossBrain, type BossPresentation, type BossScript } from '../../../src/engine/ai/BossBrain';
import { Rng } from '../../../src/engine/core/rng';
import type { Player } from '../../../src/engine/player/Player';
import { GOLDENKING_SPECIES } from '../../../src/shards/nalati-grasslands/species/goldenKing';
import { KurganDungeon, DUNGEON, STREAMS } from '../../../src/shards/nalati-grasslands/world/KurganDungeon';
import { KING_ENCOUNTER } from '../../../src/shards/nalati-grasslands/data/goldenKingFight';
import { goldenKingFight } from '../../../src/shards/nalati-grasslands/combat/goldenKing';
import { GoldenKingFight as OracleFight } from '../../fixtures/species-oracle/goldenKing';
import { legacyDouble } from '../../fake/FakeGame';
import { fakeWorld } from '../../fake/world';

// a flat, dry world through the terrain port, not a module mock (E422)
const restoreTerrain = overrideTerrain({ heightAt: (): number => 0, normalAt: (): [number, number, number] => [0, 1, 0], waterLevel: (): number => -100, streamAt: (): null => null });
afterAll(restoreTerrain);

const DT = 1 / 60, TICKS = 14000;
const noop = (): void => undefined;
const presentation: BossPresentation = { update: noop, barShown: false, hideBar: noop, hideNameCard: noop, hideReward: noop, showRetry: noop,
  showNameCard: noop, setSkip: noop, showBar: noop, setHp: noop, setShield: noop, setPhase: noop };

function fnv(values: ArrayLike<number>): number {
  let h = 0x811c9dc5;
  const bytes = new Uint8Array(new Float64Array(Array.from(values)).buffer);
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
const v3 = (v: THREE.Vector3 | THREE.Euler): number[] => [v.x, v.y, v.z];
interface Placed { visible: boolean; position: THREE.Vector3; scale: THREE.Vector3; rotation: THREE.Euler; quaternion: THREE.Quaternion }
function meshState(m: Placed): unknown { return [m.visible, v3(m.position), v3(m.scale), v3(m.rotation), m.quaternion.toArray()]; }
function alphaOf(mat: { uniforms: { uAlpha: { value: number } } }): number { return mat.uniforms.uAlpha.value; }

/** Everything the fight drew on or piled in the chamber. */
function chamberState(d: KurganDungeon): unknown {
  const lid: unknown = Reflect.get(d, 'lid'), heap: unknown = Reflect.get(d, 'heap'), statues: unknown = Reflect.get(d, 'statues');
  const shafts: unknown = Reflect.get(d, 'shafts'), sand: unknown = Reflect.get(d, 'sandH');
  if (!(lid instanceof THREE.Object3D) || !(heap instanceof THREE.Object3D) || !Array.isArray(statues) || !Array.isArray(shafts) || !(sand instanceof Float32Array)) throw new Error('chamber moved');
  return {
    lid: meshState(lid), heap: meshState(heap), sealed: d.sealed,
    statues: statues.map((s: unknown) => s instanceof THREE.Object3D && s.visible),
    shafts: shafts.map((s: unknown) => Number(Reflect.get(s instanceof Object ? s : {}, 'target'))),
    sand: fnv(sand),
    rings: d.rings.map((r) => [meshState(r.mesh), alphaOf(r.mat)]),
    streams: d.streams.map((s) => [meshState(s.mesh), alphaOf(s.mat), meshState(s.tell), alphaOf(s.tellMat)]),
    beam: [meshState(d.beam.mesh), alphaOf(d.beam.mat), meshState(d.beam.line), alphaOf(d.beam.lineMat)],
    dome: [meshState(d.dome.mesh), alphaOf(d.dome.mat)], arc: meshState(d.arc.mesh),
  };
}
function bodyState(a: Animal): unknown {
  const mats = Array.isArray(a.mesh.material) ? a.mesh.material : [a.mesh.material];
  return { p: v3(a.position), yaw: a.yaw, hp: a.hp, alive: a.alive, hidden: a.hidden, mem: { ...a.mem }, atk: a.attackPhase, look: a.lookWeight,
    yOffset: a.yOffset, visible: a.mesh.visible, glow: mats.map((m) => m instanceof THREE.MeshLambertMaterial ? m.emissiveIntensity : -1) };
}

interface Run { trace: string[]; hurts: string[]; feed: string[]; dashes: string[]; states: Set<string>; modes: Set<string> }

/** One whole fight: `make` builds the fight (oracle or platform) on a fresh chamber; a scripted player walks, jumps, hits and kills adds. */
function fight(make: (d: KurganDungeon, host: { player: Player; animals: AnimalManager; spawnKing: () => Animal | null; hurt: (dmg: number, through?: boolean) => void; feed: (t: string) => void }) => {
  script: BossScript; state: () => Record<string, unknown>; adds: () => readonly Animal[];
}): Run {
  app.rng.seed(4351);
  const world = fakeWorld(), factory = new AnimalFactory(world.sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
  const base = factory.model('crab', 'small');
  const damageMul = GOLDENKING_SPECIES.damageMul;
  if (damageMul === undefined) throw new Error('the King lost his damage rule');
  const kingModel = { ...base, species: { ...base.species, damageMul } };
  const d = new KurganDungeon().build(true);
  const run: Run = { trace: [], hurts: [], feed: [], dashes: [], states: new Set(), modes: new Set() };
  let frame = 0;
  const position = new THREE.Vector3(DUNGEON.x, DUNGEON.y, DUNGEON.z + 6);
  const player = legacyDouble<Player>({ position, dash: (x: number, z: number, t: number): boolean => { run.dashes.push(`${frame}:${x}:${z}:${t}`); return true; } });
  const list: Animal[] = [];
  const spawn = (model: typeof base, x: number, z: number, yaw: number): Animal => {
    const a = new Animal(factory.instantiate(model, 0.5), model, 0.5);
    a.place(x, z, yaw); list.push(a); return a;
  };
  const animals = legacyDouble<AnimalManager>({ animals: list,
    spawn: (_kind: string, x: number, z: number, yaw: number): Animal => { const a = spawn(base, x, z, yaw); a.maxHp = a.hp = 120; return a; } });
  const spawnKing = (): Animal => { const a = spawn(kingModel, DUNGEON.x, DUNGEON.z, 0); a.maxHp = a.hp = 2400; return a; };
  const built = make(d, { player, animals, spawnKing, hurt: (dmg, through) => { run.hurts.push(`${frame}:${dmg}:${String(through)}`); }, feed: (t) => { run.feed.push(`${frame}:${t}`); } });
  const saved = { defeated: false, rewardTaken: false, kills: 0 };
  const brain = new BossBrain({ ...KING_ENCOUNTER, reward: {} }, built.script, {
    player, lockInput: noop, respawn: noop, skipHeld: () => false, faceToward: noop, spawnReward: noop, persist: noop,
  }, presentation, saved);
  const ctx: ThinkCtx = {
    dt: 0.1, t: 0, player: position, playerSpeed: 0, rng: new Rng(357), calm: false, herd: null, world: {}, hurt: noop, sound: noop,
    heightAt: () => DUNGEON.y, waterLevel: () => -100, steer: (a, yaw, speed, turn) => { a.setMotion(yaw, speed, turn); },
    flight: { steer: (a, yaw, speed, altitude, turn) => { a.fly(yaw, speed, altitude, turn); } },
    pathYaw: (a, x, z) => Math.atan2(x - a.position.x, z - a.position.z), confine: noop, reach: () => true, claim: () => true, mayAttack: () => true,
  };
  const head = new THREE.Vector3(), dir = new THREE.Vector3(0, 0, -1), hit = new THREE.Vector3();
  brain.arm();
  let after = -1, addKills = 0;
  for (; frame < TICKS; frame++) {
    const t = frame * DT;
    // the player: a wandering loop round the chamber, near then far, standing to trade blows now and then, a jump every few seconds
    const st = built.state(), phase = Number(st['phase']), streams: unknown = st['streams'];
    const r = 1.6 + 6.4 * (0.5 + 0.5 * Math.sin(frame / 173)), ang = frame / 89;
    if (frame % 600 >= 240) { position.x = DUNGEON.x + Math.sin(ang) * r; position.z = DUNGEON.z + Math.cos(ang) * r; }
    // phase II: under a pouring stream for a while
    const pouring = Array.isArray(streams) ? streams.findIndex((x: unknown) => Reflect.get(x instanceof Object ? x : {}, 'st') === 2) : -1, spot = STREAMS[pouring];
    if (phase === 1 && spot && frame % 300 < 100) { position.x = DUNGEON.x + spot.x; position.z = DUNGEON.z + spot.z; }
    // phase III: just ahead of the beam on its arc, so he follows through it (now and then in it)
    if (phase >= 2) {
      const a = Number(st['beamA']) + (frame % 400 < 60 ? 0 : 0.6) * Number(st['beamDir']);
      position.x = DUNGEON.x + Math.sin(a) * 6.2; position.z = DUNGEON.z + Math.cos(a) * 6.2 * 0.85 - 0.5;
    }
    position.y = (d.floorHeightAt(position.x, position.z) ?? DUNGEON.y) + (frame % 240 < 24 ? 0.7 : 0);
    if (frame < 90) position.set(DUNGEON.x, DUNGEON.y, DUNGEON.z + 12 - frame / 30);
    const king = built.script.dead || list.length === 0 ? null : list.find((a) => a.alive && a.maxHp === 2400) ?? null;
    if (king) {
      if (frame % 6 === 0) { ctx.dt = 0.1; ctx.t = t; GOLDENKING_SPECIES.think?.(king, ctx); }
      GOLDENKING_SPECIES.act?.(king, { ...ctx, dt: DT, t });
    }
    for (const a of list) a.update(DT, t, true);
    // the player's blows: a sabre in reach (body or face), arrows from afar, headshots in phase III
    if (king && frame % (phase >= 2 ? 45 : 14) === 0 && frame > 400) {
      king.headWorld(head);
      const near = Math.hypot(position.x - king.position.x, position.z - king.position.z) < 3.6;
      const toHead = phase >= 2 ? frame % 90 === 0 : frame % 42 === 0;
      hit.copy(toHead ? head : king.position).setY(toHead ? head.y : king.position.y + 0.8);
      king.applyDamage(near ? 29 : 31, hit, dir);
    }
    // the adds: one falls now and then, slowly enough that the reinforcements step out
    const live = built.adds().filter((a) => a.alive);
    if (live.length > 0 && frame % (addKills < 1 ? 300 : 1700) === 0) { const a = live[0]; if (a) { a.applyDamage(5000, a.position, dir); addKills++; } }
    brain.update(DT, t);
    const now = built.state();
    run.states.add(brain.state); run.modes.add(String(now['mode']));
    run.trace.push(JSON.stringify({ frame, boss: brain.snapshot(), st: now, king: list.filter((a) => a.maxHp === 2400).map(bodyState),
      adds: built.adds().map(bodyState), listed: list.length, rng: app.rng.stream('ai').snapshot(), chamber: chamberState(d) }));
    if (brain.state === 'victory' && after < 0) after = frame;
    if (after >= 0 && frame > after + 240) break;
  }
  return run;
}

/** The first path where two traced ticks differ, with both values ('' when equal). */
function firstDifference(a: unknown, b: unknown, path: string): string {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return Object.is(a, b) ? '' : `${path}: ${JSON.stringify(a)} vs oracle ${JSON.stringify(b)}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) { const d = firstDifference(Reflect.get(a, k), Reflect.get(b, k), `${path}.${k}`); if (d !== '') return d; }
  return '';
}

const ORACLE_KEYS = ['mode', 'phase', 'invuln', 'lockHp', 'modeT', 'comboLeft', 'comboCd', 'burstCd', 'glow', 'glint', 'plaques', 'chestOpen', 'headHp', 'lastHp',
  'lastHeadHit', 'waves', 'waveT', 'rings', 'streams', 'streamT', 'beamOn', 'beamA', 'beamDir', 'beamHitCd', 'beamKingCd', 'beamK', 'victoryT'];

it('the Golden King on the platform phased boss fight replays the shipped fight exactly: every tick, hit, line, rng draw, view and drift', () => {
  const oracle = fight((d, host) => {
    const f = new OracleFight(d, host);
    const balbals = (): readonly Animal[] => { const b: unknown = Reflect.get(f, 'balbals'); return Array.isArray(b) ? b.map((x: unknown) => { const a: unknown = Reflect.get(x instanceof Object ? x : {}, 'a'); if (!(a instanceof Animal)) throw new Error('add moved'); return a; }) : []; };
    return { script: f, adds: balbals,
      state: () => Object.fromEntries(ORACLE_KEYS.map((k) => [k, structuredClone(Reflect.get(f, k))])) };
  });
  const platform = fight((d, host) => {
    const f = goldenKingFight(d, host);
    return { script: f.script, adds: () => f.phased.adds(), state: () => Object.fromEntries(ORACLE_KEYS.map((k) => [k, Reflect.get(f.phased.snapshot(), k)])) };
  });
  for (let i = 0; i < Math.max(oracle.trace.length, platform.trace.length); i++) {
    if (oracle.trace[i] !== platform.trace[i]) expect(firstDifference(JSON.parse(platform.trace[i] ?? 'null'), JSON.parse(oracle.trace[i] ?? 'null'), `tick ${i}`)).toBe('');
  }
  expect(platform.hurts).toEqual(oracle.hurts);
  expect(platform.feed).toEqual(oracle.feed);
  expect(platform.dashes).toEqual(oracle.dashes);
  // the fight really ran: the intro, all three phases with their beats and the victory; every mode; hits both ways
  expect([...oracle.states].sort()).toEqual(['armed', 'beat', 'fight', 'intro', 'victory']);
  expect([...oracle.modes].sort()).toEqual(['coffin', 'dead', 'fight', 'kneel', 'rising', 'shield', 'stun', 'toCoffin']);
  expect(oracle.feed.map((l) => l.split(':').slice(1).join(':'))).toEqual(expect.arrayContaining([
    'The kurgan wakes — the King falls back to his coffin', 'The King tears off his cloak — the gold burns', 'Gold plaques torn loose — his chest is bare',
    'The headdress falls — the King kneels', 'SUNBURST — jump it', 'SUNBURST ×2 — jump, land, jump', 'The dome breaks — the King is stunned', 'The sun beam sears the King']));
  // every blow the fight deals landed at least once: the cuts (14, 22), the sunburst ring (25), the sand (4), the beam (15)
  expect(new Set(oracle.hurts.map((h) => h.split(':').slice(1).join(':')))).toEqual(new Set(['14:undefined', '22:undefined', '25:true', '4:true', '15:true']));
  expect(oracle.dashes.length).toBeGreaterThan(0);
  expect(oracle.trace.length).toBeGreaterThan(3000);
});
