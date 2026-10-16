/**
 * Trader — Driftwood Isle's travelling trader (E314, Jake's pick on board 9: "a trader at Wendell's hut"): the second
 * NPC, who keeps the shop at the hut while Wendell (./Castaway.ts) stays the quest giver. Built exactly as Wendell is —
 * the low-poly kit (her meshes are rows, generators/traderLook.ts, baked offline by generators/npcKits.ts; the shared lowPolyLookMaterial), flat-shaded vertex colour, his
 * proportions and scale — a sea-weathered woman in a teal headscarf knotted at the nape (gold trim, two tails that lift
 * in the wind), gold hoop earrings, a sleeveless orange tunic over a cream shirt with short puffed sleeves, a red sash knotted at the hip, a
 * leather satchel on a strap across her chest, brown trousers tucked into travel boots, one fist on her hip.
 *
 *   const t = new Trader(sky).build();   // own space: feet at the origin, facing +Z
 *   t.group.position / rotation          // where she stands (the model is placed: src/shards/driftwood-isle/runtime/models/trader.ts)
 *   game.onUpdate((dt, t) => trader.update(dt, t, player.position));
 *
 * Her idle (the whole figure, one pivot at her feet, then head, shoulder and elbow pivots):
 *   - she breathes and shifts her weight from foot to foot;
 *   - her head glances about (the goods, the path, the sea) and dips to the counter;
 *   - every ~8–12 s with nobody close she reaches down and straightens the goods on the counter;
 *   - the first time you come up the path (inside GREET_R) she beckons you over, once per approach;
 *   - she turns to face you (E129) inside TRADER_FACING.range: the figure eases round at no more than TURN_MAX rad/s, the head
 *     leading it, and eases back to her counter when you walk off; while you stand there she opens a hand toward her
 *     goods now and then ("take a look").
 * Her shop (E314 stage 2) is src/shards/driftwood-isle/quest/TraderStall.ts's prompt + src/shards/driftwood-isle/loot/ShopPanel.ts; `offer()` plays the "take a
 * look" gesture on demand (the shop opening, a sale).
 *
 * Draw calls: body (the shadow caster), head, upper arm, forearm — four, past NEAR_R none. No lights.
 */
