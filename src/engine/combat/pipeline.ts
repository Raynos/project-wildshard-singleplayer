import type { Vector3 } from 'three';
import type { Scope } from '../app/scope';
import type { Events } from '../events/events';
import type { Physics } from '../physics/Physics';
import { lineOfSight } from '../physics/query';

export type CombatTag = `${string}.${string}`;
export type StringKey = string;
export interface DeathCause { kind: string; label: StringKey; text?: StringKey }
export interface HealthAttributes { health: number; maxHealth: number; damageTakenMul?: number; incomingCap?: number }
/** Simulation port. The legacy creature adapter owns flinch/ragdoll presentation until the AI migration. */
export interface Actor {
  readonly id: string;
  readonly tags: readonly CombatTag[];
  readonly state: readonly CombatTag[];
  readonly attributes: HealthAttributes;
  readonly alive: boolean;
  onDamageRequest?: (req: DamageRequest) => void;
  applyDamage: (req: DamageRequest) => boolean;
  isHeadshot?: (req: DamageRequest) => boolean;
  damageMul?: (req: DamageRequest) => number;
}
export interface DamageRequest {
  source: Actor | 'env'; sourceTags: readonly CombatTag[]; target: Actor; amount: number;
  point: Vector3; dir: Vector3; surface?: string; weaponId?: string; moveId?: string;
  headshot?: boolean; stagger?: number; knockback?: number; throughWalls?: boolean;
  from?: Vector3; distance?: number; scale?: number; cause?: DeathCause; toast?: StringKey;
}
export interface DamageDealt { req: DamageRequest; dealt: number; killed: boolean }
export interface DamageRuleDef {
  id: string; order: number;
  when: { sourceTags?: readonly CombatTag[]; targetTags?: readonly CombatTag[]; weaponTags?: readonly CombatTag[]; targetState?: readonly CombatTag[] };
  op: 'cap' | 'add' | 'mul' | 'negate' | 'override'; value: number;
}
declare module '../events/maps' {
  interface EventMap {
    'damage.dealt': DamageDealt;
    'actor.died': { actor: Actor; req: DamageRequest };
    'player.died': { cause?: DeathCause };
    'player.respawned': { at: Vector3; checkpoint: boolean };
  }
  interface AskMap {
    'damage.modify': [DamageRequest | null, DamageRequest | null];
    'death.checkpoint': [{ cause?: DeathCause } | boolean, boolean];
  }
}
const matches = (tags: readonly CombatTag[], pattern: CombatTag): boolean =>
  pattern.endsWith('.*') ? tags.some((tag) => tag.startsWith(pattern.slice(0, -1))) : tags.includes(pattern);
const any = (tags: readonly CombatTag[], patterns: readonly CombatTag[] | undefined): boolean =>
  patterns === undefined || patterns.some((pattern) => matches(tags, pattern));
const playerTarget = (req: DamageRequest): boolean => matches(req.target.tags, 'actor.player');
const hostileSource = (req: DamageRequest): boolean => any(req.sourceTags, ['creature.*', 'boss.*', 'elite.*', 'add.*']);

/** One ordered damage pipeline; every source keeps its own base formula and rounding. */
export class CombatPipeline {
  private readonly events: Events;
  private readonly physics: () => Physics | null;
  constructor(events: Events, scope: Scope, physics: () => Physics | null = () => null) {
    this.events = events; this.physics = physics;
    events.answer('damage.modify', (req) => req !== null && playerTarget(req) && matches(req.target.state, 'state.death-fade') ? null : req, scope, { order: 0 });
    events.answer('damage.modify', (req) => {
      if (req === null || !matches(req.target.tags, 'actor.creature')) return req;
      const mul = req.target.attributes.damageTakenMul ?? 1;
      if (mul === 1 || (req.headshot ?? req.target.isHeadshot?.(req) ?? false)) return req;
      return { ...req, amount: Math.max(1, Math.round(req.amount * mul)) };
    }, scope, { order: 40 });
    // R7 remains an adapter to today's species/elite hook until each brain migrates.
    events.answer('damage.modify', (req) => {
      if (req?.target.damageMul === undefined) return req;
      return { ...req, amount: Math.max(1, Math.round(req.amount * req.target.damageMul(req))) };
    }, scope, { order: 50 });
  }
  playerRules(scope: Scope, { target, bossGod = false, capExempt = [] }: { target?: Actor; bossGod?: boolean; capExempt?: readonly string[] } = {}): void {
    const applies = (req: DamageRequest): boolean => playerTarget(req) && (target === undefined || target === req.target);
    if (bossGod) this.events.answer('damage.modify', (req) => req !== null && applies(req) && any(req.sourceTags, ['boss.*', 'elite.*', 'add.*']) ? null : req, scope, { order: 1 });
    this.events.answer('damage.modify', (req) => req !== null && applies(req) && hostileSource(req)
      && !matches(req.sourceTags, 'legacy.player-rules-bypass') && matches(req.target.state, 'guard.dodge') && matches(req.target.state, 'state.dodging') ? null : req, scope, { order: 10 });
    this.events.answer('damage.modify', (req) => {
      if (req === null || !applies(req) || !hostileSource(req) || matches(req.sourceTags, 'legacy.player-rules-bypass')
        || capExempt.some((kind) => req.sourceTags.some((tag) => tag === kind || tag === `creature.${kind}`))) return req;
      return { ...req, amount: Math.min(req.amount, req.target.attributes.incomingCap ?? Infinity) };
    }, scope, { order: 90 });
  }
  rule(def: DamageRuleDef, scope: Scope): void {
    this.events.answer('damage.modify', (req) => {
      if (req === null || !any(req.sourceTags, def.when.sourceTags) || !any(req.target.tags, def.when.targetTags)
        || !any(req.target.state, def.when.targetState) || !any(req.sourceTags, def.when.weaponTags)) return req;
      if (def.op === 'negate') return null;
      const amount = def.op === 'cap' ? Math.min(req.amount, def.value) : def.op === 'add' ? req.amount + def.value
        : def.op === 'mul' ? req.amount * def.value : def.value;
      return { ...req, amount };
    }, scope, { order: def.order });
  }
  hit(input: DamageRequest): DamageDealt | null {
    if (!input.target.alive) return null;
    // Raycast/weapon scratch vectors are reused; queued listeners must see this hit's contact frame.
    const req: DamageRequest = { ...input, point: input.point.clone(), dir: input.dir.clone(),
      ...(input.from === undefined ? {} : { from: input.from.clone() }),
      sourceTags: input.source === 'env' ? [...input.sourceTags] : [...input.sourceTags, ...input.source.tags, ...input.source.state] };
    const physics = this.physics();
    if (req.from !== undefined && !req.throughWalls && !matches(req.sourceTags, 'through.walls') && !matches(req.sourceTags, 'cover.checked')
      && physics !== null && !lineOfSight(physics, req.from, req.point)) return null;
    req.target.onDamageRequest?.(req);
    const modified = this.events.ask('damage.modify', req);
    if (modified === null) return null;
    const killed = modified.target.applyDamage(modified);
    const dealt = { req: modified, dealt: modified.amount, killed };
    this.events.emit('damage.dealt', dealt);
    if (killed) this.events.emit('actor.died', { actor: modified.target, req: modified });
    return dealt;
  }
}
