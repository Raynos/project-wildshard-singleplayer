import { Weapon, type Actor, type DamageDealt, app, melee, type TargetAnimal, type TargetHit, type Move, type SwordMoveSet, type SwordFraming } from '#engine';
import type { Vector3, Quaternion } from 'three';
import type { EquipmentRow } from '#game';

export interface ViewmodelFeel {
  lag: { gain: number; clampYaw: number; clampPitch: number; k: number; c: number; posYaw: number; posPitch: number };
  bob: { x: number; y: number; rz: number; rx: number };
  sway: { ax: number; fx: number; ay: number; fy: number };
  fovHip: number;
}
export interface MeleeProfile extends EquipmentRow {
  family: 'melee'; parent?: string;
  damage: number; reach: number; swingScale: number;
  portraitPullX: number; framing: SwordFraming; feel: ViewmodelFeel;
  moves?: SwordMoveSet;
  cooldown: number; comboGap: number; chainLag: number; heavyCharge: number; chargeBlend: number;
  lunge: { range: number; heavyRange: number; cone: number; stop: number; speed: number; minTime: number; maxTime: number };
  sweep: { rays: number; extensions: readonly number[]; step: number; maxSamples: number; maxHits: number };
  trail: { samples: number; subdivisions: number };
  dodgeKick: { kick: number; k: number; c: number }; armFollow: number;
}

interface ContactTarget extends TargetAnimal { combatActor?: () => Actor }
const adapters = new WeakMap<TargetAnimal, Actor>();
/** Native creatures expose their pipeline actor; custom practice targets keep their own damage behavior. */
export function meleeActor(target: ContactTarget): Actor {
  if (target.combatActor) return target.combatActor();
  const cached = adapters.get(target);
  if (cached) return cached;
  const actor: Actor = {
    id: `target.${target.kind}`, tags: ['actor.creature', `creature.${target.kind}`], state: [],
    attributes: { health: Infinity, maxHealth: Infinity },
    get alive() { return target.alive; },
    applyDamage: (req) => target.applyDamage(req.amount, req.point, req.dir),
  };
  adapters.set(target, actor); return actor;
}

/** Shared contact family. Swept blades and the spear retain distinct clocks and viewmodel strategies. */
export abstract class Melee extends Weapon {
  protected readonly profile: MeleeProfile;
  constructor(profile: MeleeProfile) {
    super(profile); this.profile = profile;
    this.attributes['damage'] = profile.damage; this.attributes['heavyDamageMul'] = 1;
    this.blocks.melee = melee(app.combat);
  }
  protected contact(target: TargetAnimal, amount: number, point: Vector3, dir: Vector3, from: Vector3,
    moveId: string, coverChecked = false): DamageDealt | null {
    return app.combat.hit({ source: 'env', sourceTags: ['actor.player', this.row.id, 'dmg.melee',
      ...(coverChecked ? ['cover.checked' as const] : [])], target: meleeActor(target), amount,
      point, dir, from, weaponId: this.row.id, moveId });
  }
  protected onSwingStart(_move: Move): void { /* Rung-2 weapons add a behavior at the same input edge. */ }
  protected afterMoveHit(_move: Move, _hit: TargetHit, _killed: boolean): void { /* Optional subclass bookkeeping. */ }
  protected pickMove(_input: 'attack' | 'heavy'): Move | null { return null; }
  protected moveDamage(move: Move): number { return Math.round((this.attributes['damage'] ?? this.profile.damage) * move.damage); }
  protected poseExtra(_pos: Vector3, _q: Quaternion, _dt: number): void { /* Optional extra weapon pose. */ }
}
