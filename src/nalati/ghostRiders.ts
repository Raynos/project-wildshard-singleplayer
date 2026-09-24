import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from '../player/Player';
import type { Forest } from '../world/Forest';
import type { Animal } from '../entities/Animal';
import type { AnimalManager } from '../entities/AnimalManager';
import type { DayClock } from '../world/DayClock';
import type { TargetAnimal, TargetHit } from '../player/Crossbow';
import { heightAt } from '../world/Heightfield';
import { HORSE_SPEED } from '../entities/species/horse';
import { GHOST_RIDER, riderGeometry, ghostSeat, ghostRiderPoints } from '../entities/species/ghostRider';
import { Projectiles, type ProjectileKind } from '../player/Projectiles';
import { NightParticles, FLAG_RISE, FLAG_GROW } from './nightFx';
import { BOWL } from '../chunks/nalatiLayout';

/**
 * Ghost riders — the night half of row B11 (project/archive/2026-09-23-nalati.md; elites-and-bosses.md E5; mockups
 * art/nalati-grasslands/round-1/3-enemies/enemy-6-ghost-riders.png, round-2/4-named-elites/elite-5-qara-batyr-night-rider.png).
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
 *   gr.arrows                                   // the enemy arrow pool (Projectiles with `hurtsPlayer`) — a volley is `volley()`
 * Hooks: `hurt(damage)` (set by the wiring: main's health / flash), `onRiderKilled`.
 *
 * Cost: a rider is one horse SkinnedMesh (the ghost material instead of the painterly one) + one rider mesh; the arrows
 * are one InstancedMesh, the mist one Points — the whole night ≈ 8 draw calls. The ghost material is a MeshLambert whose
 * output is replaced by a fresnel glow (additive, self-lit, no fog, no shadows): 2 programs (skinned / static).
 */

export interface GhostRidersCtx { game: Game; sky: Sky; player: Player; forest: Forest; clock: DayClock }
export type GhostVariant = 'rider' | 'captain';
interface Rider {
  a: Animal; mats: GhostMat[]; line: Line | null; slot: number;
  fade: number; fadeTarget: number; dying: number; fireT: number; dead: boolean;
  /** a storm rider (the Titan's, B14): no arrows — its script drives its charges */
  quiet: boolean;
}
interface Line { riders: Rider[]; s: number; mode: 'patrol' | 'engage'; theta: number; dir: number; engagedT: number }
interface GhostMat { mat: THREE.MeshLambertMaterial; fade: THREE.IUniform<number> }

/** the ridge loop the lines ride (x, z; +x = west, +z = north): round the Sky Grassland's bowl just inside its rims
 *  (layout v2: the bowl's squircle, src/chunks/nalatiLayout.ts BOWL, at 85 % of its size), 16 points */
const RIDGE: readonly (readonly [number, number])[] = Array.from({ length: 16 }, (_, i): readonly [number, number] => {
  const t = (i / 16) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
  return [BOWL.x + BOWL.ax * 0.85 * Math.sign(c) * Math.abs(c) ** (2 / 3), BOWL.z + BOWL.az * 0.85 * Math.sign(sn) * Math.abs(sn) ** (2 / 3)];
});
const SPACING = 11, CIRCLE_R = 34, ENGAGE = 70, DISENGAGE = 115, SHOOT = 62;
const ARROW_SPEED = 34, ARROW_G = 5, ARROW_DMG = 10, RESPAWN = 60;
const GALLOP = 11.5;
const GHOST_TIME: THREE.IUniform<number> = { value: 0 };

// ───────────────────────────── the ghost material ─────────────────────────────

