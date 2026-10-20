import type { PracticeContactSurface } from '../plugin/practiceFootContact';
import { ragdollsFor } from '@wildshard/engine/physics/ragdoll';
import { prepareNumericRigidCorpse, validateRigidCorpse } from '@wildshard/engine/physics/rigidCorpse';
import type { NativeCorpseOwner } from '@wildshard/engine/entities/nativeCorpseOwner';
import { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import type { Scope } from '@wildshard/engine/app/scope';
import { GameClock } from '@wildshard/engine/core/clock';
import { FIXED_STEP } from '@wildshard/engine/core/fixedStep';
import { createSimHost, type SimSpawn, type SimHostPorts, type SimValue } from '@wildshard/engine/sim';
import { regionalContinuation } from '@wildshard/engine/sim/snapshot';
import type { AnimalModel, AnimalRig } from '@wildshard/engine/entities/AnimalFactory';
import { variantMods } from '@wildshard/engine/entities/species/registry';
import type { BrainedSpecies, BorrowedSpeciesControl, SpeciesDecisionObservation } from '../plugin/brain';
import { NativeCreaturePose, type NativeCreaturePoseRecipe } from '../plugin/animation';
import { numericCreaturePose } from '../plugin/channelPrograms';
import { practicePoseTransition } from '../plugin/practicePoseContract';
import type { preparePracticeDecision } from './PracticeDecisions';

export interface PracticeNativeSelection {
  /** Logical JSON file in the already verified loaded product. No URL, callback or alternate rig. */
  readonly poseFile: string;
  readonly corpse?: 'rigid';
}
type Decision = Awaited<ReturnType<typeof preparePracticeDecision>>;
interface Options {
  readonly contactSurface?: PracticeContactSurface;
  readonly corpse?: 'rigid';
  readonly scope: Scope;
  readonly ports: Required<Pick<SimHostPorts, 'physics' | 'player' | 'events' | 'combat'>>;
  readonly spawn: SimSpawn;
  readonly species: BrainedSpecies;
  readonly recipe: NativeCreaturePoseRecipe;
  readonly pose: unknown;
  readonly decision: Decision;
  readonly observation: SpeciesDecisionObservation;
}

/** Read the actual instantiated rest hierarchy, not model-space positions guessed into local space. */
export function practiceNativeRecipe(model: AnimalModel, rig: AnimalRig): NativeCreaturePoseRecipe {
  if (model.species.rig !== 'custom' || model.species.postPose !== undefined || model.species.damageMul !== undefined
    || model.species.flight !== undefined) throw new Error('Native practice requires a declared numeric ground rig');
  const ordered = rig.mesh.skeleton.bones;
  if (ordered.length === 0 || ordered.length > 32 || ordered.some(bone => rig.bones[bone.name] !== bone))
    throw new Error('Native practice requires the actual bounded factory skeleton');
  return {
    practice: true, custom: true, deathSplay: false,
    ...(model.species.gait === undefined ? {} : { gait: model.species.gait }),
    ...(model.species.pose === undefined ? {} : { pose: model.species.pose }),
    ...(model.species.rootFlinch === undefined ? {} : { rootFlinch: model.species.rootFlinch }),
    joints: ordered.map((bone, index) => {
      const parent = bone.parent === rig.mesh ? -1 : ordered.findIndex(value => value === bone.parent && value.name === bone.parent.name);
      if (parent >= index || (parent === -1 && bone.parent !== rig.mesh)) throw new Error('Invalid native practice rig hierarchy');
      return { name: bone.name, parent, position: [bone.position.x, bone.position.y, bone.position.z],
        order: bone.rotation.order, scale: [bone.scale.x, bone.scale.y, bone.scale.z] };
    }),
  };
}

/** Exactly AnimalView's native constructor recipe, with no additional physics or damage defaults. */
export function practiceNativeSpawn(model: AnimalModel, seed: number, scale: number,
  at: SimSpawn['at'], yaw: number): SimSpawn {
  const v = model.variantDef, species = model.species;
  return { id: `practice.${model.kind}`, seed, scale, at: { ...at }, yaw,
    spec: { kind: model.kind, label: v.label || species.label, variant: v.id, rarity: v.rarity,
      hp: v.hp ?? species.tuning?.hp ?? (species.aggressive === true ? 100 : 60),
      aggressive: species.aggressive ?? false, dims: model.dims, mods: variantMods(species, v),
      ...(species.lockable === undefined ? {} : { lockable: species.lockable }) } };
}

/** One bounded native practice owner. It borrows the real arena physics/player, owns exactly one actor,
 * one admitted decision/strike control and one NativeCreaturePose. Only fixed() advances those owners.
 * There are no quest rows, persistent flags, reward handlers or world-save registration here. */
export class PracticeNativeActor {
  readonly host;
  readonly actor;
  readonly pose: NativeCreaturePose;
  readonly control: BorrowedSpeciesControl;
  readonly corpse: NativeCorpseOwner | undefined;
  private readonly scope: Scope;
  private readonly clock = new GameClock();

  constructor(options: Options) {
    const brain = options.species.brain;
    if (brain?.archetype !== 'decision' || brain.data.actor === undefined || brain.data.group !== undefined
      || options.species.flight !== undefined || options.species.body?.motion !== 'ground'
      || options.species.body.actions?.actions.length !== 0 || options.recipe.practice !== true)
      throw new Error('Native practice requires one admitted grounded decision actor');
    const animate = numericCreaturePose(options.pose);
    if (practicePoseTransition(animate) === undefined) throw new Error('Native practice requires explicit transition rows');
    const scope = options.scope.child('native-practice'); this.scope = scope; this.corpse = undefined;
    try {
      if (options.corpse !== undefined) {
        validateRigidCorpse(options.spawn.spec.dims.rigidCorpse);
        if (options.spawn.spec.dims.rigidCorpse.posePolicy !== undefined) throw new Error('Native corpse requires animated pose ownership');
      }
      const lease = options.corpse === undefined ? undefined : ragdollsFor(options.ports.physics).reserveNative(scope);
      if (lease === null) throw new Error('Native corpse admission capacity unavailable');
      this.host = createSimHost({ version: 1, id: 'isolated-practice', seed: options.spawn.seed,
        ground: { size: 100, height: options.spawn.at.y },
        player: { at: options.ports.player.position, yaw: options.ports.player.yaw, speed: 0 },
        entities: [options.spawn], quests: [],
        weapon: { id: 'practice.unused', windup: 1, active: 0, recover: 0, cooldown: 0, damage: 0, range: 0,
          shape: { kind: 'arc', radius: 0, halfAngle: 0 }, tags: [] },
      }, { ...options.ports, rapier: options.ports.physics.R, clock: this.clock, scope,
        ground: false, heightAt: () => options.spawn.at.y, creatureBodies: 'page' });
      const actor = this.host.entities.get(options.spawn.id);
      if (actor === undefined) throw new Error('Native practice actor was not materialized');
      this.actor = actor;
      actor.levelGround = true; actor.groundHeight = () => options.spawn.at.y; actor.herd = -1;
      const authority = options.decision({ scope, events: options.ports.events, physics: options.ports.physics,
        player: options.ports.player, groundHeightAt: () => options.spawn.at.y,
        live: body => !scope.disposed && this.host.entities.get(body.entityId) === body,
        fixed: (id, run, owner) => { owner.onDispose(this.host.onStep(id, run)); },
      });
      this.control = authority.bind(actor, brain.data, options.species.body);
      this.control.observe(options.observation); this.control.fighting = true;
      this.pose = new NativeCreaturePose(actor, options.recipe, animate, options.contactSurface);
      actor.bindVolumes(this.pose); this.pose.sampleTerrain(); this.pose.initializePractice();
      if (lease !== undefined) {
        prepareNumericRigidCorpse(options.ports.physics.R, actor.dims.rigidCorpse, this.pose.corpseJoints(), actor.scale);
        this.corpse = this.host.bindNativeCorpse(actor, this.pose, lease); this.pose.bindCorpse(this.corpse);
      }
      this.host.useBodyStep({ after: (_id, _actor, dt) => {
        this.pose.advance(dt, this.clock.now, true); this.pose.publish();
      } });
      scope.onDispose(() => { actor.alive = false; });
    } catch (error: unknown) { scope.dispose(); throw error; }
  }

  /** Existing fixed.pre only. The arena retains its sole physics step. */
  preFixed(): void { if (!this.scope.disposed && this.corpse !== undefined) this.host.preEmbeddedBodies(); }

  /** Called from the arena's existing fixed.post phase, after its one physics/player step. */
  fixed(): void {
    if (this.scope.disposed) return;
    this.host.events.flush('update');
    this.clock.tick(FIXED_STEP); this.host.stepEmbedded(); this.host.events.flush('update');
  }

  /** Diagnostic read includes queued contacts, RNG and the real decision runner, never flushing or ticking. */
  snapshot(): { version: 1; native: string; pose: string; control: SimValue } {
    if (this.scope.disposed) throw new Error('Native practice owner is disposed');
    return { version: 1, native: regionalContinuation(this.host), pose: this.pose.snapshot(), control: this.control.snapshot() };
  }

  /** Explicit placement, not displacement. Ordinary movement, including stagger, never calls this reset. */
  place(at: Readonly<{ x: number; y: number; z: number }>, yaw: number): void {
    if (!this.pose.placementAllowed) throw new Error('Physical native placement is unsupported');
    if (this.scope.disposed || ![at.x, at.y, at.z, yaw].every(Number.isFinite)) throw new Error('Invalid native practice placement');
    const contactPlacement = this.pose.prepareContactPlacement(at, yaw);
    this.actor.place(at.x, at.z, yaw, at.y);
    if (this.actor.motor instanceof CharacterMotor) this.actor.motor.resetAt(this.actor.position);
    this.pose.resetMotionAnchor(contactPlacement);
  }

  dispose(): void {
    const errors: unknown[] = [];
    try { this.scope.dispose(); } catch (error) { errors.push(error); }
    try { this.corpse?.dispose(); } catch (error) { errors.push(error); }
    if (errors.length > 0) throw new AggregateError(errors, 'Native practice cleanup failed', { cause: errors[0] });
  }
}
