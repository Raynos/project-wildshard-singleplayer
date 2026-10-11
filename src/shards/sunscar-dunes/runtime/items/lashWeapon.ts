import type { App } from '@wildshard/engine/app/app';
import { blocks } from '@wildshard/engine/blocks';
import type { EquipContext, EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { Targets } from '@wildshard/engine/combat/types';
import { Weapon, type WeaponState } from '@wildshard/engine/combat/Weapon';
import { CatmullRomCurve3, Mesh, TubeGeometry, Vector2, Vector3, type Group, type Material, type Object3D } from 'three';
import { LashRuntime, type LashSpec, type LashTarget, type LashWorldTarget } from './lash';
import type { LashCord } from './lashView';

/**
 * The lash item as a held weapon with a declared view (SHARD-PLATFORM SF72, a declared item view): the platform's lash
 * runtime (`./lash`, the crack, the second lash, the pull, the stagger, shared with a headless whip) behind a viewmodel
 * whose motion is rows. A light crack is one long, narrow lash to the crosshair; the heavy a double crack. Desktop:
 * Attack and Heavy; touch: a tap cracks, a still hold fills the charge ring and its release throws the double crack.
 *
 * The view: the model held at `view.hold` (the loaded hand's, else the code hand's), sprung on the view's turn; each lash the
 * grip flicks forward (`flick.lift`, `flick.push`), the cord unrolls to the crosshair and falls slack (`flick.drop`,
 * `flick.back`, `flick.loosen`, `flick.sag`); a heavy lash that catches a lever winds a coil round it (`view.wrap`) and
 * holds the cord taut on it. A shard gives its model's parts (`LashParts`) and its rows (`LashView`).
 */

/** The viewmodel's parts a lash weapon moves: the root, the grip that flicks, the coil shown at rest, the thrown cord and where it leaves the hand. */
export interface LashParts {
  readonly root: Group;
  readonly grip: Object3D;
  readonly coil: Object3D;
  readonly lash: LashCord;
  /** the keeper end of the handle in root space, where the lash leaves the hand */
  readonly tip: Vector3;
  /** the model's hand loaded: it takes `hold.hero`, else `hold.code` */
  readonly hero: boolean;
  /** `coil` shows at rest (false: a hero model's own coil stands in for it) */
  readonly restCoil: boolean;
  /** the material of the coil wound round a caught lever */
  readonly wrapMaterial: () => Material;
}

/** The lash weapon's view as rows (metres, seconds, radians). */
export interface LashView {
  /** the model's place in the view: with the hero hand, and with the code hand */
  readonly hold: { readonly hero: readonly [number, number, number]; readonly code: readonly [number, number, number] };
  /** the view spring (`blocks.viewmodel`) */
  readonly spring: { readonly gain: number; readonly clampYaw: number; readonly clampPitch: number; readonly k: number; readonly c: number };
  /**
   * The flick: the grip rises `lift` and pushes `push` as the cord unrolls and settles back as it falls slack; the slack
   * cord's far end drops `drop` and comes back `back` per unit slack; the far end sits `reach - lead` out; the cord's
   * extension loosens by `loosen` × slack; its sag is `sag[0]` + `sag[1]` × slack, `tautSag` when caught.
   */
  readonly flick: { readonly lift: number; readonly push: number; readonly drop: number; readonly back: number; readonly lead: number; readonly loosen: number; readonly sag: readonly [number, number]; readonly tautSag: number; readonly overlap: number };
  /** The wrap round a caught lever: coil radius, height, turns, cord, how long it holds; the helix's samples, tube segments and sides. */
  readonly wrap: { readonly r: number; readonly h: number; readonly turns: number; readonly cord: number; readonly hold: number; readonly samples: number; readonly segments: number; readonly sides: number };
}

/** A lash held as a weapon: the declared crack (`spec`) on the lash runtime, its viewmodel moved by `view`. */
export class LashWeapon extends Weapon {
  override readonly model; override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  onSwing: ((heavy: boolean) => void) | null = null;
  readonly parts: LashParts;
  private readonly app: App; private readonly targets: Targets | null;
  private readonly spec: LashSpec; private readonly view: LashView;
  private readonly contact: ReturnType<typeof blocks.melee>;
  private readonly vm: ReturnType<typeof blocks.viewmodel>;
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private held = 0; private wasHeld = false; private time = 0;
  private readonly from = new Vector3(); private readonly end = new Vector3();
  /** What the lash reacts to in the world when it hits no creature. */
  private crackables: readonly LashWorldTarget[] = [];
  private readonly lash: LashRuntime;
  /** The pull's wrap: the world point the lash caught, how long it holds there, and the coil wound round it. */
  private wrapAt: Vector3 | null = null; private wrapT = 0; private wrapCoil: Mesh | null = null;
  constructor(app: App, targets: Targets | null, o: { readonly row: EquipmentRow; readonly spec: LashSpec; readonly view: LashView; readonly parts: LashParts }) {
    super(o.row); this.app = app; this.targets = targets; this.spec = o.spec; this.view = o.view;
    this.vm = blocks.viewmodel({ ...o.view.spring });
    this.contact = blocks.melee(app.combat); this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    // Each lash: the shared raycast first (it knows the bodies' shapes), then the nearest target whose chest is inside
    // the lane, through the shared combat targets (ENGINE §19), so practice dummies take the crack like creatures; then
    // the world's crackables.
    this.lash = new LashRuntime(o.spec, { source: 'env', hit: req => this.contact.hit(req), world: () => this.crackables, targets: () => this.app.combat.targets(),
      aim: (from, dir) => {
        const host = this.app.equipmentHost; if (host === null) return false;
        this.setAimSource(() => host.player.sampleAimCommand()); this.aimRay(from, dir); return true;
      },
      body: (from, dir, reach) => {
        const hit = this.targets?.raycast(from, dir, reach) ?? null, port = hit === null ? null : this.app.combat.target(hit.animal);
        return hit === null || port === null ? null : { port, point: hit.point };
      },
      fired: () => { this.onFire?.(); }, struck: (id, killed) => { this.onHit?.(id, false, killed); },
      caught: caught => { if (this.lash.heavy) this.wrap(caught.at); } });
    this.parts = o.parts; this.model = o.parts.root;
    this.model.position.set(...(o.parts.hero ? o.view.hold.hero : o.view.hold.code));
  }
  /** The world things the lash can crack. */
  aimAt(crackables: readonly LashWorldTarget[]): void { this.crackables = crackables; }
  override get charge(): number { return Math.min(1, this.held / this.spec.charge); }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.swing(true); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => {
      this.wasHeld = false; this.held = 0; this.lash.cancel();
      if (this.wrapCoil) { this.wrapCoil.removeFromParent(); this.wrapCoil.geometry.dispose(); this.wrapCoil = null; }
    });
  }
  override tryFire(): void { this.swing(false); }
  /** Starts a crack; the lash lands `spec.unroll` s later (and again at `spec.second` for the heavy). */
  swing(heavy: boolean): boolean {
    if (!this.enabled || !this.lash.swing(heavy)) return false;
    this.onSwing?.(heavy); return true;
  }
  /** Winds the lash round a caught lever: a short helix at the point, shown while the wrap holds. */
  private wrap(at: Vector3): void {
    const scene = this.app.equipmentHost?.game.scene; if (!scene) return;
    if (this.wrapCoil === null) {
      const w = this.view.wrap, pts: Vector3[] = [];
      for (let i = 0; i <= w.samples; i++) { const a = (i / w.samples) * Math.PI * 2 * w.turns; pts.push(new Vector3(Math.cos(a) * w.r, (i / w.samples - 0.5) * w.h, Math.sin(a) * w.r)); }
      this.wrapCoil = new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), w.segments, w.cord, w.sides, false), this.parts.wrapMaterial());
      this.wrapCoil.frustumCulled = false; scene.add(this.wrapCoil);
    }
    this.wrapCoil.position.copy(at); this.wrapCoil.visible = true;
    this.wrapAt = at.clone(); this.wrapT = this.view.wrap.hold;
  }
  /** The lash reaches a world crackable inside its lane: the nearest one along the view reacts. */
  crackWorld(from: Vector3, dir: Vector3, reach: number, second: boolean): LashWorldTarget | null { return this.lash.crackWorld(from, dir, reach, second); }
  /** Damage through the pipeline; the heavy's first lash yanks a small creature in, its second staggers a big one (ENGINE §18, §19). */
  strike(target: LashTarget, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean, second = false): boolean { return this.lash.strike(target, point, dir, from, heavy, second); }
  override update(dt: number): void {
    this.time += dt; this.lash.cool(dt);
    const drawn = this.enabled && this.holster <= 0.001;
    if (!drawn) { this.wasHeld = false; this.held = 0; }
    else if (this.adsHeld) this.held += dt;
    else if (this.wasHeld) { this.lash.cooldown = 0; this.swing(true); this.held = 0; }
    this.wasHeld = drawn && this.adsHeld;
    this.model.visible = this.holster < 0.5;
    this.vm.step(this.spring, new Vector2(), dt); this.model.rotation.y = this.spring.yaw;
    this.animate(dt);
  }
  private animate(dt: number): void {
    const { grip, coil, lash, tip } = this.parts, spec = this.spec, k = this.view.flick;
    if (this.wrapT > 0) { this.wrapT -= dt; if (this.wrapT <= 0 && this.wrapCoil) this.wrapCoil.visible = false; }
    if (this.lash.crackT < 0) { lash.mesh.visible = false; coil.visible = this.parts.restCoil; grip.position.set(0, 0, 0); return; }
    const t = this.lash.advance(dt), double = this.lash.heavy;
    if (t < 0) return;
    // the flick: the hand snaps forward on each lash, the lash unrolls to the crosshair, then falls slack
    const local = double && t > spec.second - k.overlap ? t - (spec.second - spec.unroll) : t;
    const ext = Math.min(1, local / spec.unroll), slack = Math.max(0, (local - spec.unroll) / (spec.show - spec.unroll));
    grip.position.set(0, ext < 1 ? k.lift * ext : k.lift * (1 - slack), ext < 1 ? k.push * ext : k.push * (1 - slack));
    coil.visible = false; lash.mesh.visible = true;
    this.from.copy(tip).add(grip.position);
    const reach = double ? spec.heavyReach : spec.reach;
    // the far end sits on the crosshair: the model's origin is offset from the eye, so aim back at the view axis
    this.end.set(-this.model.position.x, -this.model.position.y - slack * k.drop, -reach + k.lead + slack * k.back);
    // caught on a lever: the far end stays on it, taut (the world point through the viewmodel)
    if (this.wrapT > 0 && this.wrapAt !== null) { this.model.updateWorldMatrix(true, false); this.end.copy(this.wrapAt); this.model.worldToLocal(this.end); }
    const taut = this.wrapT > 0;
    lash.shape(this.from, this.end, taut ? 1 : Math.min(1, ext * (1 - slack * k.loosen)), taut ? k.tautSag : k.sag[0] + slack * k.sag[1], this.time);
  }
}