function ghostMaterial(look: GhostVariant | 'storm' = 'rider'): GhostMat {
  const captain = look === 'captain', storm = look === 'storm';
  const fade: THREE.IUniform<number> = { value: 0 };
  const mat = new THREE.MeshLambertMaterial({ color: 0x000000, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  // the Storm Titan's storm riders (B14): pale storm-cloud grey, a white-blue lightning rim
  const core = storm ? 'vec3(0.34, 0.38, 0.48)' : captain ? 'vec3(0.1, 0.5, 0.42)' : 'vec3(0.08, 0.42, 0.52)';
  const rim = storm ? 'vec3(1.5, 1.8, 2.6)' : captain ? 'vec3(0.6, 2.4, 1.9)' : 'vec3(0.45, 1.9, 2.3)';
  // chain the prototype hook (Atmosphere.ts attaches the painted air's fog + cloud-shadow uniforms there). Replacing it left
  // `fogCloudTex` (sampler2D) unbound on texture unit 0 next to the shadow map's sampler2DShadow: "two textures of different
  // types use the same sampler location" — WebGL drops the draw, so the bodies never rendered (only the mist did; B11)
  const base = mat.onBeforeCompile.bind(mat);
  mat.onBeforeCompile = (sh, renderer) => {
    base(sh, renderer);
    sh.uniforms['uGFade'] = fade; sh.uniforms['uGTime'] = GHOST_TIME;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGFade;\nuniform float uGTime;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        vec3 gN = normalize( normal );
        vec3 gV = normalize( vViewPosition );
        float gF = pow( clamp( 1.0 - abs( dot( gN, gV ) ), 0.0, 1.0 ), 2.0 ); // clamped: |N·V| rounds past 1 on iOS mediump → pow(negative) = NaN → bloom's black square (E91)
        float gS = 0.75 + 0.25 * sin( gl_FragCoord.y * 0.045 + uGTime * 3.1 ) * sin( gl_FragCoord.x * 0.031 - uGTime * 2.3 );
        vec3 gC = mix( ${core}, ${rim}, gF ) * ( 0.8 + 1.3 * gF ) * gS;
        gl_FragColor = vec4( gC * uGFade, 1.0 );`);
  };
  mat.customProgramCacheKey = () => (storm ? 'nalati-ghost-storm' : captain ? 'nalati-ghost-captain' : 'nalati-ghost');
  mat.name = 'nalati-ghost';
  return { mat, fade };
}

/** the ghost arrow: a slim shaft, a bright leaf head, a long fading streak behind (tip at the origin, shaft along +z) */
function ghostArrowKind(): ProjectileKind {
  const parts: THREE.BufferGeometry[] = [];
  const shaft = new THREE.CylinderGeometry(0.008, 0.008, 0.8, 5); shaft.rotateX(Math.PI / 2); shaft.translate(0, 0, 0.45); parts.push(shaft);
  const head = new THREE.ConeGeometry(0.03, 0.12, 5); head.rotateX(-Math.PI / 2); head.translate(0, 0, 0.06); parts.push(head);
  // the streak: two crossed tapering quads, 2.6 m
  for (const r of [0, Math.PI / 2]) {
    const q = new THREE.BufferGeometry();
    const L = 2.6, w0 = 0.07, w1 = 0.005;
    q.setAttribute('position', new THREE.Float32BufferAttribute([-w0, 0, 0.1, w0, 0, 0.1, -w1, 0, L, w1, 0, L], 3));
    q.setIndex([0, 2, 1, 1, 2, 3]);
    q.rotateZ(r); parts.push(q);
  }
  const pos: number[] = [], idx: number[] = [];
  for (const p of parts) {
    const base = pos.length / 3, a = p.getAttribute('position');
    for (let i = 0; i < a.count; i++) pos.push(a.getX(i), a.getY(i), a.getZ(i));
    const ix = p.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); else for (let i = 0; i < a.count; i++) idx.push(i + base);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // brightest at the head, fading down the streak (vertex colour × the HDR cyan)
  const col = new Float32Array(pos.length);
  for (let i = 0; i < pos.length / 3; i++) { const z = pos[i * 3 + 2] ?? 0; const k = z < 0.2 ? 1 : Math.max(0.02, 1 - (z - 0.2) / 2.4) ** 1.6; col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 2.6, 3.0), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
  mat.name = 'nalati-ghost-arrow';
  return {
    geometry: g, material: mat, length: 0.85, gravity: ARROW_G, drag: 0.004, windCoupling: 0, bury: 0, recover: 0,
    maxFlying: 16, maxStuck: 0, stick: false, hitsAnimals: false, puffs: false, hurtsPlayer: { radius: 0.42, height: 1.8 },
  };
}

// ───────────────────────────── the path ─────────────────────────────

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _c = new THREE.Vector3(), _h = new THREE.Vector3(), _d = new THREE.Vector3(), _pv = new THREE.Vector3();
const _ray = new THREE.Ray(), _sph = new THREE.Sphere();

const CUM: number[] = [0];
for (let i = 1; i <= RIDGE.length; i++) {
  const a = RIDGE[i - 1], b = RIDGE[i % RIDGE.length];
  CUM.push((CUM[i - 1] ?? 0) + (a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0));
}
const LOOP = CUM[CUM.length - 1] ?? 1;
/** the point `s` m along the ridge loop */
function ridgeAt(s: number, out: THREE.Vector3): THREE.Vector3 {
  const u = ((s % LOOP) + LOOP) % LOOP;
  let i = 0; while (i < RIDGE.length - 1 && (CUM[i + 1] ?? LOOP) < u) i++;
  const a = RIDGE[i], b = RIDGE[(i + 1) % RIDGE.length];
  if (!a || !b) return out.set(0, 0, 0);
  const t = (u - (CUM[i] ?? 0)) / Math.max(1e-3, (CUM[i + 1] ?? LOOP) - (CUM[i] ?? 0));
  return out.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);
}
/** the loop position nearest a point (coarse, 4 m steps) */
function nearestS(x: number, z: number): number {
  let best = 0, bd = Infinity;
  for (let s = 0; s < LOOP; s += 4) { ridgeAt(s, _v); const d = Math.hypot(_v.x - x, _v.z - z); if (d < bd) { bd = d; best = s; } }
  return best;
}
const MIST: readonly [number, number, number] = [0.18, 0.75, 0.85];

export class GhostRiders {
  readonly riders: Rider[] = [];
  readonly lines: Line[] = [];
  readonly arrows: Projectiles;
  readonly mist: NightParticles;
  /** B12: true = no automatic lines (the elite system drives the night) */
  hold = false;
  /** dev: the riders stand still where they are (screenshots) */
  freeze = false;
  killsTonight = 0;
  onRiderKilled?: ((a: Animal, killsTonight: number) => void) | undefined;
  /** the player takes damage (set by the wiring: main's health, flash) */
  hurt?: ((damage: number, from: Animal | null) => void) | undefined;
  private animals: AnimalManager | null = null;
  private respawnT = -1;
  private readonly lastPlayer = new THREE.Vector3();
  private readonly playerVel = new THREE.Vector3();
  private readonly hitResult: TargetHit;
  private shooter: Animal | null = null;

  constructor(private readonly ctx: GhostRidersCtx) {
    this.arrows = new Projectiles({ game: ctx.game, sky: ctx.sky, player: ctx.player, forest: ctx.forest }, undefined, ghostArrowKind());
    this.arrows.mesh.renderOrder = 13; this.arrows.mesh.receiveShadow = false;
    this.arrows.onPlayerHit = (p, d) => { this.hurt?.(ARROW_DMG, this.shooter); this.mist.burst(p, 10, 1.5, 0.6, 0.8, 0.25, MIST, 0.2, FLAG_GROW, 0.2); void d; };
    this.arrows.onImpact = (_s, p) => { this.mist.burst(p, 8, 1.2, 1, 0.9, 0.3, MIST, 0.2, FLAG_GROW | FLAG_RISE, 0.2); };
    this.mist = new NightParticles(ctx.game.scene, 'mist');
    this.hitResult = { animal: this.placeholder(), point: new THREE.Vector3(), distance: 0, headshot: false };
    ctx.clock.onNight(() => { this.killsTonight = 0; if (!this.hold && this.living() === 0) this.respawnT = 2; });
    ctx.clock.onDawn(() => { this.dawn(); });
    ctx.clock.onDay(() => { this.dawn(); });
    Object.assign(window, { __ghosts: this }); // dev / screenshots
  }

  private placeholder(): TargetAnimal {
    return { kind: GHOST_RIDER, position: new THREE.Vector3(), alive: false, applyDamage: () => false, damageFor: () => 0 };
  }

  attach(animals: AnimalManager): void {
    this.animals = animals;
    animals.factory.model(GHOST_RIDER, 'rider');
    const q = new URLSearchParams(location.search).get('ghosts');
    if (q === 'line' || (this.ctx.clock.phase === 'night' && q !== 'off')) this.respawnT = 0.5;
  }

  living(): number { let n = 0; for (const r of this.riders) if (!r.dead) n++; return n; }

  // ── spawning ──

  /** one rider (any variant) at (x, z), facing `yaw`; it materialises out of mist. Not in a line: drive `a.mem.tx / tz / v` */
  spawnRider(o: { x: number; z: number; yaw: number; variant?: GhostVariant; storm?: boolean }): Animal | null {
    const animals = this.animals;
    if (animals === null) return null;
    const variant = o.variant ?? 'rider';
    const a = animals.spawn(GHOST_RIDER, o.x, o.z, o.yaw, variant);
    a.herd = -1;
    // the ghost look: one material on the whole horse (not the painterly three), a hooded rider on the body bone
    const look = o.storm === true ? 'storm' : variant;
    const horseMat = ghostMaterial(look), riderMat = ghostMaterial(look);
    if (o.storm === true) { a.scale *= 1.6; a.mesh.scale.setScalar(a.scale); }   // the Titan's 8 m cloud horsemen
    a.mesh.material = horseMat.mat;
    // no shadow from a ghost: the manager sets castShadow every frame, so pin it off
    Object.defineProperty(a.mesh, 'castShadow', { get: () => false, set: () => undefined, configurable: true });
    const rider = new THREE.Mesh(riderGeometry(variant === 'captain'), riderMat.mat);
    rider.name = 'ghost-rider-figure';
    rider.frustumCulled = false;
    const body = a.mesh.skeleton.getBoneByName('body');
    if (body !== undefined) { body.add(rider); rider.position.set(0, 0, 0); }
    const r: Rider = { a, mats: [horseMat, riderMat], line: null, slot: 0, fade: 0, fadeTarget: 1, dying: 0, fireT: 2 + Math.random() * 2.5, dead: false, quiet: o.storm === true };
    this.riders.push(r);
    _v.set(o.x, heightAt(o.x, o.z) + 1, o.z);
    this.mist.burst(_v, 24, 1.6, 0.8, 1.6, 0.9, MIST, 0.25, FLAG_GROW | FLAG_RISE, 1.2);
    return a;
  }

  /** a line of `count` riders riding the ridge loop from `at` (m along it; default: the point farthest from the player) */
  spawnLine(o: { count?: number; captain?: boolean; at?: number } = {}): Animal[] {
    const count = o.count ?? 3;
    const p = this.ctx.player.position;
    let s = o.at ?? -1;
    if (s < 0) { let bd = -1; for (let q = 0; q < LOOP; q += 8) { ridgeAt(q, _v); const d = Math.hypot(_v.x - p.x, _v.z - p.z); if (d > bd && d < 260) { bd = d; s = q; } } }
    const line: Line = { riders: [], s, mode: 'patrol', theta: 0, dir: Math.random() < 0.5 ? 1 : -1, engagedT: 0 };
    const out: Animal[] = [];
    for (let i = 0; i < count; i++) {
      ridgeAt(s - i * SPACING, _v); ridgeAt(s - i * SPACING + 4, _w);
      const a = this.spawnRider({ x: _v.x, z: _v.z, yaw: Math.atan2(_w.x - _v.x, _w.z - _v.z), variant: i === 0 && o.captain === true ? 'captain' : 'rider' });
      const r = a !== null ? this.riders[this.riders.length - 1] : undefined;
      if (a === null || r === undefined) continue;
      r.line = line; r.slot = i; line.riders.push(r); out.push(a);
    }
    this.lines.push(line);
    return out;
  }

  /** tear a rider into mist now */
  dissolve(a: Animal): void {
    const r = this.riders.find((x) => x.a === a);
    if (r?.dying === 0) { r.dying = 0.001; r.fadeTarget = 0; }
  }

  /** dawn: every rider left rides into the light and is gone */
  dawn(): void { for (const r of this.riders) this.dissolve(r.a); this.respawnT = -1; }

  /** B7 (mounted): the player's horse at (x, z) moving `speed` m/s tramples riders within reach — returns how many */
  trample(x: number, z: number, speed: number): number {
    if (speed < 8) return 0;
    let n = 0;
    for (const r of this.riders) {
      if (r.dead || !r.a.alive || Math.hypot(r.a.position.x - x, r.a.position.z - z) > 2.2 * r.a.scale) continue;
      _v.set(r.a.position.x, r.a.position.y + 1.2, r.a.position.z); _d.set(r.a.position.x - x, 0, r.a.position.z - z).normalize();
      r.a.applyDamage(40 + speed * 3, _v, _d); n++;
    }
    return n;
  }

  /** the loosing volley of a whole line (B12's captain calls it): every living rider of `line` shoots now */
  volley(line: Line): void { for (const r of line.riders) if (!r.dead && r.a.alive) this.shoot(r); }

  // ── the hit test the horse capsules miss: the rider's torso + hood ──

  riderTarget(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hit: TargetHit | null): TargetHit | null {
    let best = hit !== null ? Math.min(maxDist, hit.distance) : maxDist, found: Rider | null = null, head = false;
    _ray.set(origin, dir);
    for (const r of this.riders) {
      if (r.dead || !r.a.alive || r.a.hidden) continue;
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
    if (dt > 0) { this.playerVel.subVectors(p, this.lastPlayer).multiplyScalar(1 / dt); if (this.playerVel.length() > 20) this.playerVel.set(0, 0, 0); }
    this.lastPlayer.copy(p);
    // a new line: at nightfall, and a minute after the last one fell
    if (this.respawnT >= 0 && !this.hold) {
      this.respawnT -= dt;
      if (this.respawnT < 0 && (this.ctx.clock.phase === 'night' || new URLSearchParams(location.search).get('ghosts') === 'line')) this.spawnLine();
    }
    for (const line of this.lines) this.steerLine(line, dt);
    if (this.freeze) for (const r of this.riders) { r.a.mem['tx'] = r.a.position.x; r.a.mem['tz'] = r.a.position.z; r.fireT = 99; }
    for (let i = this.riders.length - 1; i >= 0; i--) {
      const r = this.riders[i];
      if (r === undefined) continue;
      const a = r.a;
      a.mem['px'] = p.x; a.mem['pz'] = p.z;
      // death: tear into mist
      if (!a.alive && !r.dead) {
        r.dead = true; r.dying = Math.max(r.dying, 0.001); r.fadeTarget = 0;
        this.killsTonight++;
        this.onRiderKilled?.(a, this.killsTonight);
      }
      // the fade (materialise / dissolve)
      r.fade += (r.fadeTarget - r.fade) * Math.min(1, dt * (r.fadeTarget > r.fade ? 1.4 : 2.2));
      for (const m of r.mats) m.fade.value = r.fade;
      if (r.dying > 0) {
        r.dying += dt;
        if (r.dying < 1.3) {
          ghostSeat(a, _v);
          for (let k = 0; k < 4; k++) this.mist.emit(_v.x + (Math.random() - 0.5) * 1.6, _v.y - Math.random() * 1.4, _v.z + (Math.random() - 0.5) * 1.6,
            (Math.random() - 0.5) * 1.2, 0.6 + Math.random(), (Math.random() - 0.5) * 1.2, 1.4, 0.35 + Math.random() * 0.4, MIST[0], MIST[1], MIST[2], FLAG_GROW | FLAG_RISE);
        } else { this.retire(r); this.riders.splice(i, 1); continue; }
      }
      if (r.dead || a.hidden) continue;
      // the smoke trail: mist off the legs and the cloak, left behind as it gallops
      // (small wisps, left BEHIND the horse: the body itself must stay readable through them)
      if (Math.random() < dt * 22) {
        ghostSeat(a, _v);
        const back = _w.set(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
        this.mist.emit(_v.x + back.x * 1.1 + (Math.random() - 0.5) * 0.7, _v.y + 0.3 - Math.random() * 1.6, _v.z + back.z * 1.1 + (Math.random() - 0.5) * 0.7,
          back.x * 2.2, 0.25, back.z * 2.2, 0.9 + Math.random() * 0.5, 0.12 + Math.random() * 0.14, MIST[0] * 0.6, MIST[1] * 0.6, MIST[2] * 0.6, FLAG_GROW | FLAG_RISE);
      }
      // shooting: inside SHOOT m, engaged (or a loose rider), on a timer
      r.fireT -= dt;
      const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
      if (!r.quiet && r.fireT <= 0 && d < SHOOT && d > 6 && (r.line === null || r.line.mode === 'engage')) { this.shoot(r); r.fireT = 3 + Math.random() * 1.8; }
    }
    // lines with nobody left: drop them; start the next one's clock
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const line = this.lines[i];
      if (line?.riders.every((r) => r.dead || r.a.hidden || !this.riders.includes(r)) === true) {
        this.lines.splice(i, 1);
        if (this.living() === 0 && this.ctx.clock.phase === 'night') this.respawnT = RESPAWN;
      }
    }
    this.arrows.update(dt);
    this.mist.update(dt, this.ctx.game.renderer, this.ctx.game.camera);
  }

  /** patrol the ridge loop in file; wheel onto the player and circle at a gallop inside ENGAGE m */
  private steerLine(line: Line, dt: number): void {
    const p = this.ctx.player.position;
    const lead = line.riders.find((r) => !r.dead);
    if (lead === undefined) return;
    const dLead = Math.hypot(p.x - lead.a.position.x, p.z - lead.a.position.z);
    const plateau = p.y > 18;   // the ridge lines are the plateau's: a player down in the valley is left alone
    if (line.mode === 'patrol' && dLead < ENGAGE && plateau) {
      line.mode = 'engage'; line.engagedT = 0;
      line.theta = Math.atan2(lead.a.position.x - p.x, lead.a.position.z - p.z);
    } else if (line.mode === 'engage' && (dLead > DISENGAGE || !plateau)) {
      line.mode = 'patrol'; line.s = nearestS(lead.a.position.x, lead.a.position.z);
    }
    if (line.mode === 'patrol') {
      line.s += dt * HORSE_SPEED.canter * 0.95;
      for (const r of line.riders) {
        if (r.dead) continue;
        ridgeAt(line.s - r.slot * SPACING + 10, _v);
        const m = r.a.mem;
        // hold the file: a rider behind its slot gallops to catch up
        ridgeAt(line.s - r.slot * SPACING, _w);
        const lag = Math.hypot(_w.x - r.a.position.x, _w.z - r.a.position.z);
        m['tx'] = _v.x; m['tz'] = _v.z; m['v'] = lag > 6 ? GALLOP : HORSE_SPEED.canter; m['turn'] = 2.2;
      }
    } else {
      line.engagedT += dt;
      line.theta += line.dir * dt * GALLOP / CIRCLE_R;
      for (const r of line.riders) {
        if (r.dead) continue;
        const th = line.theta - line.dir * r.slot * (SPACING / CIRCLE_R) + line.dir * 0.4;   // a lookahead along the circle
        const rr = CIRCLE_R + Math.sin(line.engagedT * 0.4 + r.slot) * 5;                    // breathes in and out
        const m = r.a.mem;
        m['tx'] = p.x + Math.sin(th) * rr; m['tz'] = p.z + Math.cos(th) * rr; m['v'] = GALLOP; m['turn'] = 2.8;
      }
    }
  }

  /** loose one glowing arrow at the player: a ballistic solve with a lead, and a little spread */
  private shoot(r: Rider): void {
    const a = r.a, p = this.ctx.player.position;
    ghostSeat(a, _v); _v.y += 0.7 * a.scale;                 // from the rider's shoulders
    const dist = Math.hypot(p.x - _v.x, p.z - _v.z);
    const tFlight = dist / ARROW_SPEED;
    _w.set(p.x + this.playerVel.x * tFlight * 0.8, p.y + 1.2, p.z + this.playerVel.z * tFlight * 0.8);
    const dx = _w.x - _v.x, dz = _w.z - _v.z, dy = _w.y - _v.y, h = Math.hypot(dx, dz);
    const v2 = ARROW_SPEED * ARROW_SPEED, g = ARROW_G;
    const disc = v2 * v2 - g * (g * h * h + 2 * dy * v2);
    const th = disc >= 0 ? Math.atan((v2 - Math.sqrt(disc)) / (g * Math.max(h, 1e-3))) : Math.PI / 4;
    const spread = THREE.MathUtils.degToRad(1.4);
    const yaw = Math.atan2(dx, dz) + (Math.random() - 0.5) * spread * 2, pitch = th + (Math.random() - 0.5) * spread;
    _d.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(ARROW_SPEED);
    this.shooter = a;
    this.arrows.launch(_v, _d, { damageScale: 1 });
    this.mist.burst(_v, 6, 0.8, 0.4, 0.5, 0.2, MIST, 0.2, FLAG_GROW, 0.15);
  }

  private retire(r: Rider): void {
    const a = r.a;
    a.hidden = true; a.mesh.visible = false;
    a.position.y = -9999;
    const list = this.animals?.animals, i = list?.indexOf(a) ?? -1;
    if (list !== undefined && i !== -1) list.splice(i, 1);
    a.mesh.removeFromParent();
    for (const m of r.mats) m.mat.dispose();
  }
}
