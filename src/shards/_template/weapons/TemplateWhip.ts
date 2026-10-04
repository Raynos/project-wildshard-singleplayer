import { Weapon, blocks, type Actor, type Targets, type TargetAnimal, type WeaponState, type App, type EquipContext } from '@wildshard/engine';
import { Group, Mesh, CylinderGeometry, MeshStandardMaterial, Vector2, Vector3 } from 'three';
import { WHIP_ROW } from './rows';
/** A custom lane weapon composes the same public viewmodel and contact blocks as kit families. */
export class TemplateWhip extends Weapon {
  override readonly model = new Group(); override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  onSwing: ((heavy: boolean) => void) | null = null;
  private cooldown = 0; private readonly app: App; private readonly targets: Targets | null; private readonly actorFor: (animal: TargetAnimal) => Actor | null;
  private wasHeld = false;
  private held = 0;
  override get charge(): number { return Math.min(1, this.held / 0.6); }
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm = blocks.viewmodel({ gain: 0.01, clampYaw: 0.1, clampPitch: 0.1, k: 50, c: 12 });
  private readonly contact: ReturnType<typeof blocks.melee>;
  constructor(app: App, targets: Targets | null = null, actorFor: (animal: TargetAnimal) => Actor | null = () => null) { super(WHIP_ROW); this.app = app; this.targets = targets; this.actorFor = actorFor; this.contact = blocks.melee(app.combat);
    this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    this.model.add(new Mesh(new CylinderGeometry(0.025, 0.04, 0.8, 6), new MeshStandardMaterial({ color: 0x565656, flatShading: true })));
    this.model.position.set(0.28, -0.35, -0.6); this.model.rotation.z = -0.3;
  }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.swing(true); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => { this.wasHeld = false; this.held = 0; });
  }
  override tryFire(): void { this.swing(false); }
  private swing(heavy: boolean): void {
    if (this.cooldown > 0 || !this.enabled) return; this.cooldown = heavy ? 0.8 : 0.4;
    this.onSwing?.(heavy);
    const host = this.app.equipmentHost; if (host === null || this.targets === null) return;
    const from = host.game.camera.position.clone(), dir = new Vector3(); host.game.camera.getWorldDirection(dir);
    const hit = this.targets.raycast(from, dir, 5); if (hit?.animal === undefined) return;
    const actor = this.actorFor(hit.animal); if (actor === null) return; this.strike(actor, hit.point, dir, from, heavy); this.onFire?.();
  }
  strike(actor: Actor, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean): void {
    const delta = point.clone().sub(from), forward = delta.dot(dir);
    if (forward < 0 || forward > 5 || delta.addScaledVector(dir, -forward).length() > 0.6) return;
    const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.template-whip', 'dmg.melee'], target: actor, amount: heavy ? 30 : 18,
      point, dir, from, weaponId: this.row.id, moveId: heavy ? 'template.whip.heavy' : 'template.whip.light', surface: 'flesh' });
    if (result !== null) this.onHit?.(actor.id, false, result.killed);
    if (heavy && result !== null && actor.alive) this.app.effects?.apply(actor, 'effect.poison');
  }
  override update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.enabled || this.holster > 0.001) { this.wasHeld = false; this.held = 0; }
    else if (this.adsHeld) this.held += dt;
    else if (this.wasHeld) { this.cooldown = 0; this.swing(true); this.held = 0; }
    this.wasHeld = this.enabled && this.holster <= 0.001 && this.adsHeld;
    this.vm.step(this.spring, new Vector2(), dt); this.model.rotation.y = this.spring.yaw;
  }
}
