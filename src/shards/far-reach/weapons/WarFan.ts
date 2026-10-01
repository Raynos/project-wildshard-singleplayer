import { Weapon, blocks, type Actor, type Targets, type TargetAnimal, type WeaponState, type App, type EquipContext } from '#engine';
import { Vector2, Vector3, type Group } from 'three';
import { FAN_ROW } from './rows';
import { buildFan } from './fanModel';

/** Anything GUST can push: a creature body with the engine's impulse verb. */
export interface Gustable { readonly position: Vector3; readonly alive: boolean; impulse: (velocity: Vector3) => void }

export const GUST = { range: 10, cosHalfAngle: Math.cos((50 * Math.PI) / 180), push: 17, lift: 2.5, cooldown: 1.1 } as const;
export const SWING = { reach: 4.2, light: 14, heavy: 26 } as const;

/**
 * The war fan (rung 3, `extends Weapon`): SWING (attack, held = heavy) cuts through the melee block; GUST (`far.gust`)
 * throws a cone of wind that gives every creature in it an impulse, which carries ground creatures off island edges and
 * flings the drift ray back up and away.
 */
export class WarFan extends Weapon {
  override readonly model: Group = buildFan();
  override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  onSwing: ((heavy: boolean) => void) | null = null;
  onGust: ((from: Vector3, dir: Vector3, pushed: number) => void) | null = null;
  private cooldown = 0; private gustCooldown = 0; private swingT = 0; private wasHeld = false; private held = 0;
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm = blocks.viewmodel({ gain: 0.01, clampYaw: 0.1, clampPitch: 0.1, k: 50, c: 12 });
  private readonly contact: ReturnType<typeof blocks.melee>;
  private readonly rest = this.model.rotation.clone();
  constructor(private readonly app: App, private readonly targets: Targets | null = null,
    private readonly actorFor: (animal: TargetAnimal) => Actor | null = () => null, private readonly gustables: () => readonly Gustable[] = () => []) {
    super(FAN_ROW); this.contact = blocks.melee(app.combat); this.blocks.vm = this.vm; this.blocks.melee = this.contact;
  }
  override get charge(): number { return Math.min(1, this.held / 0.6); }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.swing(true); }, ctx.scope, () => this.enabled);
    this.app.input.bind('far.gust', () => { this.gustFromCamera(); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => { this.wasHeld = false; this.held = 0; });
  }
  override tryFire(): void { this.swing(false); }
  private swing(heavy: boolean): void {
    if (this.cooldown > 0 || !this.enabled) return; this.cooldown = heavy ? 0.75 : 0.38; this.swingT = heavy ? 0.4 : 0.25;
    this.onSwing?.(heavy);
    const host = this.app.equipmentHost; if (host === null || this.targets === null) return;
    const from = host.game.camera.position.clone(), dir = new Vector3(); host.game.camera.getWorldDirection(dir);
    const hit = this.targets.raycast(from, dir, SWING.reach); if (hit?.animal === undefined) return;
    const actor = this.actorFor(hit.animal); if (actor === null) return; this.strike(actor, hit.point, dir, from, heavy); this.onFire?.();
  }
  strike(actor: Actor, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean): void {
    if (point.distanceTo(from) > SWING.reach + 0.5) return;
    const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.war-fan', 'dmg.melee'], target: actor, amount: heavy ? SWING.heavy : SWING.light,
      point, dir, from, weaponId: this.row.id, moveId: heavy ? 'far.fan.heavy' : 'far.fan.swing', surface: 'flesh' });
    if (result !== null) this.onHit?.(actor.id, false, result.killed);
  }
  private gustFromCamera(): void {
    const host = this.app.equipmentHost; if (host === null) return;
    const dir = new Vector3(); host.game.camera.getWorldDirection(dir); this.gust(host.game.camera.position.clone(), dir);
  }
  /** The cone push: returns how many bodies it moved (0 while cooling down). */
  gust(from: Vector3, dir: Vector3): number {
    if (this.gustCooldown > 0 || !this.enabled) return 0; this.gustCooldown = GUST.cooldown; this.swingT = 0.3;
    const to = new Vector3(); let pushed = 0;
    for (const body of this.gustables()) {
      if (!body.alive) continue;
      to.copy(body.position).sub(from); const d = to.length(); if (d > GUST.range || d < 1e-3) continue;
      to.divideScalar(d); if (to.dot(dir) < GUST.cosHalfAngle) continue;
      const falloff = 1 - (d / GUST.range) * 0.5;
      body.impulse(new Vector3(to.x, 0, to.z).normalize().multiplyScalar(GUST.push * falloff).setY(GUST.lift)); pushed++;
    }
    this.onGust?.(from, dir, pushed); return pushed;
  }
  override update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt); this.gustCooldown = Math.max(0, this.gustCooldown - dt); this.swingT = Math.max(0, this.swingT - dt);
    if (!this.enabled || this.holster > 0.001) { this.wasHeld = false; this.held = 0; }
    else if (this.adsHeld) this.held += dt;
    else if (this.wasHeld) { this.cooldown = 0; this.swing(true); this.held = 0; }
    this.wasHeld = this.enabled && this.holster <= 0.001 && this.adsHeld;
    this.vm.step(this.spring, new Vector2(), dt);
    const sweep = Math.sin(Math.min(1, this.swingT / 0.3) * Math.PI);
    this.model.rotation.set(this.rest.x - sweep * 0.5, this.rest.y + this.spring.yaw + sweep * 0.6, this.rest.z + sweep * 0.9);
    this.model.visible = this.holster < 0.999;
  }
}
