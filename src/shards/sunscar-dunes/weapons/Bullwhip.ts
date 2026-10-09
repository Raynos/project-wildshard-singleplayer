import type { App } from '@wildshard/engine/app/app';
import { blocks } from '@wildshard/engine/blocks';
import type { EquipContext } from '@wildshard/engine/combat/Equipment';
import type { Targets } from '@wildshard/engine/combat/types';
import { Weapon, type WeaponState } from '@wildshard/engine/combat/Weapon';
import { CatmullRomCurve3, Mesh, TubeGeometry, Vector2, Vector3 } from 'three';
import { WHIP_ROW } from './rows';
import { WHIP_ITEM, WHIP_MOVES, WHIP_TIMING } from '../data/items';
import { braidedMaterial, buildWhipModel, type WhipParts } from './whipModel';
import { LashRuntime, lashSpec, type LashTarget, type LashWorldTarget } from '@wildshard/game/systems/items/lash';

/** The wrap round a caught lever (metres, seconds): coil radius, height, turns, cord, how long it holds. */
const WRAP = { r: 0.06, h: 0.24, turns: 4, cord: 0.018, hold: 0.9 } as const;

/** The crack's numbers: reach, width, damage, cooldowns and charge are the declared item row's (data/items.ts); the lash's timing is the whip's own (`pull` is the yank's speed, m/s, on a creature of `pullMaxHp` or less). */
export const CRACK = lashSpec(WHIP_ITEM, WHIP_TIMING, WHIP_MOVES);

/**
 * The bullwhip (rung 3, `extends Weapon`): a light crack is one long, narrow lash to the crosshair; the heavy is a
 * double crack whose second lash staggers a creature. Desktop: Attack = Mouse0 / F, Heavy = Mouse2 (inherited from
 * `weapon.melee`). Touch: a tap cracks, a still hold fills the charge ring and its release throws the double crack.
 */
export class Bullwhip extends Weapon {
  override readonly model; override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  onSwing: ((heavy: boolean) => void) | null = null;
  readonly parts: WhipParts;
  private readonly app: App; private readonly targets: Targets | null;
  private readonly contact: ReturnType<typeof blocks.melee>;
  private readonly vm = blocks.viewmodel({ gain: 0.012, clampYaw: 0.12, clampPitch: 0.1, k: 46, c: 11 });
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private held = 0; private wasHeld = false; private time = 0;
  private readonly from = new Vector3(); private readonly end = new Vector3();
  /** Levers and braziers the lash reacts to when it hits no creature (C3). */
  private crackables: readonly LashWorldTarget[] = [];
  /** The crack itself: the platform's lash runtime on the declared row (`@wildshard/game/systems/items/lash`), shared with the headless whip. */
  private readonly lash: LashRuntime;
  /**
   * The pull's wrap (after the check pass: the board showed no lash round the crank): the world point the lash caught,
   * how long it holds there, and a braided coil wound round it in the world while it holds.
   */
  private wrapAt: Vector3 | null = null; private wrapT = 0; private wrapCoil: Mesh | null = null;
  constructor(app: App, targets: Targets | null = null) {
    super(WHIP_ROW); this.app = app; this.targets = targets;
    this.contact = blocks.melee(app.combat); this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    // Each lash: the shared raycast first (it knows the bodies' shapes), then the nearest target whose chest is inside
    // the lane, through the shared combat targets (`app.combat.targets()`, ENGINE §19), so the Practice Arena's
    // dummies take the crack like creatures; then the levers and braziers.
    this.lash = new LashRuntime(CRACK, { source: 'env', hit: req => this.contact.hit(req), world: () => this.crackables, targets: () => this.app.combat.targets(),
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
    this.parts = buildWhipModel(); this.model = this.parts.root;
    // mockup D: the fist whole at the right, above the DODGE / JUMP discs, the coil beside it on the left, the centre
    // clear (loop 3 tune G: half a metre out, so the generated glove reads a hand's size and nothing hides it)
    this.model.position.set(this.parts.glove === null ? 0.08 : 0.1, this.parts.glove === null ? -0.17 : -0.095, this.parts.glove === null ? -0.38 : -0.5); // round 1: lower
  }
  /** The world things the lash can crack (the windlass crank, the braziers). */
  aimAt(crackables: readonly LashWorldTarget[]): void { this.crackables = crackables; }
  override get charge(): number { return Math.min(1, this.held / CRACK.charge); }
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
  /** Starts a crack; the lash lands `CRACK.unroll` s later (and again at `CRACK.second` for the heavy). */
  swing(heavy: boolean): boolean {
    if (!this.enabled || !this.lash.swing(heavy)) return false;
    this.onSwing?.(heavy); return true;
  }
  /** Winds the lash round a caught lever: a short braided helix at the point, shown while the wrap holds. */
  private wrap(at: Vector3): void {
    const scene = this.app.equipmentHost?.game.scene; if (!scene) return;
    if (this.wrapCoil === null) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2 * WRAP.turns; pts.push(new Vector3(Math.cos(a) * WRAP.r, (i / 40 - 0.5) * WRAP.h, Math.sin(a) * WRAP.r)); }
      this.wrapCoil = new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), 80, WRAP.cord, 5, false), braidedMaterial());
      this.wrapCoil.frustumCulled = false; scene.add(this.wrapCoil);
    }
    this.wrapCoil.position.copy(at); this.wrapCoil.visible = true; // wound round the crank's upright
    this.wrapAt = at.clone(); this.wrapT = WRAP.hold;
  }
  /** The lash reaches a lever or a brazier bowl inside its lane: the nearest one along the view reacts. */
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
    const { grip, coil, lash, tip } = this.parts;
    if (this.wrapT > 0) { this.wrapT -= dt; if (this.wrapT <= 0 && this.wrapCoil) this.wrapCoil.visible = false; }
    if (this.lash.crackT < 0) { lash.mesh.visible = false; coil.visible = this.parts.hd === null; grip.position.set(0, 0, 0); return; }
    const t = this.lash.advance(dt), double = this.lash.heavy;
    if (t < 0) return;
    // The flick: the hand snaps forward on each lash, the lash unrolls to the crosshair, then falls slack.
    const local = double && t > CRACK.second - 0.08 ? t - (CRACK.second - CRACK.unroll) : t;
    const ext = Math.min(1, local / CRACK.unroll), slack = Math.max(0, (local - CRACK.unroll) / (CRACK.show - CRACK.unroll));
    grip.position.set(0, ext < 1 ? 0.03 * ext : 0.03 * (1 - slack), ext < 1 ? -0.04 * ext : -0.04 * (1 - slack));
    coil.visible = false; lash.mesh.visible = true;
    this.from.copy(tip).add(grip.position);
    const reach = double ? CRACK.heavyReach : CRACK.reach;
    // The far end sits on the crosshair: the model's origin is offset from the eye, so aim back at the view axis.
    this.end.set(-this.model.position.x, -this.model.position.y - slack * 1.5, -reach + 0.42 + slack * 2);
    // caught on a lever: the far end stays on it, taut (the model's frame: the world point through the viewmodel)
    if (this.wrapT > 0 && this.wrapAt !== null) { this.model.updateWorldMatrix(true, false); this.end.copy(this.wrapAt); this.model.worldToLocal(this.end); }
    const taut = this.wrapT > 0;
    lash.shape(this.from, this.end, taut ? 1 : Math.min(1, ext * (1 - slack * 0.35)), taut ? 0.05 : 0.25 + slack * 0.4, this.time);
  }
}
