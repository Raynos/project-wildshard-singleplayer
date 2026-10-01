import { Weapon, blocks, type Actor, type Targets, type TargetAnimal, type WeaponState, type App, type EquipContext } from '#engine';
import { BoxGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, RingGeometry, Vector2, Vector3 } from 'three';
import { FAN_ROW } from './rows';

/** Something a GUST can throw: where it is, its combat actor, and how to push its body. */
export interface GustTarget { readonly position: Vector3; readonly actor: Actor | null; readonly push: (dir: Vector3, power: number) => void }
export const FAN = { swingRange: 4, swingDamage: 16, swingCooldown: 0.42, gustRange: 10, gustHalfAngle: 0.62, gustDamage: 6, gustCooldown: 1.4, gustPower: 14 } as const;

/** The fan's leaf and ribs: a 150° teal fan on dark wood ribs (the mockup's gale fan). */
export function buildFan(): Group {
  const fan = new Group(), wood = new MeshStandardMaterial({ color: 0x4a2e1c, flatShading: true }), spread = 2.6, ribs = 9;
  const leaf = new Mesh(new RingGeometry(0.07, 0.31, 18, 1, Math.PI / 2 - spread / 2, spread),
    new MeshStandardMaterial({ color: 0x2f8f8a, emissive: 0x0b2a28, flatShading: true, side: DoubleSide, roughness: 0.6 }));
  fan.add(leaf);
  for (let i = 0; i < ribs; i++) {
    const a = Math.PI / 2 - spread / 2 + spread * i / (ribs - 1), rib = new Mesh(new BoxGeometry(0.008, 0.33, 0.006), wood);
    rib.position.set(Math.cos(a) * 0.165, Math.sin(a) * 0.165, 0.004); rib.rotation.z = a - Math.PI / 2; fan.add(rib);
  }
  const grip = new Mesh(new BoxGeometry(0.03, 0.1, 0.03), wood); grip.position.y = -0.04; fan.add(grip);
  return fan;
}

/** Rung 3 (custom): SWING is a short melee lane; GUST throws every foe in a cone back along the view, off edges too. */
export class WarFan extends Weapon {
  override readonly model = new Group(); override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  onSwing: ((gust: boolean) => void) | null = null;
  private cooldown = 0; private gustCooldown = 0; private swingT = 0; private gustT = 0;
  private readonly app: App; private readonly targets: Targets | null; private readonly actorFor: (animal: TargetAnimal) => Actor | null;
  private readonly foes: () => readonly GustTarget[];
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm = blocks.viewmodel({ gain: 0.01, clampYaw: 0.1, clampPitch: 0.1, k: 50, c: 12 });
  private readonly contact: ReturnType<typeof blocks.melee>;
  private readonly fan = buildFan();
  constructor(app: App, targets: Targets | null = null, actorFor: (animal: TargetAnimal) => Actor | null = () => null, foes: () => readonly GustTarget[] = () => []) {
    super(FAN_ROW); this.app = app; this.targets = targets; this.actorFor = actorFor; this.foes = foes; this.contact = blocks.melee(app.combat);
    this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    this.model.add(this.fan); this.fan.scale.setScalar(0.45); this.model.position.set(0.13, -0.25, -0.55); this.model.rotation.set(-0.2, -0.35, -0.25);
  }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.gust(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('farReach.gust', () => { this.gust(); }, ctx.scope, () => this.enabled);
  }
  /** SWING: a slash along the view. */
  override tryFire(): void {
    if (this.cooldown > 0 || !this.enabled) return; this.cooldown = FAN.swingCooldown; this.swingT = 0.28; this.onSwing?.(false);
    const host = this.app.equipmentHost; if (host === null || this.targets === null) return;
    const from = host.game.camera.position.clone(), dir = new Vector3(); host.game.camera.getWorldDirection(dir);
    const hit = this.targets.raycast(from, dir, FAN.swingRange); if (hit?.animal === undefined) return;
    const actor = this.actorFor(hit.animal); if (actor === null) return; this.slash(actor, hit.point, dir, from); this.onFire?.();
  }
  slash(actor: Actor, point: Vector3, dir: Vector3, from: Vector3): boolean {
    const delta = point.clone().sub(from), forward = delta.dot(dir);
    if (forward < 0 || forward > FAN.swingRange || delta.addScaledVector(dir, -forward).length() > 0.8) return false;
    const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.far-reach-fan', 'dmg.melee'], target: actor, amount: FAN.swingDamage,
      point, dir, from, weaponId: this.row.id, moveId: 'farReach.fan.swing', surface: 'flesh' });
    if (result !== null) this.onHit?.(actor.id, false, result.killed);
    return result !== null;
  }
  /** GUST: every foe in the cone takes a little damage and is thrown back (the push is the plugin's: it knows edges). */
  gust(): number {
    if (this.gustCooldown > 0 || !this.enabled) return 0; this.gustCooldown = FAN.gustCooldown; this.gustT = 0.45; this.onSwing?.(true);
    const host = this.app.equipmentHost; if (host === null) return 0;
    const from = host.game.camera.position.clone(), dir = new Vector3(); host.game.camera.getWorldDirection(dir);
    return this.blow(from, dir);
  }
  /** The cone test and the push, apart from the camera so a test can drive it. Returns how many foes it threw. */
  blow(from: Vector3, dir: Vector3): number {
    const flat = new Vector3(dir.x, 0, dir.z); if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1); flat.normalize();
    let thrown = 0;
    for (const foe of this.foes()) {
      const to = foe.position.clone().sub(from), d = Math.hypot(to.x, to.z); if (d > FAN.gustRange || d < 1e-3) continue;
      const along = (to.x * flat.x + to.z * flat.z) / d; if (along < Math.cos(FAN.gustHalfAngle)) continue;
      const push = new Vector3(to.x / d, 0.25, to.z / d).normalize(), power = FAN.gustPower * (1 - 0.5 * d / FAN.gustRange);
      if (foe.actor !== null) {
        const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.far-reach-fan', 'dmg.melee'], target: foe.actor, amount: FAN.gustDamage,
          point: foe.position.clone(), dir: push, from, weaponId: this.row.id, moveId: 'farReach.fan.gust', surface: 'flesh', knockback: power, throughWalls: true });
        if (result !== null) this.onHit?.(foe.actor.id, false, result.killed);
      }
      foe.push(push, power); thrown++;
    }
    return thrown;
  }
  override update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt); this.gustCooldown = Math.max(0, this.gustCooldown - dt);
    this.swingT = Math.max(0, this.swingT - dt); this.gustT = Math.max(0, this.gustT - dt);
    this.vm.step(this.spring, new Vector2(), dt);
    const swing = Math.sin(this.swingT / 0.28 * Math.PI), gust = Math.sin(this.gustT / 0.45 * Math.PI);
    this.model.rotation.y = -0.35 + this.spring.yaw + swing * 0.9;
    this.model.rotation.z = -0.25 - swing * 0.6;
    this.model.position.z = -0.55 - gust * 0.1;
    this.fan.rotation.x = -gust * 0.9;
  }
}
