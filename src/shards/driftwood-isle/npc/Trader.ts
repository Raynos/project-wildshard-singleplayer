/**
 * Trader — Driftwood Isle's travelling trader (E314, Jake's pick on board 9: "a trader at Wendell's hut"): the second
 * NPC, who keeps the shop at the hut while Wendell (./Castaway.ts) stays the quest giver. Built exactly as Wendell is —
 * the low-poly kit (her meshes are rows, data/traderLook.ts, built by @wildshard/sdk/kit/kitParts; the shared lowPolyMaterial), flat-shaded vertex colour, his
 * proportions and scale — a sea-weathered woman in a teal headscarf knotted at the nape (gold trim, two tails that lift
 * in the wind), gold hoop earrings, a sleeveless orange tunic over a cream shirt with short puffed sleeves, a red sash knotted at the hip, a
 * leather satchel on a strap across her chest, brown trousers tucked into travel boots, one fist on her hip.
 *
 *   const t = new Trader(sky).build();   // own space: feet at the origin, facing +Z
 *   t.group.position / rotation          // where she stands (the model is placed: src/shards/driftwood-isle/models/trader.ts)
 *   game.onUpdate((dt, t) => trader.update(dt, t, player.position));
 *
 * Her idle (the whole figure, one pivot at her feet, then head, shoulder and elbow pivots):
 *   - she breathes and shifts her weight from foot to foot;
 *   - her head glances about (the goods, the path, the sea) and dips to the counter;
 *   - every ~8–12 s with nobody close she reaches down and straightens the goods on the counter;
 *   - the first time you come up the path (inside GREET_R) she beckons you over, once per approach;
 *   - she turns to face you (E129) inside FACE_R: the figure eases round at no more than TURN_MAX rad/s, the head
 *     leading it, and eases back to her counter when you walk off; while you stand there she opens a hand toward her
 *     goods now and then ("take a look").
 * Her shop (E314 stage 2) is src/shards/driftwood-isle/quest/TraderStall.ts's prompt + src/shards/driftwood-isle/loot/ShopPanel.ts; `offer()` plays the "take a
 * look" gesture on demand (the shop opening, a sale).
 *
 * Draw calls: body (the shadow caster), head, upper arm, forearm — four, past NEAR_R none. No lights.
 */
import * as THREE from 'three';
import { lowPolyMaterial } from '@wildshard/engine/world/lowpolyKit';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { buildKitMesh } from '@wildshard/sdk/kit/kitParts';
import { TRADER_BODY, TRADER_FORE, TRADER_HEAD, TRADER_UPPER } from '../data/traderLook';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const NECK = 1.48, SHOULDER = V(-0.19, 1.4, 0);   // right shoulder (the model faces +Z; her right is −X)
const ELBOW_Y = -0.27;                             // the elbow below the shoulder pivot
export const TRADER_NEAR_R = 85;   // past this she (and her counter) are not drawn: a few pixels at that range
const FACE_R = 6;          // m (feet to feet): inside this she turns to face you
const GREET_R = 11;        // m: coming inside this she beckons you over (once, until you go past REARM_R)
const REARM_R = 18;
const TURN_K = 3;          // 1/s: the body's ease toward the facing it wants …
const TURN_MAX = 2.2;      // … capped at this many rad/s (180° in ~1.5 s): Wendell's rates (E129)
const HEAD_MAX = 0.9;      // rad: the head's turn on top of the body's (her scarf tails clear her shoulders to here)

type Gesture = 'none' | 'beckon' | 'tidy' | 'offer';
const GESTURE_S: Record<Gesture, number> = { none: 0, beckon: 2.4, tidy: 2.6, offer: 1.8 };

export class Trader {
  readonly group = new THREE.Group();
  /** body + head + arm: turns about her feet to face you (E129) */
  private readonly figure = new THREE.Group();
  private body = new THREE.Mesh();
  private head = new THREE.Mesh();
  private upper = new THREE.Mesh();
  private fore = new THREE.Mesh();
  private turn = 0;
  private headYaw = 0; private headPitch = 0;
  private glanceT = 0; private glanceYaw = 0; private glancePitch = 0.1;
  private gesture: Gesture = 'none'; private gT = 0;
  private idleT = 6;        // seconds to the next idle tidy
  private offerT = 3;       // seconds to the next "take a look" while you stand at the counter
  private greeted = false;
  /** extra culling: things drawn with her (her counter) hide with her past TRADER_NEAR_R */
  readonly companions: THREE.Object3D[] = [];

  private readonly sky: Sky;

  constructor(sky: Sky) { this.sky = sky; }

  build(): this {
    const mat = lowPolyMaterial(this.sky);
    this.group.name = 'trader';

    // ── body (turns with the figure), head (pivot at the neck), the right arm's upper arm (pivot at the shoulder, hanging
    // along −Y) and forearm (pivot at the elbow): data/traderLook.ts ──
    this.body = new THREE.Mesh(buildKitMesh(TRADER_BODY), mat);
    this.body.castShadow = true; this.body.receiveShadow = true;
    this.head = new THREE.Mesh(buildKitMesh(TRADER_HEAD), mat);
    this.head.position.set(0, NECK, 0.01);
    this.upper = new THREE.Mesh(buildKitMesh(TRADER_UPPER), mat);
    this.upper.position.copy(SHOULDER);
    this.fore = new THREE.Mesh(buildKitMesh(TRADER_FORE), mat);
    this.fore.position.set(-0.03, ELBOW_Y, 0.02);
    this.upper.add(this.fore);

    this.figure.add(this.body, this.head, this.upper);
    this.group.add(this.figure);
    return this;
  }

