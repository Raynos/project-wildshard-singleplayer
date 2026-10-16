/**
 * Castaway — Wendell, the marooned sailor who gives Driftwood Isle's quest (A1, D5). Built with the low-poly kit
 * (his meshes are rows, data/castawayLook.ts, built by @wildshard/sdk/kit/kitParts; the shared lowPolyLookMaterial): a lanky old salt in a torn blue-and-white striped
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
 * (unlit), smoke (puff quads); past 85 m only the smoke. The smoke is a thin, broken wisp (runtime/looks/smokeColumn.ts, its
 * material graph data/smokeLook.ts from data/castawayLook.ts's row, all on the GPU): each puff grows as it climbs, fades in over the fire and out
 * toward the top, wanders on its own turbulence and leans downwind — so from the pier it reads as smoke, not a straight
 * bright streak.
 * No lights; the flames are unlit colour that blooms.
 */
import * as THREE from 'three';
import { playClips, stepNpcFacing, stepNpcHeadFocus, type ClipCtx, type NpcHeadFocusInput } from '@wildshard/game/plugin/animation';
import { createClientScene, bindWorldSceneParts } from '@wildshard/game/plugin/ui';
import { CASTAWAY_SCENE, CASTAWAY_PARTS, CASTAWAY_BINDINGS } from '../data/npcScenes';
import { CASTAWAY_POSE } from '../data/npcPose';
import { CASTAWAY_HEAD_FOCUS, CASTAWAY_FACING } from '../data/npcFocus';
import { NPC_KIT_GEOMETRY, WENDELL_HEAD_GEOMETRY } from '../boot/fixedGeometry';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { SmokeColumn } from '../runtime/looks/smokeColumn';
import { CASTAWAY_SMOKE } from '../data/castawayLook';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const NECK = 1.52;
const NEAR_R = 85;

/** The original fitted head, prepared offline and lent through the existing fixed-model library. */
export async function loadWendellFace(): Promise<THREE.BufferGeometry> {
  await WENDELL_HEAD_GEOMETRY.load();
  return WENDELL_HEAD_GEOMETRY.copy();
}

export interface Pos { x: number; y: number; z: number; yaw?: number }

export class Castaway {
  readonly group = new THREE.Group();
  readonly collider: Collider;
  talking = false;
  private body: THREE.Object3D = new THREE.Mesh();
  private camp: THREE.Object3D = new THREE.Mesh();
  /** body + head + arm: turns about his feet to face you (E129); the campfire is not in it */
  private figure = new THREE.Group();
  private readonly pose: ClipCtx = { bones: {}, t: 0, phase: 0, speed: 0, alive: true, deathT: 0, attack: -1, mem: {} };
  private turn = 0;   // the figure's yaw off his idle facing (rad)
  private head: THREE.Object3D = new THREE.Mesh();
  private arm: THREE.Object3D = new THREE.Mesh();
  private flames = new THREE.Mesh();
  private readonly focus: NpcHeadFocusInput = { distance: 0, relativeYaw: 0, playerY: 0, headY: 0 };
  private readonly gaze = { headYaw: 0, headPitch: 0, glanceT: 0, glanceYaw: 0, glancePitch: .15 };
  private readonly bodyYaw: number;
  private waveT = -1;
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
    const mat = lowPolyLookMaterial(this.sky, 'still'), f = this.fireLocal;
    this.group.position.set(this.feet.x, this.feet.y, this.feet.z);
    this.group.rotation.y = this.bodyYaw;
    // his kit meshes are baked offline (generators/npcKits.ts); the camp, built about its fire, moves to where it burns
    const kit = NPC_KIT_GEOMETRY.castaway;
    const geometry = new Map<string, THREE.BufferGeometry>([['body', kit.body.copy()], ['camp', kit.camp.copy().translate(f.x, f.y, f.z)], ['head', kit.head.copy()], ['arm', kit.arm.copy()]]);
    // flames (unlit, bloom)
    const flameMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.8, 1.8, 1.8) });
    flameMat.name = 'castaway-flame';
    this.flames = new THREE.Mesh(kit.flames.copy(), flameMat);
    this.flames.position.set(f.x, f.y + 0.08, f.z);

    // ── smoke: one draw of puffs rising off the fire, drifting a little downwind (posed on the GPU) ──
    const smoke = new SmokeColumn(CASTAWAY_SMOKE, f);

    const made = createClientScene(CASTAWAY_SCENE, { geometry: id => geometry.get(id), materials: new Map([['coat', mat]]),
      objects: new Map<string, THREE.Object3D>([['flames', this.flames], ['smoke', smoke.mesh]]) });
    Object.assign(this, bindWorldSceneParts(made, CASTAWAY_PARTS, CASTAWAY_BINDINGS));
    this.group.name = made.root.name; this.group.add(...made.root.children);
    this.pose.bones = { head: this.head, arm: this.arm, flames: this.flames };
    return this;
  }

  get faceMesh(): THREE.Mesh { if (!(this.head instanceof THREE.Mesh)) throw new Error('Castaway requires its face mesh'); return this.head; }

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
    this.turn = stepNpcFacing(this.turn, d < CASTAWAY_FACING.range || this.talking ? toYou - this.bodyYaw : 0, CASTAWAY_FACING, dt);
    this.figure.rotation.y = this.turn;
    // the head leads: it turns toward you whenever you are near, on top of the body's turn
    const focus = this.focus; focus.distance = d; focus.relativeYaw = toYou - this.bodyYaw - this.turn;
    focus.playerY = player.y; focus.headY = gp.y + NECK + 0.1;
    stepNpcHeadFocus(this.gaze, CASTAWAY_HEAD_FOCUS, focus, dt, t);
    this.body.scale.set(1, 1 + Math.sin(t * 1.6) * 0.006, 1);
    const pose = this.pose; pose.t = t; pose.mem['waving'] = this.waveT >= 0 ? 1 : 0;
    if (this.waveT >= 0) this.waveT += dt;
    pose.phase = this.waveT; if (this.waveT > 2.2) this.waveT = -1;
    pose.mem['talking'] = this.talking ? 1 : 0;
    pose.mem['headPitch'] = this.gaze.headPitch; pose.mem['headYaw'] = this.gaze.headYaw;
    playClips(CASTAWAY_POSE, pose);
    // flames flicker; smoke rises (only near enough to see it: 260 m covers the whole island)
    const fl = 1 + Math.sin(t * 13) * 0.1 + Math.sin(t * 31 + 2) * 0.06;
    this.flames.scale.set(1 + Math.sin(t * 17) * 0.05, fl, 1 + Math.cos(t * 19) * 0.05);
  }
}

