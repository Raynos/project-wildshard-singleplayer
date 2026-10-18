import { Vector3, type Scene } from 'three';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import { containerResources, ownSceneResource, ownSceneTree } from '@wildshard/engine/app/sceneOwnership';
import { Events } from '@wildshard/engine/events/events';
import { CombatPipeline, type CombatTarget } from '@wildshard/engine/combat/pipeline';
import type { TargetHit } from '@wildshard/engine/combat/types';
import { AnimalFactory, type AnimalModel } from '@wildshard/engine/entities/AnimalFactory';
import { Animal } from '@wildshard/engine/entities/AnimalView';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { CreatureBodies } from '@wildshard/engine/physics/creatures';
import { canReach } from '@wildshard/engine/ai/reach';
import { ATTACK_TURN, HURT_ARC } from '@wildshard/engine/ai/hunt';
import type { StrikeData } from '@wildshard/engine/ai/strikeRows';
import { Rng } from '@wildshard/engine/core/rng';
import { admitSpeciesBrains, type BrainedSpecies, type SpeciesBinding } from '../plugin/brain';

/** Initial isolated support is intentionally narrow: declared grounded circling melee bodies only. */
export function practiceCreatureSupport(species: BrainedSpecies, variant: string): { supported: boolean; reason?: string } {
  if (species.flight !== undefined) return { supported: false, reason: 'Flying encounters need an arena flight adapter.' };
  if (species.brain?.archetype !== 'stalker' && species.brain?.archetype !== 'skirmisher')
    return { supported: false, reason: 'This behavior needs an isolated encounter adapter.' };
  if (species.body?.motion !== 'ground' || species.body.actions === undefined || species.body.actions.actions.length === 0)
    return { supported: false, reason: 'This creature has no declared ground attack body.' };
  if (![...species.variants, ...species.spawnOnly ?? []].some(row => row.id === variant))
    return { supported: false, reason: 'That creature variant is not declared.' };
  if (app.species.get(species.kind) === undefined)
    return { supported: false, reason: 'The creature and its look are not loaded in this level.' };
  return { supported: true };
}

export interface PracticeCreatureOptions {
  readonly species: BrainedSpecies;
  readonly strikes: readonly StrikeData[];
  readonly variant: string;
  readonly scene: Scene;
  readonly sky: SkyRig;
  readonly physics: Physics;
  readonly player: Vector3;
  readonly owner: Scope;
  readonly onPlayerDamage?: (damage: number, remaining: number) => void;
  readonly onDamage?: (amount: number, point: Vector3, died: boolean) => void;
  readonly onDeath?: () => void;
  readonly onSound?: (name: string, position: Vector3) => void;
}

/** A real admitted creature with a fresh policy, health and scoped collision bodies for each bout.
 * World combat requests for this exact actor are routed before world damage/death events can fire.
 * Only presentation and collision services are borrowed; quest, loot, save and world AI are never installed. */
export class PracticeCreature {
  readonly targets: Animal[] = [];
  playerHealth = 100;
  private readonly owner: Scope;
  private readonly factory: AnimalFactory;
  private readonly model: AnimalModel;
  private readonly callbacks: SpeciesBinding;
  private readonly options: PracticeCreatureOptions;
  private bout: Scope | null = null;
  private bodies: CreatureBodies<Animal> | null = null;
  private context: ThinkCtx | null = null;
  private events: Events | null = null;
  private elapsed = 0;
  private decisionTime = 0;
  private rng = new Rng(7001);
  private readonly previousPlayer = new Vector3();
  private readonly origin = new Vector3();

  /** Await only before installing the provider; enter/update/raycast remain synchronous. */
  static async create(options: PracticeCreatureOptions): Promise<PracticeCreature> {
    const support = practiceCreatureSupport(options.species, options.variant);
    if (!support.supported) throw new Error(support.reason ?? 'Unsupported practice creature');
    const owner = options.owner.child('practice-creature');
    try {
      const factory = owner.run(() => new AnimalFactory(options.sky));
      await factory.ready;
      if (owner.disposed) throw new Error('Practice creature owner closed during loading');
      const callbacks = admitSpeciesBrains([options.species], options.strikes).bind(options.species.kind);
      const original = owner.run(() => factory.model(options.species.kind, options.variant));
      const model = { ...original, species: { ...original.species, ...options.species, ...callbacks } };
      for (const resource of containerResources(model)) if (!app.assets.isAcquired(resource)) ownSceneResource(resource, owner);
      return new PracticeCreature(options, owner, factory, model, callbacks);
    } catch (error: unknown) { owner.dispose(); throw error; }
  }

  private constructor(options: PracticeCreatureOptions, owner: Scope, factory: AnimalFactory, model: AnimalModel, callbacks: SpeciesBinding) {
    this.options = options; this.owner = owner; this.factory = factory; this.model = model; this.callbacks = callbacks;
    owner.onDispose(() => this.exit());
  }

