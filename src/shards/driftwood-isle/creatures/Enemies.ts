import * as THREE from 'three';
import { createCreatureSpawner } from '@wildshard/game/plugin/brain';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { worldTime } from '@wildshard/engine/core/time';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { ParticlePool } from '@wildshard/engine/fx/ParticlePool';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import { terrainHeight as heightAt, terrainWaterLevel as waterLevel } from '@wildshard/engine/world/terrainHeight';
import { waveHeight } from '@wildshard/engine/world/waves';
import type { PalmSpec } from '../world/Palms';
import * as v from 'valibot';
import { EnemyPlacementsSchema, type EnemyPlacements } from '../runtime/sections';
import { readDriftwoodBlob } from '../runtime/boot/blobAssets';
import { TIER } from '@wildshard/engine/core/tier';
import { COCONUT_R, COCONUTS, CoconutVolley } from '../combat/strikes';
import { driftwoodLaunch } from '../runtime/boot/rows';
import { preloadSailorHead } from '../species/sailor';

/**
 * Enemies — Driftwood Isle's three enemy species placed into the island's spaces, plus the pieces their AIs need
 * that no animal owns: the palm perches, the coconut projectiles, the water-droplet splash and the Drowned Sailor's
 * cyan point light. The species themselves are registry entries (`../species/{crab,monkey,sailor}.ts`,
 * `rig: 'custom'` + their own `think`); the AnimalManager still owns them (hit tests, health bars, blood, onKill,
 * corpses), so the sword, Combat.ts and the minimap see them like any boar.
 *
 *   const enemies = new Enemies(animals, { scene, sky, palms, wreck, crabSites }).build();
 *   game.onUpdate((dt, t) => enemies.update(dt, t, player.position));
 *
 *   palms      the PalmSpec[] the island's Palms were built from (Palms.scatterIsland) — the crowns become monkey perches
 *              (`animals.habitat.perches` / `perchBases`), troops of 3–4 are spawned into the densest groves
 *   wreck      the Wreck (floorHeightAt) — the hold: the sailor rises through the broken midships deck beside the iron sword
 *   crabSites  tidepool spots ({x, z}[], e.g. Cove.crabSites) — a group of 3–5 crabs (one big) at each
 *
 * Damage to the player from every enemy attack (crab snap 10, coconut 8, monkey bite 6, cutlass 14) arrives through
 * the shared combat pipeline, with the same cover, death-cause and presentation tags as other creature hits.
 * Coconuts (PHYSICS P7): a 16-slot InstancedMesh of faceted brown spheres (one draw call), each a dynamic ball in the
 * physics world (src/engine/physics/bodies.ts) — thrown on a ballistic arc, it bounces, rolls down the beach and floats on the
 * swell. In flight it is DEBRIS (the world only) and a hit is the ball passing within 0.45 m of the player's feet→head
 * segment; once it lands it is an ITEM the player nudges. It goes after resting 4 s (or 16 s of bobbing). Splash: a pooled Points
 * burst (cyan-white droplets, gravity). The sailor's light: one PointLight at its skull while it is up, off at death.
 */

export interface EnemiesOpts {
  respawn: { readonly delay: number; readonly away: number };
  scene: THREE.Scene;
  scope?: Scope;
  sky: Sky;
  palms?: PalmSpec[];
  wreck?: { floorHeightAt: (x: number, z: number) => number | undefined } | null;
  crabSites?: { x: number; z: number }[];
  /** E308: where the lone practice crab lives — one small reef crab on the path at the pier's foot, the first enemy a new
   *  player meets; the admitted respawn delay and distance gate its return */
  practice?: { x: number; z: number };
}


const G = 9.81;
/** the sea surface a coconut floats on: the still level + the swell, where the ground is under water */
const seaSurface = (x: number, z: number): number | undefined => {
  const lvl = waterLevel();
  if (heightAt(x, z) >= lvl) return undefined;
  return lvl + waveHeight(x, z);
};
const DROPS = 240;

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();