  /** the head's world position (a future prompt / name tag) */
  headWorld(out: THREE.Vector3): THREE.Vector3 { return out.set(0, NECK + 0.15, 0).applyMatrix4(this.group.matrixWorld); }
  get position(): THREE.Vector3 { return this.group.position; }

  private start(g: Gesture): void { this.gesture = g; this.gT = 0; }
  /** open a hand toward her goods now (the shop opened, a sale: E314 stage 2) */
  offer(): void { this.start('offer'); this.offerT = 5; }

  setNear(near: boolean): void {
    if (near !== this.figure.visible) { this.figure.visible = near; for (const c of this.companions) c.visible = near; }
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
      if (!this.greeted && d < GREET_R && d > FACE_R * 0.6) { this.greeted = true; this.start('beckon'); }
      else if (d >= GREET_R) { this.idleT -= dt; if (this.idleT <= 0) { this.idleT = 8 + (Math.sin(t * 0.83) + 1) * 2; this.start('tidy'); } }
      else if (d < FACE_R) { this.offerT -= dt; if (this.offerT <= 0) { this.offerT = 5 + (Math.sin(t * 1.31) + 1) * 1.5; this.start('offer'); } }
    }

    // ── the figure turns to face you when you come close, and eases back to her counter after (E129) ──
    const toYou = Math.atan2(dx, dz);
    const wantTurn = d < FACE_R && this.gesture !== 'tidy' ? wrap(toYou - bodyYaw) : 0;
    const dTurn = wrap(wantTurn - this.turn) * (1 - Math.exp(-TURN_K * dt));
    this.turn = wrap(this.turn + THREE.MathUtils.clamp(dTurn, -TURN_MAX * dt, TURN_MAX * dt));
    // weight from foot to foot: a slow sway and a small roll at her feet
    const shift = Math.sin(t * 0.42);
    this.figure.rotation.set(0, this.turn, shift * 0.018);
    this.figure.position.x = shift * 0.012;

    // ── the head leads: at you when you're near, else a glance about; down at the goods while she tidies them ──
    let wantYaw: number, wantPitch: number;
    const g = this.gesture, gu = g === 'none' ? 0 : ease(this.gT / GESTURE_S[g]);
    if (g === 'tidy') { wantYaw = -0.25; wantPitch = 0.45; }
    else if (d < GREET_R) {
      wantYaw = THREE.MathUtils.clamp(wrap(toYou - bodyYaw - this.turn), -HEAD_MAX, HEAD_MAX);
      wantPitch = THREE.MathUtils.clamp(-Math.atan2(player.y + 1.6 - (gp.y + NECK + 0.1), Math.max(0.5, d)), -0.4, 0.4);
      if (g === 'offer') { wantYaw += -0.35 * gu; wantPitch += 0.3 * gu; }   // a look down at what she offers
    } else {
      this.glanceT -= dt;
      if (this.glanceT <= 0) {
        this.glanceT = 2 + (Math.sin(t * 1.9) + 1) * 1.8;
        this.glanceYaw = Math.sin(t * 0.41) * 0.75;
        this.glancePitch = Math.sin(t * 0.7) > 0.4 ? 0.35 : 0.05;   // now and then down at the counter
      }
      wantYaw = this.glanceYaw; wantPitch = this.glancePitch;
    }
    wantYaw = THREE.MathUtils.clamp(wantYaw, -HEAD_MAX, HEAD_MAX);
    this.headYaw += (wantYaw - this.headYaw) * Math.min(1, dt * 5);
    this.headPitch += (wantPitch - this.headPitch) * Math.min(1, dt * 5);
    const breathe = Math.sin(t * 1.5 + 0.7);
    this.head.rotation.set(this.headPitch + breathe * 0.02, this.headYaw, Math.sin(t * 0.55) * 0.05 - shift * 0.03);
    this.head.position.y = NECK + breathe * 0.006;
    this.body.scale.set(1, 1 + breathe * 0.006, 1);

    // ── the right arm ──
    // (shoulder: x < 0 swings it forward, z < 0 lifts it out to her right; elbow: x < 0 bends the forearm forward / up)
    let sx = Math.sin(t * 1.1) * 0.05, sz = -0.1, sy = 0, ex = -0.12, lean = 0;
    if (g === 'beckon') {
      // arm up and out, forearm raised, the hand waving her in: "over here"
      sx = -0.55 * gu; sz = -0.1 - 0.65 * gu; sy = 0.5 * gu;
      ex = -0.12 - (1.5 + Math.sin(this.gT * 11) * 0.35) * gu;
    } else if (g === 'tidy') {
      // reach down and forward to the counter, set a thing straight, back
      sx = -0.5 * gu; sz = -0.1 + 0.18 * gu; ex = -0.12 - 0.28 * gu + Math.sin(this.gT * 5) * 0.08 * gu; lean = 0.07 * gu;
    } else if (g === 'offer') {
      // an open hand toward her goods: "take a look"
      sx = -0.7 * gu; sz = -0.1 - 0.25 * gu; sy = 0.3 * gu; ex = -0.12 - 0.35 * gu;
    }
    this.upper.rotation.set(sx, sy, sz);
    this.fore.rotation.set(ex, 0, 0);
    this.figure.rotation.x = lean;   // she leans over the counter to reach it
  }
}

/** 0 → 1 → 0 over a gesture: eased in over its first quarter, out over its last */
function ease(u: number): number {
  const a = Math.min(1, u / 0.25), b = Math.min(1, (1 - u) / 0.25), s = Math.max(0, Math.min(a, b));
  return s * s * (3 - 2 * s);
}

function wrap(a: number): number { return Math.atan2(Math.sin(a), Math.cos(a)); }

