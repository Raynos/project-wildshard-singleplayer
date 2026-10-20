import { GroupBrain } from '@wildshard/engine/ai/GroupBrain';
import { pinBrain } from '@wildshard/engine/ai/inspect';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import type { TargetAnimal, TargetHit } from '@wildshard/engine/combat/types';
import { Projectiles, type ProjectileKind } from '@wildshard/engine/combat/view/projectile';
import type { Game } from '@wildshard/engine/core/Game';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { terrainHeight as heightAt } from '@wildshard/engine/world/terrainHeight';
import * as THREE from 'three';

import { EncounterPatrol, EncounterSchedule, type PatrolMember, type PatrolActorBinding } from '@wildshard/game/boss/encounterPatrol';
import { ReturnProgram } from '@wildshard/game/population/returnProgram';
import type { NightRows } from './nightTypes';
import { GHOST_RIDER, riderGeometry, ghostSeat, ghostRiderPoints } from '../species/ghostRider';

import type { CueDirector } from '@wildshard/game/audio/cueDirector';

/**
 * Ghost riders — the night half of row B11 (project/archive/2026-09-23-nalati.md; elites-and-bosses.md E5; mockups
 * art/nalati-grasslands/round-1/3-enemies/enemy-6-ghost-riders.jpg, round-2/4-named-elites/elite-5-qara-batyr-night-rider.jpg).
 *
 * At night a line of three spectral horse archers — cyan smoke and glass — rides the ridge lines of the Sky Grassland
 * (a loop along the escarpment rim and round the plateau). Come within ~70 m and the line wheels onto you: it circles at
 * a gallop, 34 m out, and each rider looses a glowing cyan arrow every few seconds — a slow, bright streak you can see
 * coming and step out of (10 a hit). Shoot them out of the saddle (70 hp: two good arrows; the rider's torso and hood
 * are targets as well as the horse) or ride them down (B7: `trample`). A dead rider tears apart into mist. Kill the line
 * and another forms a minute later; at dawn the rest dissolve.
 *
 *   const gr = new GhostRiders({ game, sky, player, forest, clock: weather.clock });
 *   gr.attach(animals)                     // once main's AnimalManager exists; a line forms at once if it is night
 *   gr.update(dt, t)                       // every frame
 *   gr.riderTarget(o, d, max, hit)         // chain into main's Targets.raycast (the rider above the horse's capsules)
 *
 * For B12 (Qara Batyr, the captain) — a clean spawn API:
 *   gr.spawnLine({ count, captain: true, at })  // a line; `captain` puts the captain rig (800 hp, the tug standard) at its head
 *   gr.spawnRider({ x, z, yaw, variant })       // one rider, any variant; it joins no line (drive it: `mem.tx / tz / v`)
 *   gr.hold = true                              // stop the automatic lines (the elite system is running the night)
 *   gr.killsTonight / gr.onRiderKilled(a, n)    // "once you have killed 5 ghost riders in a night" (the spawn rule)
 *   gr.dissolve(a)                              // tear one into mist now
 *   gr.arrows                                   // the enemy arrow pool (Projectiles with `hurtsPlayer`)
 * Hooks: `hurt(damage)` (set by the wiring: main's health / flash), `onRiderKilled`.
 *
 * Cost: a rider is one horse SkinnedMesh (the ghost material instead of the painterly one) + one rider mesh; the arrows
 * are one InstancedMesh, the mist one Points — the whole night ≈ 8 draw calls. The ghost material is a MeshLambert whose
 * output is replaced by a fresnel glow (additive, self-lit, no fog, no shadows): 2 programs (skinned / static).
 */

export interface GhostRidersCtx { game: Game; sky: Sky; player: Player; forest: Forest; clock: DayCycleClock; cues: CueDirector }
export type GhostVariant = 'rider' | 'captain';
interface Rider { a: Animal; scope: Scope; mats: GhostMat[]; law: PatrolMember }
interface GhostMat { mat: THREE.MeshLambertMaterial; fade: THREE.IUniform<number> }

const GHOST_TIME: THREE.IUniform<number> = { value: 0 };

// ───────────────────────────── the ghost material ─────────────────────────────