export class Enemies {
  group = new THREE.Group();
  /** what was placed (for the dev harness / report) */
  placed = { crabs: 0, monkeys: 0, sailors: 0, troops: 0, crabGroups: 0 };
  private rng = new Rng(SEED ^ 0xe11e);
  private coconutMesh: THREE.InstancedMesh | null = null;
  private get coconuts(): THREE.InstancedMesh { if (this.coconutMesh === null) throw new Error('Enemies not built'); return this.coconutMesh; }
  /** the coconuts' bodies and rules (combat/coconuts.ts, shared with the renderer-free runtime); this draws them */
  private readonly volley = new CoconutVolley<Animal>({
    bodies: () => app.bodies, rng: this.rng, surface: seaSurface, owner: this,
    hit: (th, amount, moveId) => {
      if (app.player !== null) app.combat.hit({
        source: 'env', sourceTags: ['creature.monkey', 'feel.blow', 'cover.checked'], target: app.player,
        amount, moveId, point: th.position.clone(), dir: new THREE.Vector3(), cause: { kind: th.kind, label: th.label },
      });
    },
    sound: (name, at) => { this.animals.onSound?.(name, at); },
    splash: (at, strength) => { this.splash(at, strength); },
  }, driftwoodLaunch('coconut'));
  /** the splash droplets (E357 X5: on the one ParticlePool) */
  private dropPool: ParticlePool | null = null;
  private get drops(): ParticlePool { if (this.dropPool === null) throw new Error('Enemies not built'); return this.dropPool; }
  private dActive = 0;
  private sailors: { a: Animal; light: THREE.PointLight; dead: boolean; fade: number }[] = [];
  /** the practice crab now (E308; a new one after its admitted respawn delay), and s since it died */
  practiceCrab: Animal | null = null;
  private practiceDead = 0;
  private playerPos = new THREE.Vector3();

  private disposed = false;
  private readonly creatures: ReturnType<typeof createCreatureSpawner<Animal>>;
  constructor(private readonly animals: AnimalManager, private readonly opts: EnemiesOpts) {
    this.creatures = createCreatureSpawner(animals); this.group.name = 'enemies'; opts.scope?.onDispose(() => { this.dispose(); });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.volley.dispose();
    this.creatures.dispose(); this.group.removeFromParent();
    if (this.opts.scope === undefined) {
      this.coconutMesh?.geometry.dispose(); // the kit's shared still material stays with the kit
      this.dropPool?.points.geometry.dispose();
      const material = this.dropPool?.points.material; if (material instanceof THREE.PointsMaterial) { material.map?.dispose(); material.dispose(); }
    }
  }

