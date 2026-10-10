/**
 * Castaway — Wendell, the marooned sailor who gives Driftwood Isle's quest (A1, D5). Built with the low-poly kit
 * (his meshes are rows, data/castawayLook.ts, built by @wildshard/sdk/kit/kitParts; the shared lowPolyMaterial): a lanky old salt in a torn blue-and-white striped
 * shirt, rolled canvas trousers, bare feet, a rope belt, a frayed straw hat over a big grey beard, leaning on a
 * driftwood staff — and his campfire beside him (stone ring, logs, flames, a smoke column you can see from the pier:
 * the breadcrumb the intro objective points at).
 *
 *   const npc = new Castaway(sky, { x, y, z, yaw }, { x, y, z }).build();   // his feet; the fire's centre
 *   scene.add(npc.group);  register its registry piece;
 *   game.onUpdate((dt, t) => npc.update(dt, t, player.position));
 *   npc.talking = true    // gestures with the free arm while the dialogue is open (and keeps facing you)
 *   npc.wave()            // a big overhead wave (the first time you come near)
 *   npc.headWorld(v)      // where the "[E] Talk" prompt sits
 *
 * He turns to face you (E129): within FACE_R, or while the dialogue is open, the whole figure (body + head + arm, one
 * pivot at his feet) eases round toward you at no more than TURN_MAX rad/s, the head leading it; walk off and he eases
 * back to his idle facing. The feet don't step — at that rate a turn on the spot reads as a shuffle, not a moonwalk.
 * The campfire stays put in the NPC group's frame.
 *
 * Draw calls: body, campfire (two merged meshes, the shadow casters), head, waving arm (each its own pivot), flames
 * (unlit), smoke (Points); past 85 m only the smoke. The smoke is a thin, broken wisp (SHARD-PLATFORM M3: the SDK's
 * @wildshard/sdk/looks/smokeColumn from data/castawayLook.ts): each puff grows as it climbs, fades in over the fire and out
 * toward the top, wanders on its own turbulence and leans downwind — so from the pier it reads as smoke, not a straight
 * bright streak.
 * No lights; the flames are unlit colour that blooms.
 */
import * as THREE from 'three';
import { loadFaceHead, type FaceHead } from './faceHeads';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { buildKitMesh } from '@wildshard/sdk/kit/kitParts';
import { SmokeColumn, type SmokeColumnSet } from '@wildshard/sdk/looks/smokeColumn';
import { CASTAWAY_ARM, CASTAWAY_BODY, CASTAWAY_CAMP, CASTAWAY_FLAMES, CASTAWAY_HEAD, CASTAWAY_SMOKE } from '../data/castawayLook';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const NECK = 1.52, SHOULDER = V(-0.21, 1.4, 0);   // right shoulder (the model faces +Z; its right is −X)
const NEAR_R = 85;
const FACE_R = 6;          // m (feet to feet): inside this, or while talking, he turns his body to face you
const TURN_K = 3;          // 1/s: the body's ease toward the facing it wants …
const TURN_MAX = 2.2;      // … capped at this many rad/s (180° in ~1.5 s)

/** E343 (Jake's pick D): Wendell's generated head (public/assets/models/driftwood-hero/faces/wendell-head.glb: scripts/img2mesh/head_cut.py
 *  → driftwood_post.py, 1 m tall, the beard's foot at y = 0), fitted to the code head's frame: its neck on the pivot, the
 *  hat's crown at the code hat's 0.335 m. NECK_FROM_TOP is head_cut's measure for this file. */
const WENDELL_HEAD = '/assets/models/driftwood-hero/faces/wendell-head.glb';
const WENDELL_NECK_FROM_TOP = 0.7698;
function wendellHead(fh: FaceHead): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const pos = Float32Array.from(fh.pos);
  let top = -Infinity, bot = Infinity;
  for (let i = 1; i < pos.length; i += 3) { top = Math.max(top, pos[i] ?? 0); bot = Math.min(bot, pos[i] ?? 0); }
  const neck = top - WENDELL_NECK_FROM_TOP * (top - bot);
  const k = 0.335 / Math.max(1e-6, top - neck);
  let cx = 0, cz = 0, n = 0;
  for (let i = 0; i < fh.count; i++) if ((pos[i * 3 + 1] ?? 0) > neck) { cx += pos[i * 3] ?? 0; cz += pos[i * 3 + 2] ?? 0; n++; }
  cx /= Math.max(1, n); cz /= Math.max(1, n);
  for (let i = 0; i < fh.count; i++) {
    pos[i * 3] = ((pos[i * 3] ?? 0) - cx) * k; pos[i * 3 + 1] = ((pos[i * 3 + 1] ?? 0) - neck) * k; pos[i * 3 + 2] = ((pos[i * 3 + 2] ?? 0) - cz) * k + 0.01;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(fh.nrm), 3));
  g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(fh.col), 3));
  g.computeBoundingSphere();
  return g;
}