function ghostMaterial(nightRows: NightRows, look: GhostVariant | 'storm' = 'rider'): GhostMat {
  const style = nightRows.ghost[look], fade: THREE.IUniform<number> = { value: 0 };
  const mat = new THREE.MeshLambertMaterial({ color: 0x000000, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  patchShader(mat, 'nalati.ghost', PATCH_ORDER.decorate, sh => {
    sh.uniforms['uGFade'] = fade; sh.uniforms['uGTime'] = GHOST_TIME;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', style.common)
      .replace('#include <dithering_fragment>', style.fragment);
  }, { key: style.key });
  mat.name = 'nalati-ghost';
  return { mat, fade };
}

/** the ghost arrow: a slim shaft, a bright leaf head, a long fading streak behind (tip at the origin, shaft along +z) */
function ghostArrowKind(nightRows: NightRows): ProjectileKind {
  return { ...nightRows.arrow, geometry: new THREE.BufferGeometryLoader().parse(nightRows.geometry),
    material: new THREE.MeshBasicMaterial({ color: new THREE.Color(.7, 2.6, 3), vertexColors: true,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false }) };
}

// ───────────────────────────── the path ─────────────────────────────

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Vector3(), _h = new THREE.Vector3(), _d = new THREE.Vector3(), _pv = new THREE.Vector3();
const _ray = new THREE.Ray(), _sph = new THREE.Sphere();

const UP = new THREE.Vector3(0, 1, 0);

export class GhostRiders extends GroupBrain<Animal> {
  readonly riders: Rider[] = [];
  private readonly patrol: EncounterPatrol<Animal>;
  readonly arrows: Projectiles;
  /** B12: true = no automatic lines (the elite system drives the night) */
  hold = false;
  /** dev: the riders stand still where they are (screenshots) */
  freeze = false;
  get killsTonight(): number { return this.patrol.kills; }
  onRiderKilled?: ((a: Animal, killsTonight: number) => void) | undefined;
  /** the player takes damage (set by the wiring: main's health, flash) */
  hurt?: ((damage: number, from: Animal | null) => void) | undefined;
  private readonly author: ReturnProgram;
  private readonly motion: EncounterSchedule;
  private readonly hitResult: TargetHit;
  private shooter: Animal | null = null;

  constructor(private readonly ctx: GhostRidersCtx, private readonly nightRows: NightRows) {
    super([]);
    this.author = ReturnProgram.page(nightRows.program, ctx.game.levelScope);
    this.patrol = new EncounterPatrol<Animal>(nightRows.patrol, this.author, app.rng.stream('ai'));
    this.motion = new EncounterSchedule(nightRows.motion, this.author);
    this.arrows = new Projectiles({ game: ctx.game, sky: ctx.sky, player: ctx.player, forest: ctx.forest }, undefined, ghostArrowKind(nightRows));
    this.arrows.mesh.renderOrder = 13; this.arrows.mesh.receiveShadow = false;
    this.arrows.onPlayerHit = p => { this.hurt?.(nightRows.damage, this.shooter); ctx.cues.cue('cue.ghost.hurt', p, UP); };
    this.arrows.onImpact = (_s, p) => { ctx.cues.cue('cue.ghost.impact', p, UP); };
    this.hitResult = { animal: this.placeholder(), point: new THREE.Vector3(), distance: 0, headshot: false };
  }

  private placeholder(): TargetAnimal {
    return { kind: GHOST_RIDER, position: new THREE.Vector3(), alive: false, applyDamage: () => false, damageFor: () => 0 };
  }

  attach(animals: AnimalManager): void {
    this.patrol.attachActors(animals);
  }


  // ── spawning ──

  /** one rider (any variant) at (x, z), facing `yaw`; it materialises out of mist. Not in a line: drive `a.mem.tx / tz / v` */
  spawnRider(o: { x: number; z: number; yaw: number; variant?: GhostVariant; storm?: boolean }): Animal | null {
    const bound = this.patrol.spawnActor({ ...o, quiet: Number(o.storm === true) });
    return bound === null ? null : this.presentRider(bound, o.storm === true);
  }

  private presentRider(bound: PatrolActorBinding<Animal>, storm: boolean): Animal {
    const { a, law } = bound, variant = a.variant;
    this.members.push(a);
    // the ghost look: one material on the whole horse (not the painterly three), a hooded rider on the body bone
    const look = storm ? 'storm' : variant === 'captain' ? 'captain' : 'rider';
    const horseMat = ghostMaterial(this.nightRows, look), riderMat = ghostMaterial(this.nightRows, look);
    const scope = this.ctx.game.levelScope.child('ghost-rider');
    scope.own(horseMat.mat); scope.own(riderMat.mat);
    if (storm) { a.scale *= 1.6; a.mesh.scale.setScalar(a.scale); pinBrain(a, scope); }   // the Titan's 8 m cloud horsemen
    a.mesh.material = horseMat.mat;
    // no shadow from a ghost: the manager sets castShadow every frame, so pin it off
    Object.defineProperty(a.mesh, 'castShadow', { get: () => false, set: () => undefined, configurable: true });
    const rider = new THREE.Mesh(riderGeometry(variant === 'captain'), riderMat.mat);
    scope.own(rider.geometry);
    rider.name = 'ghost-rider-figure';
    rider.frustumCulled = false;
    const body = a.mesh.skeleton.getBoneByName('body');
    if (body !== undefined) { body.add(rider); rider.position.set(0, 0, 0); }
    const r: Rider = { a, scope, mats: [horseMat, riderMat], law };
    this.riders.push(r);
    _v.set(a.position.x, heightAt(a.position.x, a.position.z) + 1, a.position.z);
    this.ctx.cues.cue('cue.ghost.form', _v, UP);
    return a;
  }

  /** a line of `count` riders riding the ridge loop from `at` (m along it; default: the point farthest from the player) */
  spawnLine(o: { count?: number; captain?: boolean; at?: number } = {}): Animal[] {
    return this.patrol.spawnActors(this.ctx.player.position, { ...o, leader: o.captain === true }).map(bound => this.presentRider(bound, false));
  }

  /** tear a rider into mist now */
  dissolve(a: Animal): void {
    this.patrol.dissolveActor(a);
  }

  /** dawn: every rider left rides into the light and is gone */
  dawn(): void { for (const r of this.riders) this.dissolve(r.a); }

  // ── the hit test the horse capsules miss: the rider's torso + hood ──

  riderTarget(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null): TargetHit | null {
    let best = hit !== null ? Math.min(maxDist, hit.distance) : maxDist, found: Rider | null = null, head = false;
    _ray.set(origin, dir);
    for (const r of this.riders) {
      if (r.law.state['dead'] === 1 || !r.a.alive || r.a.hidden) continue;
      if (r.a.position.distanceToSquared(origin) > (best + 4) * (best + 4)) continue;
      ghostRiderPoints(r.a, _c, _h);
      const sc = r.a.scale;
      for (const [ctr, rad, isHead] of [[_h, 0.2 * sc, true], [_c, 0.36 * sc, false]] as const) {
        _sph.set(ctr, rad);
        if (_ray.intersectSphere(_sph, _pv) === null) continue;
        const d = _pv.distanceTo(origin);
        if (d < best) { best = d; found = r; head = isHead; this.hitResult.point.copy(_pv); }
      }
    }
    if (found === null) return hit;
    this.hitResult.animal = found.a; this.hitResult.distance = best; this.hitResult.headshot = head;
    return this.hitResult;
  }

  // ── per frame ──

  update(dt: number, t: number): void {
    GHOST_TIME.value = t;
    const p = this.ctx.player.position;
    const step = this.patrol.updateActors(dt, { px: p.x, py: p.y, pz: p.z, hold: Number(this.hold), night: Number(this.ctx.clock.dayPhase === 'night') }, this.freeze);
    if (step.dt > 0) this.motion.project({ dt: step.dt, px: p.x, pz: p.z });
    if (step.spawn) this.spawnLine();
    const effects = new Map(step.effects.map(effect => [effect.member.id, effect]));
    for (let i = this.riders.length - 1; i >= 0; i--) {
      const r = this.riders[i];
      if (r === undefined) continue;
      const a = r.a;
      const effect = effects.get(r.law.id), state = r.law.state;
      if (effect?.killed === true) this.onRiderKilled?.(a, this.killsTonight);
      if (effect?.retire === true) { this.retire(r); this.riders.splice(i, 1); continue; }
      for (const m of r.mats) m.fade.value = state['fade'] ?? 0;
      if ((state['dying'] ?? 0) > 0) {
        this.ctx.cues.cue('cue.ghost.tear', ghostSeat(a, _v), UP);
      }
      if (state['dead'] === 1 || a.hidden) continue;
      // the smoke trail: mist off the legs and the cloak, left behind as it gallops
      // (small wisps, left BEHIND the horse: the body itself must stay readable through them)
      if (app.rng.stream('cosmetic').next() < dt * 22) {
        const back = _w.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
        this.ctx.cues.cue('cue.ghost.trail', ghostSeat(a, _v).addScaledVector(back, 1.1), back);
      }
      if (!this.freeze && effect?.shoot === true) this.shoot(r);
    }
    this.arrows.update(dt);
  }

  /** loose one glowing arrow at the player: a ballistic solve with a lead, and a little spread */
  private shoot(r: Rider): void {
    const a = r.a, p = this.ctx.player.position;
    ghostSeat(a, _v); _v.y += 0.7 * a.scale;                 // from the rider's shoulders
    const aim = this.author.project('aim', { x: _v.x, y: _v.y, z: _v.z, px: p.x, py: p.y, pz: p.z,
      vx: this.motion.value('vx'), vz: this.motion.value('vz') }, app.rng.stream('ai'));
    _d.set(aim['dx'] ?? 0, aim['dy'] ?? 0, aim['dz'] ?? 0);
    this.shooter = a;
    this.arrows.launch(_v, _d, { damageScale: 1 });
    this.ctx.cues.cue('cue.ghost.loose', _v, UP);
  }

  private retire(r: Rider): void {
    const a = r.a;
    this.patrol.retireActor(a);
    const i = this.members.indexOf(a); if (i !== -1) this.members.splice(i, 1);
    r.scope.dispose();
  }
}