  enter(at: { x: number; y: number; z: number }): void {
    if (this.owner.disposed) throw new Error('Practice creature has been disposed');
    if (![at.x, at.y, at.z].every(Number.isFinite)) throw new Error('Practice placement must be finite');
    this.exit();
    const scope = this.owner.child('practice-bout'); this.bout = scope;
    this.origin.set(at.x, at.y, at.z); this.elapsed = 0; this.decisionTime = 0; this.playerHealth = 100;
    this.rng = new Rng(7001); this.previousPlayer.copy(this.options.player);
    const events = new Events(), combat = new CombatPipeline(events, scope, () => this.options.physics);
    this.events = events;
    try {
      const variant = this.model.variantDef, scale = this.rng.range(variant.scale[0], variant.scale[1]);
      const rig = scope.run(() => this.factory.instantiate(this.model, this.rng.int(1, 1_000_000)));
      const animal = new Animal(rig, this.model, 7001, scale, `practice.${this.model.kind}`, {
        heightAt: () => at.y, floorBelow: () => at.y, random: () => this.rng.next(), now: () => this.elapsed * 1000,
        hit: request => combat.hit(request),
      });
      animal.levelGround = true; animal.groundHeight = () => at.y; animal.herd = -1;
      animal.attackTurnCap = ATTACK_TURN;
      animal.place(at.x, at.z, Math.atan2(this.options.player.x - at.x, this.options.player.z - at.z), at.y);
      animal.onDamaged = (_body, amount, point, _dir, died) => { animal.hitFlash(); this.options.onDamage?.(amount, point, died); if (died) this.options.onDeath?.(); };
      this.options.scene.add(animal.mesh); ownSceneTree(animal.mesh, scope, app.assets);
      scope.onDispose(() => { animal.hidden = true; animal.alive = false; this.bodies?.remove(animal); animal.retireBody(); animal.mesh.removeFromParent(); });
      this.targets.push(animal);
      const actor = animal.combatActor();
      // Global weapon implementations submit directly; preserve their normal stagger and hit feedback.
      app.combat.routeTarget(scope, actor, request => combat.hit(request));
      const target: CombatTarget = combat.targetPort(actor, animal, velocity => animal.impulse(velocity), () => this.bout === scope);
      app.combat.registerTargets(scope, () => [target], () => this.bout === scope);
      this.bodies = new CreatureBodies(this.options.physics);
      this.context = this.makeContext(animal);
      animal.sampleTerrain(); animal.update(0, 0, true); animal.mesh.updateMatrixWorld(true);
      this.bodies.sync(this.targets, animal.position);
    } catch (error: unknown) { this.exit(); throw error; }
  }

  private makeContext(animal: Animal): ThinkCtx {
    return {
      dt: 0, t: 0, player: this.options.player, playerSpeed: 0, rng: this.rng, calm: false, herd: null, world: {},
      heightAt: () => this.origin.y, waterLevel: () => this.origin.y - 100,
      steer: (body, yaw, speed, turn) => body.setMotion(yaw, speed, turn),
      flight: { steer: () => { throw new Error('Flight is not supported in this encounter'); } },
      pathYaw: (body, x, z) => Math.atan2(x - body.position.x, z - body.position.z),
      // The existing room's WORLD walls and the real creature motor own confinement.
      confine: () => undefined,
      reach: body => canReach(body, this.options.player, this.options.physics),
      claim: () => true, mayAttack: () => true,
      sound: name => this.options.onSound?.(name, animal.position),
      hurt: amount => {
        if (!animal.alive || this.playerHealth <= 0) return;
        const dx = this.options.player.x - animal.position.x, dz = this.options.player.z - animal.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.001 && (Math.sin(animal.yaw) * dx + Math.cos(animal.yaw) * dz) / distance < Math.cos(this.options.species.body?.contact.halfArc ?? HURT_ARC)) return;
        if (!canReach(animal, this.options.player, this.options.physics)) return;
        const damage = Math.max(0, amount); this.playerHealth = Math.max(0, this.playerHealth - damage);
        this.options.onPlayerDamage?.(damage, this.playerHealth);
      },
    };
  }

  update(dt: number): void {
    const animal = this.targets[0], context = this.context;
    if (this.bout === null || animal === undefined || context === null || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt; this.decisionTime += dt;
    context.t = this.elapsed; context.playerSpeed = this.options.player.distanceTo(this.previousPlayer) / dt;
    this.previousPlayer.copy(this.options.player); context.calm = this.playerHealth <= 0;
    if (animal.alive && !animal.stunned) {
      if (this.decisionTime >= 0.1) {
        context.dt = this.decisionTime; this.decisionTime = 0;
        this.callbacks.think(animal, context);
      }
      context.dt = dt; this.callbacks.act(animal, context);
    } else if (animal.stunned) { animal.setMotion(animal.yaw, 0, 1); animal.setStrafe(0); }
    animal.update(dt, this.elapsed, true); animal.mesh.updateMatrixWorld(true);
    this.bodies?.sync(this.targets, animal.position); this.events?.flush('update');
  }

  raycast(origin: Vector3, dir: Vector3, maxDist: number): TargetHit | null {
    const hit = this.bodies?.cast(origin, dir, maxDist);
    return hit === undefined || hit === null ? null : { animal: hit.creature, point: hit.point, distance: hit.distance, headshot: hit.head };
  }

  exit(): void {
    const scope = this.bout; this.bout = null;
    scope?.dispose(); this.targets.length = 0; this.bodies = null; this.context = null; this.events = null;
  }

  dispose(): void { this.exit(); this.owner.dispose(); }
}
