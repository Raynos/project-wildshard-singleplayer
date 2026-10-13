import type { WeaponContactTarget } from '@wildshard/engine/combat/contactWeapon';
import type { App } from '@wildshard/engine/app/app';
import type { EquipContext, EquipmentRow } from '@wildshard/engine/combat/Equipment';
import type { CombatTarget } from '@wildshard/engine/combat/pipeline';
import type { Targets } from '@wildshard/engine/combat/types';
import { HeldContactWeapon } from '@wildshard/game/plugin/weaponFamily';
import { Vector3, type Group, type Mesh, type Object3D } from 'three';
import { lashRuntime, type LashRuntime, type LashSpec, type LashWorldTarget } from './lash';
import type { LashCord } from './lashView';
import type { LashView } from '../../data/whip';

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
  /** a new coil to wind round a caught lever (its helix baked, `generators/lash.ts` wrapGeometry) */
  readonly wrapCoil: () => Mesh;
}

/** A lash held as a weapon: the declared crack (`spec`) on the shared contact family's rows, its viewmodel moved by `view`. */
export class LashWeapon extends HeldContactWeapon<CombatTarget> {
  override readonly model;
  readonly parts: LashParts;
  private readonly targets: Targets | null;
  private readonly spec: LashSpec; private readonly view: LashView;
  private time = 0;
  private readonly from = new Vector3(); private readonly end = new Vector3();
  /** What the lash reacts to in the world when it hits no creature. */
  private crackables: readonly LashWorldTarget[] = [];
  protected readonly moves: LashRuntime;
  /** The pull's wrap: the world point the lash caught, how long it holds there, and the coil wound round it. */
  private wrapAt: Vector3 | null = null; private wrapT = 0; private wrapCoil: Mesh | null = null;
  constructor(app: App, targets: Targets | null, o: { readonly row: EquipmentRow; readonly spec: LashSpec; readonly view: LashView; readonly parts: LashParts }) {
    super(app, o.row, o.view.spring, o.spec.charge); this.targets = targets; this.spec = o.spec; this.view = o.view;
    // Each lash: the shared raycast first (it knows the bodies' shapes), then the nearest target whose chest is inside
    // the lane, through the shared combat targets (ENGINE §19), so practice dummies take the crack like creatures; then
    // the world's crackables.
    this.moves = lashRuntime(o.spec, { source: 'env', hit: req => this.contact.hit(req), world: () => this.crackables, targets: () => this.app.combat.targets(),
      aim: (from, dir) => this.aim(from, dir),
      body: (from, dir, reach) => {
        const hit = this.targets?.raycast(from, dir, reach) ?? null, port = hit === null ? null : this.app.combat.target(hit.animal);
        return hit === null || port === null ? null : { port, point: hit.point };
      },
      fired: () => { this.onFire?.(); }, struck: (id, killed) => { this.onHit?.(id, false, killed); },
      caught: caught => { if (this.moves.move === 1) this.wrap(caught.at); } });
    this.parts = o.parts; this.model = o.parts.root;
    this.model.position.set(...(o.parts.hero ? o.view.hold.hero : o.view.hold.code));
  }
  /** The world things the lash can crack. */
  aimAt(crackables: readonly LashWorldTarget[]): void { this.crackables = crackables; }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    ctx.scope.onDispose(() => {
      this.moves.cancel();
      if (this.wrapCoil) { this.wrapCoil.removeFromParent(); this.wrapCoil.geometry.dispose(); this.wrapCoil = null; }
    });
  }
  /** Starts a crack; the lash lands `spec.unroll` s later (and again at `spec.second` for the heavy). */
  swing(heavy: boolean): boolean {
    if (!this.enabled || !this.moves.swing(heavy ? 1 : 0)) return false;
    this.onSwing?.(heavy); return true;
  }
  /** Winds the lash round a caught lever: a short helix (baked) at the point, shown while the wrap holds. */
  private wrap(at: Vector3): void {
    const scene = this.app.equipmentHost?.game.scene; if (!scene) return;
    if (this.wrapCoil === null) { this.wrapCoil = this.parts.wrapCoil(); this.wrapCoil.frustumCulled = false; scene.add(this.wrapCoil); }
    this.wrapCoil.position.copy(at); this.wrapCoil.visible = true;
    this.wrapAt = at.clone(); this.wrapT = this.view.wrap.hold;
  }
  /** The lash reaches a world crackable inside its lane: the nearest one along the view reacts. */
  crackWorld(from: Vector3, dir: Vector3, reach: number, second: boolean): LashWorldTarget | null { return this.moves.crackWorld(from, dir, reach, second); }
  /** Damage through the pipeline; the heavy's first lash yanks a small creature in, its second staggers a big one (ENGINE §18, §19). */
  strike(target: WeaponContactTarget, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean, second = false): boolean { return this.moves.strike(target, heavy ? 1 : 0, second ? 1 : 0, point, dir, from); }
  override update(dt: number): void {
    this.time += dt; this.stepHeld(dt);
    this.model.visible = this.holster < 0.5; this.model.rotation.y = this.spring.yaw;
    this.animate(dt);
  }
  private animate(dt: number): void {
    const { grip, coil, lash, tip } = this.parts, spec = this.spec, k = this.view.flick;
    if (this.wrapT > 0) { this.wrapT -= dt; if (this.wrapT <= 0 && this.wrapCoil) this.wrapCoil.visible = false; }
    if (this.moves.t < 0) { lash.mesh.visible = false; coil.visible = this.parts.restCoil; grip.position.set(0, 0, 0); return; }
    const t = this.moves.advance(dt), double = this.moves.move === 1;
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
