import { Weapon, blocks, type Actor, type App, type EquipContext, type Targets, type WeaponState } from '#engine';
import { MeshBasicMaterial, Vector2, Vector3, type Group, type Mesh } from 'three';
import { FAN_ROW } from './rows';
import { buildFan } from './fanModel';

/** What GUST can push: the level's live creatures, and what a gust does to one beyond the shove (a ray's dive breaks). */
/** The part of a creature GUST touches (an engine `Animal` is one). */
export interface Gustable { readonly alive: boolean; readonly position: Vector3; readonly kind: string; impulse: (velocity: Vector3) => void }
export interface GustPorts<T extends Gustable = Gustable> { animals: () => readonly T[]; actorFor: (animal: { position: Vector3 }) => Actor | null; onGust?: (animal: T) => void }

export const GUST = { range: 13, halfAngle: 0.5, push: 20, lift: 3, damage: 4, cooldown: 1.4 } as const;

/**
 * The war fan (rung 3, custom): SWING is a short arc through the damage pipeline; holding SWING charges a heavy cut;
 * GUST throws a cone of wind that shoves every creature in it (`animal.impulse`) and breaks a drift ray's dive.
 */
export class WarFan extends Weapon {
  override readonly model: Group; override readonly state: WeaponState = { ammo: undefined, magazine: 0, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  override holster = 0; override enabled = true; override adsHeld = false; override aimInfo = null;
  onSwing: ((heavy: boolean) => void) | null = null; onGustCue: (() => void) | null = null;
  gusts = 0;
  private cooldown = 0; private gustCooldown = 0; private swingT = 1; private gustT = 1; private held = 0; private wasHeld = false;
  private readonly leaf: Group; private readonly gust: Mesh;
  private readonly spring = { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 };
  private readonly vm = blocks.viewmodel({ gain: 0.012, clampYaw: 0.12, clampPitch: 0.1, k: 45, c: 11 });
  private readonly contact: ReturnType<typeof blocks.melee>;
  constructor(private readonly app: App, private readonly targets: Targets | null = null, private readonly ports: GustPorts | null = null) {
    super(FAN_ROW); this.contact = blocks.melee(app.combat); this.blocks.vm = this.vm; this.blocks.melee = this.contact;
    const built = buildFan(); this.model = built.model; this.leaf = built.leaf; this.gust = built.gust;
  }
  override get charge(): number { return Math.min(1, this.held / 0.6); }
  override install(ctx: EquipContext): void {
    super.install(ctx);
    this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled);
    this.app.input.bind('heavy', () => { this.swing(true); }, ctx.scope, () => this.enabled);
    this.app.input.bind('far.gust', () => { this.blow(); }, ctx.scope, () => this.enabled);
    ctx.scope.onDispose(() => { this.wasHeld = false; this.held = 0; });
  }
  override tryFire(): void { this.swing(false); }
  private swing(heavy: boolean): void {
    if (this.cooldown > 0 || !this.enabled) return; this.cooldown = heavy ? 0.8 : 0.42; this.swingT = 0;
    this.onSwing?.(heavy);
    const host = this.app.equipmentHost; if (host === null || this.targets === null || this.ports === null) return;
    const from = host.game.camera.position.clone(), dir = new Vector3(); host.game.camera.getWorldDirection(dir);
    const hit = this.targets.raycast(from, dir, 4.5); if (hit?.animal === undefined) return;
    const actor = this.ports.actorFor(hit.animal); if (actor === null) return;
    this.strike(actor, hit.point, dir, from, heavy); this.onFire?.();
  }
  /** One SWING contact: a 4.5 m arc in front of the camera. */
  strike(actor: Actor, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean): boolean {
    const delta = point.clone().sub(from), forward = delta.dot(dir);
    if (forward < 0 || forward > 4.5 || delta.addScaledVector(dir, -forward).length() > 1.4) return false;
    const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], target: actor, amount: heavy ? 26 : 14,
      point, dir, from, weaponId: this.row.id, moveId: heavy ? 'far.fan.heavy' : 'far.fan.swing', surface: 'flesh', ...(heavy ? { stagger: 0.4 } : {}) });
    if (result !== null) this.onHit?.(actor.id, false, result.killed);
    return result !== null;
  }
  /** GUST: every live creature inside the cone is shoved away and up; returns how many it caught. */
  blow(from?: Vector3, dir?: Vector3): number {
    if (this.gustCooldown > 0 || !this.enabled || this.ports === null) return 0;
    this.gustCooldown = GUST.cooldown; this.gustT = 0; this.gusts++; this.onGustCue?.();
    const host = this.app.equipmentHost, eye = from ?? host?.game.camera.position.clone() ?? new Vector3(), look = dir ?? new Vector3(0, 0, -1);
    if (dir === undefined && host !== null) host.game.camera.getWorldDirection(look);
    let caught = 0;
    for (const animal of this.ports.animals()) {
      if (!animal.alive) continue;
      const to = animal.position.clone().sub(eye), d = to.length();
      if (d > GUST.range || d < 1e-3 || to.clone().divideScalar(d).dot(look) < Math.cos(GUST.halfAngle)) continue;
      const push = new Vector3(to.x, 0, to.z).normalize().multiplyScalar(GUST.push * (1 - d / (GUST.range * 1.6)));
      push.y = GUST.lift; animal.impulse(push); caught++;
      const actor = this.ports.actorFor(animal);
      if (actor) this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.far-fan', 'dmg.wind'], target: actor, amount: GUST.damage,
        point: animal.position.clone(), dir: look.clone(), from: eye, weaponId: this.row.id, moveId: 'far.fan.gust', surface: 'flesh' });
      this.ports.onGust?.(animal);
    }
    return caught;
  }
  override update(dt: number): void {
    this.cooldown = Math.max(0, this.cooldown - dt); this.gustCooldown = Math.max(0, this.gustCooldown - dt);
    if (!this.enabled || this.holster > 0.001) { this.wasHeld = false; this.held = 0; }
    else if (this.adsHeld) this.held += dt;
    else if (this.wasHeld) { this.cooldown = 0; this.swing(true); this.held = 0; }
    this.wasHeld = this.enabled && this.holster <= 0.001 && this.adsHeld;
    this.vm.step(this.spring, new Vector2(), dt);
    // presentation: the swing sweeps the fan across, the gust snaps it forward and throws a fading ring
    this.swingT = Math.min(1, this.swingT + dt / 0.32); this.gustT = Math.min(1, this.gustT + dt / 0.45);
    const sweep = Math.sin(this.swingT * Math.PI), snap = Math.sin(Math.min(1, this.gustT * 2) * Math.PI);
    this.model.rotation.set(-0.15 * snap, this.spring.yaw + sweep * 0.9, sweep * 0.5);
    this.model.position.set(-sweep * 0.25, -this.holster * 0.6 + this.charge * 0.04, -snap * 0.12);
    this.leaf.scale.setScalar(1 + this.charge * 0.06);
    const ring = this.gust, material = ring.material;
    ring.visible = this.gustT < 1; ring.scale.setScalar(1 + this.gustT * 5); ring.position.z = -1.4 - this.gustT * 4;
    if (material instanceof MeshBasicMaterial) material.opacity = (1 - this.gustT) * 0.5;
  }
}