export async function loadWendellFace(): Promise<THREE.BufferGeometry | null> {
  const face = await loadFaceHead(WENDELL_HEAD);
  return face === null ? null : wendellHead(face);
}

export interface Pos { x: number; y: number; z: number; yaw?: number }

export class Castaway {
  readonly group = new THREE.Group();
  readonly collider: Collider;
  talking = false;
  private body = new THREE.Mesh();
  private camp = new THREE.Mesh();
  /** body + head + arm: turns about his feet to face you (E129); the campfire is not in it */
  private readonly figure = new THREE.Group();
  private turn = 0;   // the figure's yaw off his idle facing (rad)
  private head = new THREE.Mesh();
  private arm = new THREE.Mesh();
  private flames = new THREE.Mesh();
  private smoke: SmokeColumnSet | null = null;
  private headYaw = 0; private headPitch = 0; private readonly bodyYaw: number;
  private waveT = -1;
  private glanceT = 0; private glanceYaw = 0;
  private fireLocal: THREE.Vector3;

  private readonly sky: Sky;
  private readonly feet: Pos;

  constructor(sky: Sky, feet: Pos, fire: Pos) {
    this.sky = sky; this.feet = feet;
    this.bodyYaw = feet.yaw ?? 0;
    // the fire in the NPC's frame (the group is placed at his feet, rotated with him)
    const dx = fire.x - feet.x, dz = fire.z - feet.z, c = Math.cos(-this.bodyYaw), s = Math.sin(-this.bodyYaw);
    this.fireLocal = V(dx * c + dz * s, fire.y - feet.y, -dx * s + dz * c);
    this.collider = { x: feet.x, z: feet.z, hw: 0.28, hd: 0.28, rot: 0, yTop: feet.y + 1.8, yBottom: feet.y - 0.3 };
  }