  build(): this {
    if (this.disposed) throw new Error('Cannot build disposed enemies');
    const { opts, animals } = this;
    // ── the pieces the AIs read (AnimalManager.habitat) ──
    const W = animals.habitat;
    if (opts.palms?.length) {
      W.perches = []; W.perchBases = [];
      for (const p of opts.palms) {
        const base = heightAt(p.x, p.z) - 0.2;
        W.perches.push(new THREE.Vector3(p.x + Math.cos(p.leanDir) * p.lean * p.h, base + p.h + 0.5, p.z + Math.sin(p.leanDir) * p.lean * p.h));
        W.perchBases.push(new THREE.Vector3(p.x, base + 0.2, p.z));
      }
    }
    W.throwCoconut = (from, to, thrower) => { this.throwCoconut(from, to, thrower); };
    W.splash = (at, strength) => { this.splash(at, strength); };
    // ── coconuts: one InstancedMesh in the kit's still look, the husk's brown as its vertex paint ──
    {
      const g = new THREE.IcosahedronGeometry(COCONUT_R, 0), husk = new THREE.Color('#5a3d22').toArray(), n = g.getAttribute('position').count;
      g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from({ length: n * 3 }, (_, i) => husk[i % 3] ?? 0), 3));
      opts.scope?.own(g);
      this.coconutMesh = new THREE.InstancedMesh(g, lowPolyLookMaterial(opts.sky, 'still'), COCONUTS);
      opts.scope?.own(this.coconuts);
      this.coconuts.castShadow = true; this.coconuts.frustumCulled = false;
      for (let i = 0; i < COCONUTS; i++) this.coconuts.setMatrixAt(i, _m.makeScale(0, 0, 0));
      this.coconuts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(this.coconuts);
    }
    // ── droplets ──
    {
      const mat = new THREE.PointsMaterial({ color: new THREE.Color(0.75, 0.95, 1.0), size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false, map: dropTexture(), alphaTest: 0.3 });
      // PointsMaterial draws every slot: the free ones wait far below
      this.dropPool = new ParticlePool({ capacity: DROPS, material: mat, renderOrder: 5, attributes: {}, parkY: -1000 });
      opts.scope?.own(this.drops.points.geometry); opts.scope?.own(mat); if (mat.map !== null) opts.scope?.own(mat.map);
      this.group.add(this.drops.points);
    }
    // the baked bodies first (AnimalFactory builds each model once, at its first spawn; the adventure's install already
    // waited on the same ~45 KB file behind the loading screen), then the placements in their order
    void Promise.all([preloadSailorHead(), readDriftwoodBlob('sim/enemy-placement.json')]).then(([, bytes]) => {
      if (this.disposed) return null;
      this.placeAuthoredEnemies(v.parse(EnemyPlacementsSchema, JSON.parse(new TextDecoder().decode(bytes))));
      return null;
    });
    opts.scene.add(this.group);
    return this;
  }

  // ── placement ──────────────────────────────────────────────────────────────────────────

  private placeAuthoredEnemies(placement: EnemyPlacements): void {
    if (SEED !== placement.seed) throw new Error('Enemy placements require their authored seed');
    const rows = placement.page[TIER];
    this.rng.restore(rows.stream);
    this.creatures.place(rows.centres, rows.kinds, rows.enemies, (actor, row) => {
      if(row.practice===true){this.practiceCrab=actor;this.practiceDead=0;}
      if(row.kind==='crab')this.placed.crabs++;else this.placed.monkeys++;
    }, (kind, i) => { if(kind==='monkey')this.placed.troops++;else if(this.opts.practice===undefined||i!==(this.opts.crabSites?.length??0))this.placed.crabGroups++; });
    const sailor=rows.enemies.find(row=>row.kind==='sailor');if(sailor!==undefined)this.placeSailor(sailor, placement.hold);
  }

  /** the lone small crab on the path at the pier's foot (E308): a herd of one, so no big crab's death scatters it */
  private placePracticeCrab(): void {
    const at = this.opts.practice;
    if (at === undefined) return;
    const [a] = this.creatures.group('crab', at, [{ kind: 'crab', ...at, yaw: 0, variant: 'small' }]);
    if (a === undefined) throw new Error('Missing practice crab');
    this.practiceCrab = a; this.practiceDead = 0;
    this.placed.crabs++;
  }

  /** a dead practice crab returns after the admitted delay, while the player is far enough away: its shell fades, a new one is placed */
  private tickPractice(dt: number, playerPos: THREE.Vector3): void {
    const c = this.practiceCrab, at = this.opts.practice;
    if (c === null || at === undefined || c.alive) return;
    this.practiceDead += dt;
    if (this.practiceDead < this.opts.respawn.delay || Math.hypot(playerPos.x - at.x, playerPos.z - at.z) < this.opts.respawn.away) return;
    if (!c.hidden) { c.fadeOut(); return; } // a crab leaves no carcass of its own (no corpseFade): the old shell goes first
    this.placePracticeCrab();
  }

  private placeSailor(spot: EnemyPlacements['native']['enemies'][number], centre: EnemyPlacements['hold']): void {
    const wreck = this.opts.wreck;
    if (wreck === null || wreck === undefined) return;
    this.animals.habitat.hold = { x: centre.x, z: centre.z, r: 7.5, guardR: 8, floorAt: (x, z) => wreck.floorHeightAt(x, z) };
    const a = this.creatures.spawn('sailor', spot.x, spot.z, spot.yaw, 'sailor');
    a.herd = -1;
    const light = new THREE.PointLight(0x7fe8ff, 0, 7, 2);
    light.castShadow = false;
    this.group.add(light);
    this.sailors.push({ a, light, dead: false, fade: 0 });
    this.placed.sailors++;
  }

  // ── projectiles + fx ───────────────────────────────────────────────────────────────────

  /** lob a coconut from `from` to land on `to` in 0.8–1.5 s (the flight time grows with the range) */
  throwCoconut(from: THREE.Vector3, to: THREE.Vector3, thrower: Animal | null): void { this.volley.throw(from, to, thrower); }

  /** a burst of water droplets at `at` (strength 1 = the sailor surfacing) */
  splash(at: THREE.Vector3, strength = 1): void {
    const n = Math.round(60 * strength);
    const { pos, vel, life } = this.drops;
    for (let i = 0; i < n; i++) {
      const k = this.drops.claim();
      const ang = app.rng.stream('cosmetic').next() * Math.PI * 2, r = app.rng.stream('cosmetic').next() * 0.5;
      pos[k * 3] = at.x + Math.cos(ang) * r; pos[k * 3 + 1] = at.y + 0.2 + app.rng.stream('cosmetic').next() * 1.4 * strength; pos[k * 3 + 2] = at.z + Math.sin(ang) * r;
      const s = 0.6 + app.rng.stream('cosmetic').next() * 2.2;
      vel[k * 3] = Math.cos(ang) * s; vel[k * 3 + 1] = 1.2 + app.rng.stream('cosmetic').next() * 2.5; vel[k * 3 + 2] = Math.sin(ang) * s;
      life[k] = 0.5 + app.rng.stream('cosmetic').next() * 0.6;
    }
    this.dActive = Math.min(DROPS, this.dActive + n);
  }

  update(dt: number, t: number, playerPos: THREE.Vector3): void {
    this.playerPos.copy(playerPos);
    if (this.disposed) return;
    this.tickPractice(dt, playerPos);
    // ── coconuts: their bodies fly, bounce, roll and float in the physics world; the volley reads them, this draws them ──
    const drew = this.volley.update(dt, app.bodies?.alpha ?? 1, playerPos, (k, at, rot) => {
      if (at === null) this.coconuts.setMatrixAt(k, _m.makeScale(0, 0, 0));
      else this.coconuts.setMatrixAt(k, _m.compose(at, rot, _s.set(1, 1, 1)));
    });
    if (drew) this.coconuts.instanceMatrix.needsUpdate = true;
    // ── droplets ──
    if (this.dActive) {
      const rdt = worldTime.realDt || dt; // droplets keep falling through a hit-stop
      let alive = 0;
      const { life, pos, vel } = this.drops;
      for (let k = 0; k < DROPS; k++) {
        const l0 = life[k] ?? 0;
        if (l0 <= 0) continue;
        life[k] = l0 - rdt;
        if ((life[k] ?? 0) <= 0) { pos[k * 3 + 1] = -1000; continue; }
        alive++;
        const j = k * 3;
        vel[j + 1] = (vel[j + 1] ?? 0) - G * rdt;
        pos[j] = (pos[j] ?? 0) + (vel[j] ?? 0) * rdt; pos[j + 1] = (pos[j + 1] ?? 0) + (vel[j + 1] ?? 0) * rdt; pos[j + 2] = (pos[j + 2] ?? 0) + (vel[j + 2] ?? 0) * rdt;
      }
      this.dActive = alive;
      this.drops.posAttr.needsUpdate = true;
    }
    // ── the sailor's light: at the skull while it is up; a burst of droplets and lights-out when it dies ──
    for (const s of this.sailors) {
      const a = s.a;
      a.headWorld(_w);
      s.light.position.copy(_w).y += 0.1;
      if (!a.alive && !s.dead) { s.dead = true; s.fade = 1; this.splash(a.position, 1.4); }
      if (s.dead) { s.fade = Math.max(0, s.fade - dt * 1.6); s.light.intensity = 4.5 * s.fade; continue; } // stays in the scene at 0: hiding it changes the light count → every lit program recompiles (B7)
      const up = THREE.MathUtils.clamp(a.mem['rise'] ?? 0, 0, 1);
      const flick = 0.85 + 0.15 * Math.sin(t * 11 + Math.sin(t * 3.7) * 2);
      s.light.intensity = 4.5 * up * flick * (a.position.distanceToSquared(playerPos) < 60 * 60 ? 1 : 0);
      // streaming water while it rises
      if (a.mem['rising'] && app.rng.stream('cosmetic').next() < dt * 30) { _v.copy(a.position); _v.y += 0.5 + app.rng.stream('cosmetic').next() * 1.2 * up; this.splash(_v, 0.08); }
    }
  }
}

function dropTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d');
  if (g === null) throw new Error('Enemies: could not get a 2d canvas context');
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 15);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.6, 'rgba(255,255,255,0.85)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
