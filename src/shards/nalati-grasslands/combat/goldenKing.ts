import { weaponEffects } from '../boot/weaponEffects.generated';
import { weaponSpecimen } from '../weapons/loadout';
import { NALATI_STRIKES, sampleStrike, sampleArena } from './strikes';
import { canReach } from '@wildshard/engine/ai/reach';
import { app } from '@wildshard/engine/app/runtime';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import { listenPage } from '@wildshard/engine/input/dom';
import type { Player } from '@wildshard/engine/player/Player';
import type { BossBar } from '@wildshard/engine/ui/BossBar';
import { memorySaverOn } from '@wildshard/engine/render/memorySaver';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import type { WorldRegistry, ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { encounterHit } from './damage';
import * as THREE from 'three';
import type { Bow } from '@wildshard/game/weapons/Bow';
import { bossFight, type PhasedBossFight } from '@wildshard/game/plugin/bossPhase';
import { parseBossProfile } from '@wildshard/format/bossProfiles';
import type { KurganEntrance } from '../world/types';
import { GOLDEN_KING, bindGoldenKing, BALBAL as KURGAN_BALBAL } from '../species/rows';
import layout from '../data/kurganLayout.generated.json' with { type: 'json' };
import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import { installBossEncounter, type Boss, type BossPersistence } from '@wildshard/game/Boss';
import { GoldenBowPower } from '../runtime/weapons/GoldenBow';
import kingData from '../data/goldenKing.generated.json' with { type: 'json' };
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { fxMaterial, type FxMaterial } from '@wildshard/engine/fx/groundFx';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { HeightPatch } from '../runtime/heightPatch';
import { bakedActorGeometry } from '../world/places';
import { createClientScene } from '@wildshard/game/plugin/ui';
import type { BossViewBinding } from '@wildshard/sdk/phasedBoss';
import chamberView from '../data/kurganView.json' with { type: 'json' };


const { DUNGEON, CH, COFFIN, NICHES, STREAMS, PEDESTAL, CHECKPOINT, DROMOS_SPAWN, DROMOS_END } = layout;


/**
 * The Golden King fight (plan row B13; design docs/design/nalati/elites-and-bosses.md §2 "The Golden King fight, step by
 * step"; mockups art/nalati-grasslands/round-2/5-bosses/). Two pieces:
 *
 *   goldenKingFight — the admitted arena boss profile (`@wildshard/game/plugin/bossPhase`, SF82) on his row
 *     (data/goldenKing.generated.json) with the chamber's views (world/KurganDungeon.ts): the King's brain (`bindGoldenKing`,
 *     the species forwards its 10 Hz tick here), his damage rule, the three phases and what each does to the room:
 *       I   "The King's Court" (100 → 60 %): he duels you on the open floor — the akinakes combo (14 / 14 / 22; the blade
 *           glints before each cut, the third's wide arc is painted on the floor) and the SUNBURST (sword up, gold spirals
 *           in, a gold ring races out across the floor from his feet — jump it: 25). Gold scale takes half from arrows,
 *           the face full (×2.5 headshot); every sabre / spear hit knocks plaques loose, and after six his chest takes
 *           arrows in full.
 *       II  "The Kurgan Wakes" (60 → 30 %): he staggers back to his coffin and kneels behind a dome of gold light
 *           (shielded — the bar shimmers). Two balbals step out of the wall niches, two more if you are slow; the dome
 *           holds while any stands. Sand pours through the ceiling where a gold shimmer marks it a second before, and
 *           drifts build (walking in sand halves your speed; the fallen beams and the coffin plinth are the high
 *           ground). The last balbal falls → the dome breaks, he is stunned 4 s, then fights until he kneels again.
 *       III "The Gold Burns" (30 → 0 %): he tears off his cloak — faster, a fourth strike, a DOUBLE sunburst. The
 *           looter's-hole light becomes a burning beam sweeping the floor on a gold line (15 to you; lure him through it:
 *           50 to him). His headdress glows: 200 hp of headshots knock it off and drop him to one knee for 3 s.
 *     Victory: he crumbles into a heap of gold plaques, the sand drains, the pedestal's shaft lights the Golden Bow.
 *
 *   KurganBoss — the glue `src/shards/nalati-grasslands/index.ts` wires: builds the interior (KurganDungeon), the doors (walk into the POI
 *     agent's dark passage in the mound → fade → the dromos; walk back out of the dromos → the mound's flank), hides the
 *     outdoor world and calms the steppe's animals while you are inside, the Boss + BossBar, the Golden Bow reward (and
 *     re-applies it at boot once owned), the dev hooks (`?boss=golden-king` starts at the chamber door; `&bossPhase=2|3`
 *     at that checkpoint; `window.__boss`).
 */

/** NALATI-MERGE F9: the chamber floor is level, and it is not the terrain. Animal.sampleTerrain tilts a body to the slope
 *  heightAt reads under it, and under the dungeon (140 m up, over the kurgan field's mound) that slope is steep: the King
 *  stood pitched ~44° and rolled ~26° through the whole fight (procedural and model alike). levelGround keeps him (and
 *  the balbal adds) upright; `sampleTerrain` re-zeroes the tilt spawn() already sampled. */
function standOnFloor(a: Animal): void { a.levelGround = true; a.sampleTerrain(); }

/** The arena strikes the fight's hazards resolve by name. */
const KING_HAZARDS: Readonly<Record<string, StrikeSpec>> = { sunburst: NALATI_STRIKES.sunburst, sand: NALATI_STRIKES.sand, beam: NALATI_STRIKES.beam };

/** What the Golden King fight is lent by the glue: the player, the animals, an optional body spawner, the player's hurt and the feed. */
export interface FightHost {
  player: Player;
  animals: AnimalManager;
  spawnKing?: () => Animal | null;
  /** the player takes `dmg` from the King / a hazard (routed to the shared damage pipeline) */
  hurt: (dmg: number, throughWalls?: boolean) => void;
  feed: (text: string) => void;
}

/** The Golden King fight: the platform phased fight on his row, its `BossScript`, his body and the glue's park / dev hooks. */
export interface GoldenKingFight {
  readonly phased: PhasedBossFight<Animal>;
  readonly script: BossScript;
  readonly king: () => Animal | null;
  /** park / unpark every fight animal (the player left / came back): out of the lists the HUD and the minimap read */
  readonly setPresent: (on: boolean) => void;
  /** dev: kill him now (screenshots of the victory) */
  readonly devKill: () => void;
}

/** The Golden King's fight in the kurgan chamber: his row on the platform phased boss fight, the chamber as its arena and views. */
export function goldenKingFight(dungeon: KurganDungeon, host: FightHost): GoldenKingFight {
  const profile = parseBossProfile(kingData.profile);
  if (profile.pattern !== 'arena') throw new Error('The Golden King requires its declared arena pattern');
  /** out of the fight for good: hidden, out of the animals list (the minimap, the harvest prompt, the aim assist) */
  const retire = (a: Animal): void => {
    a.hidden = true; a.mesh.visible = false;
    a.position.y = -9999;
    const list = host.animals.animals, i = list.indexOf(a);
    if (i !== -1) list.splice(i, 1);
    a.mesh.removeFromParent();
  };
  const phased: PhasedBossFight<Animal> = bossFight<Animal>(profile, {
    arena: {
      floorAt: dungeon.floorHeightAt,
      pile: (x, z, r, dh, cap) => { dungeon.addSand(x, z, r, dh, cap); },
      clear: () => { dungeon.clearSand(); },
      drain: (dt, rate) => { dungeon.drainSand(dt, rate); },
      inArena: (p) => dungeon.inChamber(p) && p.z - DUNGEON.z < CH - 1.1,
      seal: (on) => { dungeon.setSealed(on); },
    },
    body: {
      spawn: (x, z) => {
        const k = host.spawnKing === undefined ? host.animals.spawn(GOLDEN_KING, x, z, 0, 'king') : host.spawnKing();
        if (k === null) return null;
        k.herd = -1;
        standOnFloor(k);
        return k;
      },
      retire,
      bind: (a, brain) => { bindGoldenKing(a, { think: brain.think, act: brain.act, damageMul: brain.damageMul }); },
      ready: (k, floorY) => { k.yOffset = floorY - k.position.y; k.mesh.visible = true; },
    },
    spawnAdd: (_i, x, z, yaw) => {
      const a = host.animals.spawn(KURGAN_BALBAL, x, z, yaw, 'warrior');
      a.herd = -1;
      standOnFloor(a);
      const m = a.mem;
      m['floorY'] = DUNGEON.y; m['emergeT'] = 1.9;
      m['minX'] = DUNGEON.x - CH + 0.9; m['maxX'] = DUNGEON.x + CH - 0.9; m['minZ'] = DUNGEON.z - CH + 0.9; m['maxZ'] = DUNGEON.z + CH - 0.9;
      a.yOffset = DUNGEON.y - a.position.y;
      return a;
    },
    player: { get position() { return host.player.position; }, dash: (x, z, seconds) => { host.player.dash(x, z, seconds); } },
    hurt: (damage, throughWalls) => { host.hurt(damage, throughWalls); },
    cut: (i, a, onHit) => {
      const spec = NALATI_STRIKES.cuts[i] ?? NALATI_STRIKES.cuts[0], pl = host.player.position;
      return spec !== undefined && sampleStrike(spec, a, pl, onHit, { reach: () => canReach(a, pl, app.physics) });
    },
    hazard: (strike, from, onHit, opts) => {
      const spec = KING_HAZARDS[strike];
      if (spec === undefined) throw new Error(`Golden King: no arena strike ${strike}`);
      sampleArena(spec, from, host.player.position, onHit, app.physics, opts);
    },
    rng: () => app.rng.stream('ai').next(),
    feed: (line) => { host.feed(line); },
    views: goldenKingViews(dungeon, () => phased.body(), kingData.tuning),
    rewardPoint: () => dungeon.world(PEDESTAL.x, PEDESTAL.h + 0.02, PEDESTAL.z),
    respawnPoint: () => ({ pos: dungeon.world(CHECKPOINT.x, 0, CHECKPOINT.z), yaw: CHECKPOINT.yaw }),
  });
  const king = (): Animal | null => phased.body();
  return {
    phased, script: phased.script, king,
    setPresent: (on) => {
      const list = host.animals.animals;
      const mine: Animal[] = [];
      const k = king();
      if (k) mine.push(k);
      for (const a of phased.adds()) mine.push(a);
      for (const a of mine) {
        const i = list.indexOf(a);
        if (on && i === -1 && !a.hidden) { list.push(a); host.animals.group.add(a.mesh); }
        if (!on && i !== -1) { list.splice(i, 1); a.mesh.removeFromParent(); }
      }
    },
    devKill: () => { phased.kill(); },
  };
}

// ─────────────────────────────── the glue ───────────────────────────────

/** scene-root objects that stay on inside: the sky (the looter's hole shows it) and effects near the player */
const KEEP = /sky|planet|cloud|kurgan|projectile|arrow|arc|pickup|streak|csm|light/i;
function isTiny(o: THREE.Object3D): boolean {
  // a group of a few nodes near the dungeon (weapon effects, pickups): leave it alone
  const dx = o.position.x - DUNGEON.x, dy = o.position.y - DUNGEON.y, dz = o.position.z - DUNGEON.z;
  return dx * dx + dy * dy + dz * dz < 40 * 40;
}


export interface KurganPlay {
  persistence?: BossPersistence;
  animals: AnimalManager;
  spawnKing?: () => Animal | null;
  setWeaponsEnabled: (on: boolean) => void;
  bow: Bow | null;
  upgradeBow: (power: GoldenBowPower) => void;
  refill: () => void;
  interactables: Interactable[];
  toast: (text: string) => void;
  feed: (text: string) => void;
  music?: (event: 'intro' | 'phase' | 'victory' | 'death' | 'pickup', intensity?: number) => void;
  pickupHum?: (inside: boolean) => void;
  params: URLSearchParams;
}

export interface KurganCtx { game: Game; sky: Sky; player: Player; entrance: KurganEntrance | null; registry: WorldRegistry }

/** The chamber the Golden King's views draw on: its lid, shafts, niches, rings, pours, beam, dome, painted arc and heap. */
export type KingChamber = Pick<KurganDungeon, 'setLid' | 'setShaft' | 'setNicheStatue' | 'showHeap' | 'sandAt' | 'rings' | 'streams' | 'beam' | 'dome' | 'arc'>;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _h = new THREE.Vector3();
function chamberMesh(value: unknown): value is THREE.Mesh { return value instanceof THREE.Mesh; }
const n = (value: number | undefined): number => value ?? 0;

/**
 * The Golden King fight's view bindings (SF27): every view the platform fight (data/goldenKing.generated.json) names, drawn on
 * the kurgan chamber's meshes in its local frame, and the King's gold glow on his body's materials. View only: nothing
 * here moves the fight.
 */
export function goldenKingViews(d: KingChamber, king: () => Animal | null, tuning: { readonly reach: number; readonly ringMax: number; readonly beamRadius: number }): BossViewBinding {
  d.dome.mesh.scale.setScalar(1.75);
  d.dome.mat.uniforms.uAlpha.value = 0.9;
  return {
    'arena.lid.open': (open) => { d.setLid(n(open)); },
    'arena.shaft': (i, strength) => { d.setShaft(n(i), n(strength)); },
    'arena.fx.hide': () => {
      for (const r of d.rings) r.mesh.visible = false;
      for (const s of d.streams) { s.mesh.visible = false; s.tell.visible = false; }
      d.beam.mesh.visible = false; d.beam.line.visible = false; d.dome.mesh.visible = false; d.arc.mesh.visible = false;
    },
    'arena.shield': (on) => { d.dome.mesh.visible = on === 1; },
    'arena.shield.at': (x, y, z) => { d.dome.mesh.position.set(n(x) - DUNGEON.x, n(y) - DUNGEON.y, n(z) - DUNGEON.z); },
    'adds.spot': (i, on) => { d.setNicheStatue(n(i), on === 1); },
    'boss.glow': (k) => {
      const body = king();
      if (!body) return;
      const mats = Array.isArray(body.mesh.material) ? body.mesh.material : [body.mesh.material];
      for (const m of mats) if (m instanceof THREE.MeshLambertMaterial) { m.emissive.setRGB(1.0, 0.62, 0.16); m.emissiveIntensity = n(k); }
    },
    'strike.arc': (x, floorY, z, yaw) => {
      const arc = d.arc;
      arc.mesh.visible = true;
      arc.mesh.position.set(n(x) - DUNGEON.x, n(floorY) - DUNGEON.y + 0.04, n(z) - DUNGEON.z);
      arc.mesh.rotation.y = n(yaw) - Math.PI / 2;
      arc.mesh.scale.setScalar(tuning.reach * 1.15);
    },
    'strike.arc.off': () => { d.arc.mesh.visible = false; },
    'hazard.ring': (i, cx, cz, r) => {
      const vis = d.rings[n(i)];
      if (!vis) return;
      vis.mesh.visible = true;
      vis.mesh.position.set(n(cx) - DUNGEON.x, 0.06, n(cz) - DUNGEON.z);
      vis.mesh.scale.setScalar(n(r));
      vis.mat.uniforms.uAlpha.value = 1.4 * (1 - THREE.MathUtils.smoothstep(n(r), tuning.ringMax * 0.7, tuning.ringMax));
    },
    'hazard.ring.off': (i) => { const vis = d.rings[n(i)]; if (vis) vis.mesh.visible = false; },
    'hazard.ring.tell': (x, floorS, z, charge) => {
      const ring = d.rings[1];
      if (!ring) return;
      ring.mesh.visible = true;
      ring.mesh.position.set(n(x) - DUNGEON.x, n(floorS) - DUNGEON.y + 0.05, n(z) - DUNGEON.z);
      ring.mesh.scale.setScalar(2.4 - 1.6 * n(charge));
      ring.mat.uniforms.uAlpha.value = 0.4 + 0.6 * n(charge);
    },
    'hazard.pour.off': (i) => { const vis = d.streams[n(i)]; if (vis) { vis.mesh.visible = false; vis.tell.visible = false; } },
    'hazard.pour.tell': (i, t) => {
      const vis = d.streams[n(i)];
      if (!vis) return;
      vis.tell.visible = true; vis.tellMat.uniforms.uAlpha.value = Math.min(1, n(t) * 2) * 0.9;
      vis.tell.position.y = d.sandAt(vis.x, vis.z) + 0.05;
    },
    'hazard.pour.fall': (i, k) => {
      const vis = d.streams[n(i)];
      if (!vis) return;
      vis.tell.visible = false;
      vis.mesh.visible = true;
      vis.mat.uniforms.uAlpha.value = n(k);
    },
    'hazard.sweep': (cx, cz, angle, dir, k) => {
      const b = d.beam, R = tuning.beamRadius, a = n(angle);
      const top = _w.set(COFFIN.x + 0.3, 6.2, COFFIN.z + 0.1);
      _v.set(n(cx), 0, n(cz));
      const len = _v.distanceTo(top);
      b.mesh.visible = true;
      b.mesh.position.copy(_v);
      b.mesh.scale.set(1, len, 1);
      b.mesh.quaternion.setFromUnitVectors(_h.set(0, 1, 0), top.sub(_v).normalize());
      b.mat.uniforms.uAlpha.value = 0.7 * n(k);
      b.line.visible = true;
      b.line.rotation.y = n(dir) > 0 ? a - Math.PI / 2 : a - Math.PI / 2 - Math.PI * 0.6;
      b.line.scale.set(R / 6, 1, R * 0.85 / 6);
      b.line.position.set(0, 0.05, -0.5);
      b.lineMat.uniforms.uAlpha.value = 0.55 * n(k);
    },
    'hazard.sweep.off': () => { d.beam.mesh.visible = false; d.beam.line.visible = false; },
    'victory.heap': (on, x, z) => {
      if (on !== 1) { d.showHeap(false); return; }
      d.showHeap(true, n(x) - DUNGEON.x, n(z) - DUNGEON.z);
    },
  };
}

// Baked fabric; the remaining attachments are driven by the live encounter.
const { STATIC_TRIANGLES, SAND_N, DW, DOOR_W, DOOR_H, FALLEN } = layout.FABRIC;
const SAND = new THREE.Color('#a88c62');

interface Stream { mesh: THREE.Mesh; mat: FxMaterial; tell: THREE.Mesh; tellMat: FxMaterial; x: number; z: number }
interface Ring { mesh: THREE.Mesh; mat: FxMaterial }

/** Baked tomb fabric with the live seal, sand and encounter-driven view attachments. */
export class KurganDungeon {
  group: THREE.Object3D = new THREE.Group();
  readonly colliders: Collider[] = [];
  /** true while the player is in the dromos or the chamber (the fight hides the outdoor world then) */
  inside = false;
  /** walkable heights: the floor (+ the sand drifts), the coffin plinth, the fallen beams, the pedestal step */
  readonly floorHeightAt = (x: number, z: number): number | undefined => this.floorAt(x, z);

  readonly niches = NICHES;
  readonly streams: Stream[] = [];
  readonly rings: Ring[] = [];
  declare beam: { mesh: THREE.Mesh; mat: FxMaterial; line: THREE.Mesh; lineMat: FxMaterial };
  declare dome: { mesh: THREE.Mesh; mat: FxMaterial };
  declare arc: { mesh: THREE.Mesh; mat: FxMaterial };
  private shafts: { mesh: THREE.Mesh; mat: FxMaterial; base: number; target: number }[] = [];
  declare private flames: FxMaterial;
  declare private curtain: { mesh: THREE.Mesh; mat: FxMaterial; k: number; target: number };
  private sealCollider: Collider;
  declare private lid: THREE.Mesh;
  private statues: THREE.Mesh[] = [];
  declare private heap: THREE.Mesh;
  private fx: FxMaterial[] = [];
  // the sand drifts: a heightfield over the chamber floor (SAND_N × SAND_N cells), drawn as one displaced grid
  private sandH = new Float32Array(SAND_N * SAND_N);
  declare private sandMesh: THREE.Mesh;
  private sandLight = new Float32Array((SAND_N + 1) * (SAND_N + 1) * 3);
  private sandDirty = false;
  /** the drifts' collision (P1): rebuilt with the drawn grid */
  private sandPatch: HeightPatch | null = null;
  private sandAcc = 0;
  private staticMaterial: THREE.MeshBasicMaterial | null = null;
  private staticBuilt = false;

  constructor() {
    this.group.name = 'kurgan-dungeon';
    this.group.visible = false;
    this.group.position.set(DUNGEON.x, DUNGEON.y, DUNGEON.z);
    this.sealCollider = { x: DUNGEON.x, z: DUNGEON.z + CH + 0.1, hw: DOOR_W + 0.3, hd: 0.25, rot: 0, yTop: DUNGEON.y - 50, yBottom: DUNGEON.y - 51 };
  }

  // ── frames ──
  local(p: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 { return out.set(p.x - DUNGEON.x, p.y - DUNGEON.y, p.z - DUNGEON.z); }
  world(lx: number, ly: number, lz: number, out = new THREE.Vector3()): THREE.Vector3 { return out.set(DUNGEON.x + lx, DUNGEON.y + ly, DUNGEON.z + lz); }
  inChamber(p: THREE.Vector3): boolean { const x = p.x - DUNGEON.x, z = p.z - DUNGEON.z, y = p.y - DUNGEON.y; return Math.abs(x) < CH && Math.abs(z) < CH && y > -3 && y < 8; }
  inDromos(p: THREE.Vector3): boolean { const x = p.x - DUNGEON.x, z = p.z - DUNGEON.z, y = p.y - DUNGEON.y; return Math.abs(x) < DW + 0.5 && z >= CH && z < DROMOS_END + 1 && y > -3 && y < 8; }
  inVolume(p: THREE.Vector3): boolean { return this.inChamber(p) || this.inDromos(p); }

  build(lazyStatic = false): this {
    const steps = this.buildSteps(lazyStatic);
    while (steps.next().done !== true) { /* every part now */ }
    return this;
  }

  /** Restore baked attachments a piece per task, retaining the original child order. */
  async buildSliced(lazyStatic: boolean, yieldTask: () => Promise<void>): Promise<this> {
    const steps = this.buildSteps(lazyStatic);
    while (steps.next().done !== true) await yieldTask();
    return this;
  }

  private *buildSteps(lazyStatic: boolean): Generator<void, void> {
    const t0 = diagnosticNow();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
    this.staticMaterial = mat;
    const materials = new Map<string, THREE.Material>([['fabric', mat]]);
    for (const row of chamberView.fx) {
      const mode = row.mode;
      if (mode !== 0 && mode !== 1 && mode !== 2 && mode !== 3 && mode !== 4 && mode !== 5 && mode !== 6 && mode !== 7) throw new Error('Invalid chamber effect');
      const material = fxMaterial(mode, new THREE.Color().fromArray(row.color), row.alpha, row.additive);
      material.depthTest = row.depthTest; material.uniforms.uP.value.fromArray(row.p);
      materials.set(row.id, material); this.fx.push(material);
    }
    const recipe = chamberView.scene;
    const geometry = new Map(recipe.nodes.flatMap(row => 'geometry' in row ? [[row.geometry, bakedActorGeometry(row.geometry)]] as const : []));
    const scene = createClientScene(recipe, { geometry, materials });
    this.group = scene.root;
    const effect = (id: string): Ring => {
      const part: unknown = scene.parts.get(id), material = materials.get(id);
      if (!chamberMesh(part) || !(material instanceof THREE.ShaderMaterial) || !this.fx.includes(material as FxMaterial)) throw new Error('Missing chamber effect');
      return { mesh: part, mat: material as FxMaterial };
    };
    const mesh = (id: string): THREE.Mesh => { const part: unknown = scene.parts.get(id); if (!chamberMesh(part)) throw new Error('Missing chamber part'); return part; };
    this.lid = mesh('lid'); this.heap = mesh('heap'); this.sandMesh = mesh('sand');
    this.statues = NICHES.map((_, i) => mesh(`statue:${i}`));
    const sand = this.sandMesh.geometry;
    this.sandLight = Float32Array.from(sand.getAttribute('light').array); sand.deleteAttribute('light');
    const position = sand.getAttribute('position'); if (position instanceof THREE.BufferAttribute) position.setUsage(THREE.DynamicDrawUsage);
    this.shafts = [0.38, 0].map((base, i) => Object.assign(effect(`shaft:${i}`), { base, target: base }));
    this.flames = effect('flames').mat;
    this.rings.push(effect('ring:0'), effect('ring:1'));
    this.streams.push(...STREAMS.map((spot, i) => { const stream = effect(`stream:${i}`), tell = effect(`tell:${i}`); return Object.assign(stream, { tell: tell.mesh, tellMat: tell.mat, x: spot.x, z: spot.z }); }));
    const beam = effect('beam'), line = effect('line'); this.beam = { ...beam, line: line.mesh, lineMat: line.mat };
    this.dome = effect('dome'); this.arc = effect('arc'); this.curtain = { ...effect('seal'), k: 0, target: 0 };
    this.colliders.push(...structuredClone(layout.COLLISION.boxes), this.sealCollider);
    if (!lazyStatic) this.buildStatic();
    this.tris = STATIC_TRIANGLES; this.buildMs = Math.round(diagnosticNow() - t0);
    yield;
  }

  private buildStatic(): void {
    if (this.staticBuilt) return;
    if (this.staticMaterial === null) throw new Error('The dungeon must build before entry');
    const scene = createClientScene(chamberView.static, { geometry: new Map([['dungeon:interior', bakedActorGeometry('dungeon:interior')]]), materials: new Map([['fabric', this.staticMaterial]]) });
    this.group.add(scene.root);
    this.group.children.pop(); this.group.children.unshift(scene.root);
    this.staticBuilt = true;
  }

  async buildStaticSliced(yieldTask: () => Promise<void>): Promise<void> { this.buildStatic(); await yieldTask(); }
  buildMs = 0; tris = 0;

  /**
   * NALATI-MERGE P1: the interior into the world registry — the walls, ceiling and floor slabs as boxes (larch; the
   * pedestal stone, the braziers metal), the coffin plinth + a step onto it and the pedestal's step as slabs, the fallen
   * beams as capsules; the seal as a piece that follows the (still) interior group and collides only while sealed; the
   * sand drifts as a heightfield rebuilt with the drawn grid. `floorHeightAt` stays for placement.
   */
  register(registry: WorldRegistry): void {
    const Y0 = DUNGEON.y;
    // JSON has one zero; the original box conversion negates its zero yaw.
    const descs = structuredClone(layout.COLLISION.descs) as ColliderDesc[];
    for (const desc of descs) if (desc.kind === 'box' && desc.yaw === 0) desc.yaw = -0;
    registry.add({ id: 'nalati-kurgan-dungeon', name: 'The Golden King\'s tomb', category: 'buildings', file: 'src/shards/nalati-grasslands/combat/goldenKing.ts', surface: 'wood', colliders: descs, floor: this.floorHeightAt, solidFloor: true });
    // the seal: its box in the interior group's frame (the group stands at DUNGEON, never moves)
    registry.add({
      id: 'nalati-kurgan-seal', name: 'The sand seal', category: 'buildings', file: 'src/shards/nalati-grasslands/combat/goldenKing.ts', surface: 'sand', follows: this.group,
      colliders: [{ kind: 'box', x: 0, y: DOOR_H / 2, z: CH + 0.1, hx: DOOR_W + 0.3, hy: DOOR_H / 2 + 1, hz: 0.25 }], active: () => this.sealed,
    });
    const ph = app.physics;
    if (ph) this.sandPatch = new HeightPatch(ph, { x: DUNGEON.x, y: Y0, z: DUNGEON.z, size: CH * 2, res: SAND_N + 1, material: 'sand', owner: this });
  }

  // ── walkable heights ──
  private floorAt(x: number, z: number): number | undefined {
    const lx = x - DUNGEON.x, lz = z - DUNGEON.z;
    const inCh = Math.abs(lx) <= CH + 1.4 && Math.abs(lz) <= CH, inDr = Math.abs(lx) <= DW + 0.2 && lz >= CH - 0.1 && lz <= DROMOS_END + 0.6;
    if (!inCh && !inDr) return undefined;
    let y = 0;
    if (inCh) {
      y = this.sandAt(lx, lz);
      // the coffin plinth
      if (Math.abs(lx - COFFIN.x) < COFFIN.wid / 2 + 0.65 && Math.abs(lz - COFFIN.z) < COFFIN.len / 2 + 0.6) y = Math.max(y, COFFIN.plinthH);
      // the pedestal's step
      if (Math.abs(lx - PEDESTAL.x) < 0.8 && Math.abs(lz - PEDESTAL.z) < 0.7) y = Math.max(y, 0.18);
      // the fallen beams (their round tops)
      for (const f of FALLEN) {
        const ax = f.a.x, az = f.a.z, bx = f.b.x, bz = f.b.z;
        const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
        const u = Math.max(0, Math.min(1, ((lx - ax) * dx + (lz - az) * dz) / L2));
        const d = Math.hypot(lx - (ax + dx * u), lz - (az + dz * u));
        if (d < f.r) y = Math.max(y, f.r + Math.sqrt(f.r * f.r - d * d) - 0.02);
      }
    }
    return DUNGEON.y + y;
  }

  /** sand depth (m) at a chamber-local point */
  sandAt(lx: number, lz: number): number {
    const fx = (lx + CH) / (CH * 2) * SAND_N - 0.5, fz = (lz + CH) / (CH * 2) * SAND_N - 0.5;
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const h = (i: number, j: number) => (i < 0 || j < 0 || i >= SAND_N || j >= SAND_N ? 0 : this.sandH[j * SAND_N + i] ?? 0);
    return (h(ix, iz) * (1 - tx) + h(ix + 1, iz) * tx) * (1 - tz) + (h(ix, iz + 1) * (1 - tx) + h(ix + 1, iz + 1) * tx) * tz;
  }
  /** pile sand: a soft mound of radius r (m) rising by dh (m) at its centre, capped at `max` */
  addSand(lx: number, lz: number, r: number, dh: number, max = 1.0): void {
    const cell = (CH * 2) / SAND_N;
    const i0 = Math.max(0, Math.floor((lx - r + CH) / cell)), i1 = Math.min(SAND_N - 1, Math.ceil((lx + r + CH) / cell));
    const j0 = Math.max(0, Math.floor((lz - r + CH) / cell)), j1 = Math.min(SAND_N - 1, Math.ceil((lz + r + CH) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = -CH + (i + 0.5) * cell, cz = -CH + (j + 0.5) * cell, d = Math.hypot(cx - lx, cz - lz) / r;
      if (d >= 1) continue;
      const k = j * SAND_N + i;
      this.sandH[k] = Math.min(max, (this.sandH[k] ?? 0) + dh * (1 - d * d) * (1 - d * d));
    }
    this.sandDirty = true;
  }
  clearSand(): void { this.sandH.fill(0); this.sandDirty = true; }
  /** the drifts drain away (the victory): `rate` m/s */
  drainSand(dt: number, rate = 0.25): void {
    let any = false;
    for (let k = 0; k < this.sandH.length; k++) { const h = this.sandH[k] ?? 0; if (h > 0) { this.sandH[k] = Math.max(0, h - rate * dt); any = true; } }
    if (any) this.sandDirty = true;
  }

  private writeSand(): void {
    const g = this.sandMesh.geometry, pos = g.getAttribute('position'), col = g.getAttribute('color');
    const N1 = SAND_N + 1;
    const grid = this.sandPatch ? new Float32Array(N1 * N1) : null;
    let any = false;
    for (let j = 0; j < N1; j++) for (let i = 0; i < N1; i++) {
      const v = j * N1 + i;
      // vertex height = the mean of the (up to) four cells round it
      let s = 0, c = 0;
      for (const [di, dj] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) { const ci = i + di, cj = j + dj; if (ci >= 0 && cj >= 0 && ci < SAND_N && cj < SAND_N) { s += this.sandH[cj * SAND_N + ci] ?? 0; c++; } }
      const h = c > 0 ? s / c : 0;
      if (h > 0.01) any = true;
      if (grid) grid[v] = h;
      pos.setY(v, h > 0.01 ? h : -0.05);
      const k = 0.85 + 0.25 * Math.min(1, h / 0.6);
      col.setXYZ(v, SAND.r * k * (this.sandLight[v * 3] ?? 1), SAND.g * k * (this.sandLight[v * 3 + 1] ?? 1), SAND.b * k * (this.sandLight[v * 3 + 2] ?? 1));
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    this.sandMesh.visible = any;
    if (grid) this.sandPatch?.set(grid);   // P1: the drifts are walkable as real geometry (row j = z, column i = x)
  }

  // ── state the fight drives ──
  setSealed(on: boolean): void {
    this.curtain.target = on ? 1 : 0;
    this.sealCollider.yBottom = on ? DUNGEON.y - 1 : DUNGEON.y - 51;
    this.sealCollider.yTop = on ? DUNGEON.y + DOOR_H + 1 : DUNGEON.y - 50;
  }
  get sealed(): boolean { return this.curtain.target > 0.5; }
  /** the coffin lid: 0 closed … 1 slid off and leaning on the coffin's side */
  setLid(open: number): void {
    const k = THREE.MathUtils.clamp(open, 0, 1);
    const slide = THREE.MathUtils.smoothstep(k, 0, 0.7), tip = THREE.MathUtils.smoothstep(k, 0.55, 1);
    this.lid.position.set(COFFIN.x + slide * (COFFIN.wid * 0.85), COFFIN.plinthH + COFFIN.h + 0.09 - tip * 0.75, COFFIN.z + slide * 0.2);
    this.lid.rotation.set(0, 0.06 * slide, -tip * 1.15);
  }
  setNicheStatue(i: number, on: boolean): void { const s = this.statues[i]; if (s) s.visible = on; }
  /** 0 = the looter's-hole shaft, 1 = the pedestal shaft; strength 0..1.5 (eased) */
  setShaft(i: number, strength: number): void { const s = this.shafts[i]; if (s) s.target = strength; }
  showHeap(on: boolean, lx = COFFIN.x + 1.8, lz = COFFIN.z + 2.6): void { this.heap.visible = on; this.heap.position.set(lx, this.sandAt(lx, lz), lz); }
  /** show / hide the whole interior (it lives in the sky — see the header) */
  setVisible(on: boolean): void {
    if (on && !this.staticBuilt) this.buildStatic();
    this.group.visible = on;
  }

  update(dt: number, t: number): void {
    if (!this.group.visible) return;
    for (const m of this.fx) m.uniforms.uTime.value = t;
    for (const s of this.shafts) {
      const a = s.mat.uniforms.uAlpha;
      a.value += (s.target - a.value) * Math.min(1, dt * 1.5);
      s.mesh.visible = a.value > 0.01;
    }
    const c = this.curtain;
    c.k += (c.target - c.k) * Math.min(1, dt * (c.target > c.k ? 3 : 1.2));
    c.mat.uniforms.uAlpha.value = c.k;
    c.mesh.visible = c.k > 0.02;
    this.flames.uniforms.uAlpha.value = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
    this.sandAcc += dt;
    if (this.sandDirty && this.sandAcc > 1 / 15) { this.sandAcc = 0; this.sandDirty = false; this.writeSand(); }
  }
}

export class KurganBoss {
  readonly dungeon = new KurganDungeon();
  readonly spareLight = new THREE.PointLight(0xffc860, 0, 1, 2);
  ui: BossBar | null = null;
  fight: GoldenKingFight | null = null;
  boss: Boss | null = null;
  golden: GoldenBowPower | null = null;
  /** the player is inside (the dromos or the chamber) */
  inside = false;
  private play: KurganPlay | null = null;
  private hidden: THREE.Object3D[] = [];
  private fadeT = -1;
  private calmWas = false;
  private locked = false; private slow = false;
  private skipKeys = false; private skipTouch = false;

  constructor(private readonly ctx: KurganCtx) {}

  /** Boot collision, movables and light; Memory saver delays only the hidden static dressing until entry. */
  build(): this {
    this.dungeon.build(memorySaverOn());
    return this.attach();
  }

  /** `build`, the hidden static interior a few tasks later (SF67); the same dungeon */
  async buildSliced(yieldTask: () => Promise<void>): Promise<this> {
    const lazy = memorySaverOn();
    await this.dungeon.buildSliced(true, yieldTask); // its movables a piece a task, then the sand, FX and colliders
    await yieldTask();
    this.attach();
    if (!lazy) { await yieldTask(); await this.dungeon.buildStaticSliced(yieldTask); }
    return this;
  }

  private attach(): this {
    this.ctx.game.scene.add(this.dungeon.group);
    this.dungeon.register(this.ctx.registry);   // NALATI-MERGE P1: the interior's collision, the seal, the sand drifts
    this.spareLight.position.set(DUNGEON.x, DUNGEON.y - 30, DUNGEON.z);
    this.ctx.game.scene.add(this.spareLight);
    return this;
  }

  /** once the animals, weapons and HUD exist (main.ts → nalati.bindPlay) */
  bind(play: KurganPlay): void {
    this.play = play;
    const { game, sky, player } = this.ctx;
    // build the adds' model now, not mid-fight (a prewarm: a broken add rig must not take the whole boot down)
    try { play.animals.factory.model(KURGAN_BALBAL, 'warrior'); } catch (e) { console.warn('[kurgan] the balbal adds did not build', e); }
    this.golden = new GoldenBowPower({ multipliers: weaponEffects.multipliers, scene: game.scene, sky, camera: game.camera, raycast: (o, d, max) => play.animals.raycast(o, d, max) });
    const encounter = installBossEncounter({ definition: kingData.encounter, reward: kingData.reward }, () => {
      this.fight = goldenKingFight(this.dungeon, {
        player, animals: play.animals,
        ...(play.spawnKing === undefined ? {} : { spawnKing: play.spawnKing }),
        hurt: (dmg, throughWalls) => { const k = this.fight?.king() ?? null; if (k) encounterHit(k, dmg, 'boss.golden-king', player.position, throughWalls); },
        feed: play.feed,
      });
      return this.fight.script;
    }, {
      game, player, spareLight: this.spareLight, scope: game.levelScope, chunkId: 'nalati-grasslands', interactables: play.interactables,
      reward: {
        model: () => weaponSpecimen('goldenBow', sky),
        grant: () => { if (play.bow && this.golden) { play.upgradeBow(this.golden); } },
      },
      lockInput: (on) => { this.locked = on; play.setWeaponsEnabled(!on); this.applyMove(); },
      respawn: (pos, yaw) => { player.position.copy(pos); player.velocity.set(0, 0, 0); player.yaw = yaw; player.pitch = 0; play.refill(); },
      skipHeld: () => this.skipKeys || this.skipTouch || app.input.held('jump') || app.input.held('use'),
      toast: play.toast, feed: play.feed,
      ...(play.persistence === undefined ? {} : { persistence: play.persistence }),
      ...(play.music ? { music: play.music } : {}),
      ...(play.pickupHum ? { pickupHum: play.pickupHum } : {}),
    });
    this.ui = encounter.ui; this.boss = encounter.boss;
    // the King starts outside every list until you walk in; the reward, once won, is yours at every boot
    encounter.fight.reset(0);
    this.fight?.setPresent(false);
    if (this.boss.rewardTaken && play.bow) { play.upgradeBow(this.golden); }
    listenPage(game.levelScope, 'keydown', event => { if (event instanceof KeyboardEvent && event.code === 'Enter') this.skipKeys = true; });
    listenPage(game.levelScope, 'keyup', event => { if (event instanceof KeyboardEvent && event.code === 'Enter') this.skipKeys = false; });
    listenPage(game.levelScope, 'pointerdown', () => { this.skipTouch = true; });
    listenPage(game.levelScope, 'pointerup', () => { this.skipTouch = false; });
    listenPage(game.levelScope, 'pointercancel', () => { this.skipTouch = false; });
    game.app.addSystem({ id: 'shard.nalati-grasslands.bind', phase: 'update', after: ['hud.combat'], before: ['first hints', 'main.frame'], run: (dt) => this.golden?.update(dt) }, game.levelScope);
    // dev: `?boss=golden-king` — start at the chamber door; `&bossPhase=2|3` at that checkpoint
    if (play.params.get('boss') === 'golden-king') {
      const ph = Number(play.params.get('bossPhase') ?? '1');
      this.enter(true, 13.2);
      if (ph > 1) this.boss.devStartAt(ph - 1);
    }
    this.ctx.game.levelScope.onDispose(app.debug.scopedExpose('nalati.boss', this));
  }

  /** a death: in the fight → back at the checkpoint (true); else not ours */
  onPlayerDeath(): boolean { return this.boss?.onPlayerDeath() ?? false; }

  private applyMove(): void {
    const want = this.locked ? 0 : this.slow ? 0.5 : 1;
    if (this.ctx.player.moveScale !== want) this.ctx.player.moveScale = want;
  }

  /** into the dromos (from the mound's door, or `?boss=`) */
  private enter(immediate = false, atZ = DROMOS_SPAWN.z): void {
    const { player, game } = this.ctx;
    const play = this.play;
    if (!play || !this.boss || !this.fight) return;
    const go = () => {
      this.dungeon.world(DROMOS_SPAWN.x, 0, atZ, player.position);
      player.velocity.set(0, 0, 0); player.yaw = DROMOS_SPAWN.yaw; player.pitch = 0;
      this.inside = true; this.dungeon.inside = true;
      this.dungeon.setVisible(true);
      // the outdoor world goes dark (sealed interior: nothing out there can be seen) — everything at the scene root
      // but the interior, the animals, the camera (the viewmodel), the lights and the sky
      this.hidden = [];
      for (const o of game.scene.children) {
        if (!o.visible || o === this.dungeon.group || o === play.animals.group || o === game.camera || o instanceof THREE.Light || KEEP.test(o.name) || o.type === 'Points' || isTiny(o)) continue;
        o.visible = false; this.hidden.push(o);
      }
      this.calmWas = play.animals.calm; play.animals.calm = true;
      this.fight?.setPresent(true);
      this.boss?.arm();
    };
    if (immediate) { go(); return; }
    this.ui?.fade(true, 220); this.fadeT = 0.24;
    this.pending = go;
  }
  private pending: (() => void) | null = null;

  /** back out onto the mound's flank */
  private exit(teleport: boolean): void {
    const { player } = this.ctx;
    const play = this.play;
    const go = () => {
      if (teleport) {
        const e = this.ctx.entrance;
        if (e) {
          const fx = -Math.sin(e.facing), fz = -Math.cos(e.facing);
          player.position.set(e.x + fx * 2.4, e.y, e.z + fz * 2.4);
          player.yaw = e.facing; player.pitch = 0; player.velocity.set(0, 0, 0);
        }
      }
      this.inside = false; this.dungeon.inside = false;
      this.dungeon.setVisible(false);
      for (const o of this.hidden) o.visible = true;
      this.hidden = [];
      if (play) play.animals.calm = this.calmWas;
      this.boss?.disarm();
      this.fight?.setPresent(false);
      this.slow = false; this.locked = false; this.applyMove();
    };
    if (!teleport) { go(); return; }
    this.ui?.fade(true, 220); this.fadeT = 0.24;
    this.pending = go;
  }

  update(dt: number, t: number): void {
    const p = this.ctx.player.position;
    // the door fades: black → move → back
    if (this.fadeT >= 0) {
      this.fadeT -= dt;
      if (this.fadeT < 0) { const go = this.pending; this.pending = null; go?.(); this.ui?.fade(false, 420); }
      return;
    }
    if (!this.inside) {
      const e = this.ctx.entrance;
      if (e && this.boss) {
        const fx = -Math.sin(e.facing), fz = -Math.cos(e.facing);
        const dx = p.x - e.x, dz = p.z - e.z, lz = -(dx * fx + dz * fz), lx = dx * fz - dz * fx;
        if (lz > 0.8 && lz < 3 && Math.abs(lx) < 1.3 && Math.abs(p.y - e.y) < 1.5) this.enter();
      }
      return;
    }
    // inside
    if (!this.dungeon.inVolume(p)) { this.exit(false); return; }         // respawned elsewhere (a death outside the fight)
    const lz = p.z - DUNGEON.z;
    if (lz > DROMOS_END - 0.7 && this.boss?.engaged !== true) { this.exit(true); return; }
    // never below the dungeon floor: a drift that rises > 0.5 m under you in one step (a shove into a mound) is a platform
    // the Player refuses, and the terrain is 100 m down — lift the feet back onto the floor the same frame
    const fl = this.dungeon.floorHeightAt(p.x, p.z);
    if (fl !== undefined && p.y < fl - 0.02 && p.y > fl - 4) { p.y = fl; if (this.ctx.player.velocity.y < 0) this.ctx.player.velocity.y = 0; }
    // sand drifts slow you (the plinth, the beams and the pedestal step are the high ground)
    const lx = p.x - DUNGEON.x;
    const sand = this.dungeon.inChamber(p) ? this.dungeon.sandAt(lx, lz) : 0;
    const floor = this.dungeon.floorHeightAt(p.x, p.z) ?? DUNGEON.y;
    const onSand = sand > 0.12 && Math.abs(floor - (DUNGEON.y + sand)) < 0.05;
    if (onSand !== this.slow) { this.slow = onSand; this.applyMove(); }
    this.boss?.update(dt, t);
    this.dungeon.update(dt, t);
  }
}

/** the wiring's one call (src/shards/nalati-grasslands/index.ts): the interior built at boot, the fight bound later by main.ts */
export function wireKurgan(ctx: KurganCtx): KurganBoss { return new KurganBoss(ctx).build(); }
/** `wireKurgan`, its hidden static interior built a task apart per part (SF67: the load's long task) */
export function wireKurganSliced(ctx: KurganCtx, yieldTask: () => Promise<void>): Promise<KurganBoss> { return new KurganBoss(ctx).buildSliced(yieldTask); }