  build(): this {
    const mat = lowPolyMaterial(this.sky);
    this.group.position.set(this.feet.x, this.feet.y, this.feet.z);
    this.group.rotation.y = this.bodyYaw;
    this.group.name = 'castaway';

    // ── body (turns with the figure), campfire (fire-local, stays put while he turns), head, arm, flames: data/castawayLook.ts ──
    this.body = new THREE.Mesh(buildKitMesh(CASTAWAY_BODY), mat);
    this.body.castShadow = true; this.body.receiveShadow = true;
    const f = this.fireLocal;
    this.camp = new THREE.Mesh(buildKitMesh(CASTAWAY_CAMP, f), mat);
    this.camp.castShadow = true; this.camp.receiveShadow = true;

    // the code head (pivot at the neck)
    this.head = new THREE.Mesh(buildKitMesh(CASTAWAY_HEAD), mat);
    this.head.position.set(0, NECK, 0.01);
    // E343 (Jake's pick D): the generated head (Hunyuan3D-2 from a codex portrait in the island's toon look, its own paint,
    // cut at its neck, the faceted post) replaces this code head — its stand-in — as soon as the ~35 KB file is in


    // the right arm (pivot at the shoulder, hanging along −Y)
    this.arm = new THREE.Mesh(buildKitMesh(CASTAWAY_ARM), mat);
    this.arm.position.copy(SHOULDER);

    // flames (unlit, bloom)
    const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.8, 1.8, 1.8) });
    flameMat.name = 'castaway-flame';
    this.flames = new THREE.Mesh(buildKitMesh(CASTAWAY_FLAMES), flameMat);
    this.flames.position.set(f.x, f.y + 0.08, f.z);

    // ── smoke: one Points cloud rising off the fire, drifting a little downwind ──
    this.smoke = new SmokeColumn(CASTAWAY_SMOKE, f);

    this.figure.add(this.body, this.head, this.arm);
    this.group.name = 'npc-castaway';   // E304: the face capture finds him by name
    this.group.add(this.figure, this.camp, this.flames, this.smoke.points);
    return this;
  }

  get faceMesh(): THREE.Mesh { return this.head; }

  /** the head's world position (the talk prompt / the name tag) */
  headWorld(out: THREE.Vector3): THREE.Vector3 { return out.set(0, NECK + 0.15, 0).applyMatrix4(this.group.matrixWorld); }
  get position(): THREE.Vector3 { return this.group.position; }

  wave(): void { if (this.waveT < 0) this.waveT = 0; }

  update(dt: number, t: number, player: THREE.Vector3): void {
    const gp = this.group.position;
    const dx = player.x - gp.x, dz = player.z - gp.z, d = Math.hypot(dx, dz);
    // past NEAR_R only the smoke column is drawn (the breadcrumb from the pier): the man and his fire are a few pixels there
    const near = d < NEAR_R;
    if (near !== this.figure.visible) { this.figure.visible = this.camp.visible = this.flames.visible = near; }
    // the body turns to face you when you come to talk (or while you do), and eases back to his idle facing after
    const toYou = Math.atan2(dx, dz);
    const wantTurn = d < FACE_R || this.talking ? wrap(toYou - this.bodyYaw) : 0;
    const dTurn = wrap(wantTurn - this.turn) * (1 - Math.exp(-TURN_K * dt));
    this.turn = wrap(this.turn + THREE.MathUtils.clamp(dTurn, -TURN_MAX * dt, TURN_MAX * dt));
    this.figure.rotation.y = this.turn;
    // the head leads: it turns toward you whenever you are near, on top of the body's turn
    let wantYaw: number, wantPitch: number;
    if (d < 9) {
      wantYaw = THREE.MathUtils.clamp(wrap(toYou - this.bodyYaw - this.turn), -1.1, 1.1);
      wantPitch = THREE.MathUtils.clamp(-Math.atan2(player.y + 1.6 - (gp.y + NECK + 0.1), Math.max(0.5, d)), -0.4, 0.4);
    } else {
      // idle: glance at the fire, the sea, the fire again
      this.glanceT -= dt;
      if (this.glanceT <= 0) { this.glanceT = 2.5 + (Math.sin(t * 1.7) + 1) * 2; this.glanceYaw = Math.sin(t * 0.37) * 0.8; }
      wantYaw = this.glanceYaw; wantPitch = 0.15;
    }
    this.headYaw += (wantYaw - this.headYaw) * Math.min(1, dt * 5);
    this.headPitch += (wantPitch - this.headPitch) * Math.min(1, dt * 5);
    const breathe = Math.sin(t * 1.6);
    this.head.rotation.set(this.headPitch + breathe * 0.02, this.headYaw, Math.sin(t * 0.5) * 0.05);
    this.head.position.y = NECK + breathe * 0.006;
    this.body.scale.set(1, 1 + breathe * 0.006, 1);
    // the arm: hangs and sways; a wave is a big overhead arc for 2.2 s
    if (this.waveT >= 0) {
      this.waveT += dt;
      const up = Math.min(1, this.waveT * 4) * Math.min(1, Math.max(0, (2.2 - this.waveT) * 4));
      this.arm.rotation.set(0, 0, -2.6 * up + Math.sin(this.waveT * 12) * 0.35 * up);
      if (this.waveT > 2.2) this.waveT = -1;
    } else {
      this.arm.rotation.set(Math.sin(t * 1.1) * 0.05, 0, 0.08 + (this.talking ? Math.max(0, Math.sin(t * 2.3)) * 0.35 : 0));
    }
    // flames flicker; smoke rises (only near enough to see it: 260 m covers the whole island)
    const fl = 1 + Math.sin(t * 13) * 0.1 + Math.sin(t * 31 + 2) * 0.06;
    this.flames.scale.set(1 + Math.sin(t * 17) * 0.05, fl, 1 + Math.cos(t * 19) * 0.05);
    this.flames.rotation.y = t * 0.6;
    // the column is the far breadcrumb; up close it thins out so it never fogs the view
    this.smoke?.update(dt, d);
  }
}

function wrap(a: number): number { return Math.atan2(Math.sin(a), Math.cos(a)); }