import * as THREE from 'three';
import { playClips, stepNpcFacing, stepNpcHeadFocus, type ClipCtx, type NpcHeadFocusInput } from '@wildshard/game/plugin/animation';
import { createClientScene, bindWorldSceneParts } from '@wildshard/game/plugin/ui';
import { TRADER_SCENE, TRADER_PARTS, TRADER_BINDINGS, TRADER_POSE, TRADER_HEAD_FOCUS, TRADER_FACING } from '../const';
import { NPC_KIT_GEOMETRY } from '../boot/fixedGeometry';
import { lowPolyLookMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

const NECK = 1.48;
export const TRADER_NEAR_R = 85;   // past this she (and her counter) are not drawn: a few pixels at that range
const GREET_R = 11;        // m: coming inside this she beckons you over (once, until you go past REARM_R)
const REARM_R = 18;
/** the most companions that hide with her (today one: her counter) */
const MAX_COMPANIONS = 8;

type Gesture = 'none' | 'beckon' | 'tidy' | 'offer';
const GESTURE_S: Record<Gesture, number> = { none: 0, beckon: 2.4, tidy: 2.6, offer: 1.8 };

export class Trader {
  readonly group = new THREE.Group();
  /** body + head + arm: turns about her feet to face you (E129) */
  private figure = new THREE.Group();
  private body: THREE.Object3D = new THREE.Mesh();
  private head: THREE.Object3D = new THREE.Mesh();
  private upper: THREE.Object3D = new THREE.Mesh();
  private fore: THREE.Object3D = new THREE.Mesh();
  private readonly pose: ClipCtx = { bones: {}, t: 0, phase: 0, speed: 0, alive: true, deathT: 0, attack: -1, mem: {} };
  private turn = 0;
  private readonly focus: NpcHeadFocusInput = { distance: 0, relativeYaw: 0, playerY: 0, headY: 0 };
  private readonly gaze = { headYaw: 0, headPitch: 0, glanceT: 0, glanceYaw: 0, glancePitch: 0.1 };
  private gesture: Gesture = 'none'; private gT = 0;
  private idleT = 6;        // seconds to the next idle tidy
  private offerT = 3;       // seconds to the next "take a look" while you stand at the counter
  private greeted = false;
  /** extra culling: things drawn with her (her counter) hide with her past TRADER_NEAR_R; up to MAX_COMPANIONS */
  readonly companions: THREE.Object3D[] = [];

  private readonly sky: Sky;

  constructor(sky: Sky) { this.sky = sky; }

  build(): this {
    const mat = lowPolyLookMaterial(this.sky);
    // her kit meshes are baked offline (generators/npcKits.ts)
    const kit = NPC_KIT_GEOMETRY.trader;
    const geometry = new Map<string, THREE.BufferGeometry>([['body', kit.body.copy()], ['head', kit.head.copy()], ['upper', kit.upper.copy()], ['fore', kit.fore.copy()]]);
    const made = createClientScene(TRADER_SCENE, { geometry: id => geometry.get(id),
      materials: new Map([['coat', mat]]) });
    Object.assign(this, bindWorldSceneParts(made, TRADER_PARTS, TRADER_BINDINGS));
    this.group.name = made.root.name; this.group.add(...made.root.children);
    this.pose.bones = { figure: this.figure, head: this.head, upper: this.upper, fore: this.fore };
    return this;
  }

  /** the head's world position (a future prompt / name tag) */
  headWorld(out: THREE.Vector3): THREE.Vector3 { return out.set(0, NECK + 0.15, 0).applyMatrix4(this.group.matrixWorld); }
  get position(): THREE.Vector3 { return this.group.position; }

  private start(g: Gesture): void { this.gesture = g; this.gT = 0; }
  /** open a hand toward her goods now (the shop opened, a sale: E314 stage 2) */
  offer(): void { this.start('offer'); this.offerT = 5; }

  setNear(near: boolean): void {
    if (near !== this.figure.visible) { this.figure.visible = near; for (let i = 0; i < Math.min(this.companions.length, MAX_COMPANIONS); i++) { const c = this.companions[i]; if (c !== undefined) c.visible = near; } }
  }

  update(dt: number, t: number, player: THREE.Vector3): void {
    const gp = this.group.position;
    const dx = player.x - gp.x, dz = player.z - gp.z, d = Math.hypot(dx, dz);
    // her facing from the placed pose (a placement's matrix decomposes to Euler (π, a, π) past ±90°: rotation.y alone is not the yaw)
    const e = this.group.matrixWorld.elements, bodyYaw = Math.atan2(e[8], e[10]);

    // ── what she's doing: beckon you over as you come up, straighten the goods when alone, offer them while you're there ──
    if (d > REARM_R) this.greeted = false;
    if (this.gesture !== 'none') { this.gT += dt; if (this.gT > GESTURE_S[this.gesture]) this.gesture = 'none'; }
    if (this.gesture === 'none') {
      if (!this.greeted && d < GREET_R && d > TRADER_FACING.range * 0.6) { this.greeted = true; this.start('beckon'); }
      else if (d >= GREET_R) { this.idleT -= dt; if (this.idleT <= 0) { this.idleT = 8 + (Math.sin(t * 0.83) + 1) * 2; this.start('tidy'); } }
      else if (d < TRADER_FACING.range) { this.offerT -= dt; if (this.offerT <= 0) { this.offerT = 5 + (Math.sin(t * 1.31) + 1) * 1.5; this.start('offer'); } }
    }

    // ── the figure turns to face you when you come close, and eases back to her counter after (E129) ──
    const toYou = Math.atan2(dx, dz);
    this.turn = stepNpcFacing(this.turn, d < TRADER_FACING.range && this.gesture !== 'tidy' ? toYou - bodyYaw : 0, TRADER_FACING, dt);
    // ── the head leads: at you when you're near, else a glance about; down at the goods while she tidies them ──
    const g = this.gesture, gu = g === 'none' ? 0 : ease(this.gT / GESTURE_S[g]);
    const focus = this.focus; focus.distance = d; focus.relativeYaw = toYou - bodyYaw - this.turn;
    focus.playerY = player.y; focus.headY = gp.y + NECK + 0.1;
    focus.overrideYaw = g === 'tidy' ? -0.25 : undefined; focus.overridePitch = g === 'tidy' ? 0.45 : undefined;
    focus.offsetYaw = g === 'offer' && d < GREET_R ? -0.35 * gu : 0; focus.offsetPitch = g === 'offer' && d < GREET_R ? 0.3 * gu : 0;
    stepNpcHeadFocus(this.gaze, TRADER_HEAD_FOCUS, focus, dt, t);
    this.body.scale.set(1, 1 + Math.sin(t * 1.5 + 0.7) * 0.006, 1);
    const pose = this.pose; pose.t = t; pose.phase = this.gT;
    pose.mem['gesture'] = g === 'offer' ? 3 : g === 'tidy' ? 2 : g === 'beckon' ? 1 : 0;
    pose.mem['weight'] = gu; pose.mem['turn'] = this.turn;
    pose.mem['headPitch'] = this.gaze.headPitch; pose.mem['headYaw'] = this.gaze.headYaw;
    playClips(TRADER_POSE, pose);
  }
}

/** 0 → 1 → 0 over a gesture: eased in over its first quarter, out over its last */
function ease(u: number): number {
  const a = Math.min(1, u / 0.25), b = Math.min(1, (1 - u) / 0.25), s = Math.max(0, Math.min(a, b));
  return s * s * (3 - 2 * s);
}


