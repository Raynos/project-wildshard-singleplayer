import { GameClock } from '../../../../src/engine/core/clock';
import { FIXED_STEP } from '../../../../src/engine/core/fixedStep';
import type { Scope } from '../../../../src/engine/app/scope';
import { createSimHost, type SimHostPorts } from '../../../../src/engine/sim';
import { regionalContinuation } from '../../../../src/engine/sim/snapshot';
import { BurstFlyerBrain, type BurstFlyerPorts } from '../../../../src/engine/ai/burstFlyer';
import type { AnimalSim } from '../../../../src/engine/entities/AnimalSim';
import { strikeFromData } from '../../../../src/engine/ai/strikeRows';
import { NativeCreaturePose } from '../../../../src/game/plugin/animation';
import { numericCreaturePose } from '../../../../src/game/plugin/channelPrograms';
import { MEDUSA_FLIGHT, MEDUSA_SCALE, MEDUSA_STRIKE, medusaBrain } from '../medusaBehavior';
import { medusaNativeRecipe, type loadMedusaNativeSource } from './medusaNativeSource';
import { medusaNativeClips } from './medusaNativeClips';

type Parts = Awaited<ReturnType<typeof loadMedusaNativeSource>>;
type Ports = Required<Pick<SimHostPorts, 'physics' | 'player' | 'events' | 'combat'>>;
type Combat = Pick<BurstFlyerPorts<AnimalSim>, 'reach' | 'claim' | 'hurt' | 'shove'>;

/** Actual-source borrowed-world installation candidate, deliberately not exported to Arena.
 * Publishes the living flying capsule through the native host; retains unsafe death. No admission,
 * reward, persistence, physical corpse, extra player, extra world or second physics step.
 * Geometry remains owned by the caller. Only fixed() advances the candidate's one clock. */
export class MedusaBorrowedOwner {
  readonly host;
  readonly actor;
  readonly pose;
  readonly brain;
  readonly admission = false;
  private readonly scope: Scope;
  private readonly clock = new GameClock();

  constructor(parts: Parts, owner: Scope, ports: Ports, combat: Combat,
    home?: { x: number; z: number; r: number; y: number }) {
    const origin = home ?? { x: 0, z: 0, r: 3, y: 1.6 };
    this.scope = owner.child('medusa-borrowed-candidate');
    const scope = this.scope;
    try {
      const recipe = medusaNativeRecipe(parts);
      const clips = medusaNativeClips(recipe.joints.map(joint => joint.name));
      this.host = createSimHost({ version: 1, id: 'isolated-practice', seed: 17,
        ground: { size: 100, height: 0 },
        player: { at: ports.player.position, yaw: ports.player.yaw, speed: 0 },
        entities: [{ id: 'practice.pearlglass-medusa', seed: 17, scale: MEDUSA_SCALE,
          at: { x: origin.x, y: origin.y, z: origin.z }, yaw: 0,
          spec: { kind: 'pearlglass-medusa', label: 'Pearlglass Medusa', variant: 'pearlglass-medusa',
            rarity: 'common', hp: 60, aggressive: true, dims: parts.dims, flight: { ...MEDUSA_FLIGHT },
            mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 25, relentless: false } } }],
        quests: [], weapon: { id: 'practice.unused', windup: 1, active: 0, recover: 0, cooldown: 0,
          damage: 0, range: 0, shape: { kind: 'arc', radius: 0, halfAngle: 0 }, tags: [] },
      }, { ...ports, scope, clock: this.clock, rapier: ports.physics.R,
        ground: false, heightAt: () => 0, creatureBodies: 'page' });
      const actor = this.host.entities.get('practice.pearlglass-medusa');
      if (actor === undefined) throw new Error('Medusa candidate did not materialize');
      this.actor = actor;
      this.pose = new NativeCreaturePose(actor, recipe, numericCreaturePose(clips));
      actor.bindVolumes(this.pose); this.pose.sampleTerrain(); this.pose.initializePractice();
      const behavior = medusaBrain(origin);
      if (behavior.pattern !== 'burst') throw new Error('Medusa requires burst flight');
      this.brain = new BurstFlyerBrain(actor, behavior, home, strikeFromData(MEDUSA_STRIKE));
      const brainPorts: BurstFlyerPorts<AnimalSim> = { ...combat, dt: FIXED_STEP,
        player: ports.player.position, calm: false,
        flight: { steer: (body, yaw, speed, altitude, turn) => { body.fly(yaw, speed, altitude, turn); } } };
      this.host.useBodyStep({
        before: () => { this.brain.think(brainPorts); this.brain.act(brainPorts); },
        after: (_id, _body, dt) => { this.pose.advance(dt, this.clock.now, true); this.pose.publish(); },
      });
      scope.onDispose(() => { actor.alive = false; });
    } catch (error: unknown) { scope.dispose(); throw error; }
  }

  /** Caller owns event phase flushing and its sole physics step. */
  fixed(): void {
    if (this.scope.disposed) return;
    this.clock.tick(FIXED_STEP); this.host.stepEmbedded();
  }

  /** Read-only diagnostic, including real native host continuation. */
  snapshot(): { native: ReturnType<typeof regionalContinuation>; pose: ReturnType<NativeCreaturePose['snapshot']>; brain: ReturnType<BurstFlyerBrain<AnimalSim>['snapshot']> } {
    if (this.scope.disposed) throw new Error('Medusa candidate is disposed');
    return { native: regionalContinuation(this.host), pose: this.pose.snapshot(), brain: this.brain.snapshot() };
  }

  dispose(): void { this.scope.dispose(); }
}
