import { parseObservationColumnsV2,type ObservationColumnV2 } from '@wildshard/format/scriptObservationColumnsV2';
import type { Scope } from '../app/scope';
import type { AnimalSim } from '../entities/AnimalSim';
import type { GrazerBrain } from '../ai/grazer';
import type { DayCycleClock } from '../world/dayCycle';

/** Both page and native population environments lend these SAME live fields.
 * grassHeightAt is the installed field owner's query, not an authored callback. */
export interface V2EnvironmentColumns {
  readonly playerCrouched: boolean; readonly playerFwdX: number; readonly playerFwdZ: number;
  readonly playerMounted: boolean; readonly playerHealth01: number;
  readonly light: number; readonly storm: boolean;
  readonly wind: { readonly x: number; readonly z: number; readonly strength: number };
  readonly grassHeightAt: (x: number,z: number) => number;
}
export interface V2ActorColumnSlot {
  readonly group: string; readonly slot: number; readonly identity: string;
  readonly actor: AnimalSim | null;
}
type Herd = Pick<GrazerBrain<AnimalSim>,'cx' | 'cz' | 'trust' | 'alert' | 'stallionState' | 'mode' | 'stallion'>;
/** These are concrete borrowed owners, resolved by the existing actor authority
 * before capture. This resolver never allocates, adopts or indexes a body. */
export interface V2ColumnOwners {
  readonly scope: Scope; readonly self: V2ActorColumnSlot;
  readonly player: { readonly position: Readonly<{ x: number; z: number }> };
  readonly observed: ReadonlyMap<number,AnimalSim>;
  readonly t: number; readonly dt: number;
  readonly environment?: V2EnvironmentColumns;
  readonly clock?: Pick<DayCycleClock,'hour' | 'dayPhase' | 'night'>;
  readonly weather?: { readonly stormActive: boolean };
  readonly herds?: readonly { readonly group: string; readonly slot: number; readonly owner: Herd | null }[];
  readonly taming?: { readonly phase: string; readonly companion: AnimalSim | null } | null;
  readonly mount?: { readonly mounted: boolean; readonly actor: AnimalSim | null } | null;
}
function finite(value: number): number { if (!Number.isFinite(value)) throw new Error('Non-finite observation column');return value; }
function need<T>(value: T | undefined,kind: string): T { if (value === undefined) throw new Error(`Missing observation ${kind} owner`);return value; }

/** Detached columns at the original decision slot. No scheduler, body/RNG/save
 * owner or cached world frame lives here. In particular, keeper grass at:self
 * is sampled at the ACTOR, while an absent actor retains the original zero. */
export class ObservationColumnsV2 {
  private readonly rows: readonly ObservationColumnV2[];
  private readonly scope: Scope;
  constructor(input: unknown,scope: Scope) { this.scope = scope;this.rows = parseObservationColumnsV2(input); }
  capture(owners: V2ColumnOwners): readonly { readonly name: string; readonly id: number; readonly value: number }[] {
    if (owners.scope !== this.scope || this.scope.disposed || this.scope.disposing) throw new Error('Retired observation owner');
    const self = owners.self, actor = self.actor;
    if (owners.observed.size > 256 || self.group.length === 0 || !Number.isInteger(self.slot) || self.slot < 0 || (actor !== null && actor.entityId !== self.identity)
      || (actor === null && self.identity !== '')) throw new Error('Stale observation actor slot');
    const observed = new Map<AnimalSim,number>();
    for (const [handle,body] of owners.observed) {
      if (!Number.isInteger(handle) || handle < 1 || handle > 0x7fffffff || observed.has(body) || body.entityId.length === 0) throw new Error('Invalid observed actor identity');
      observed.set(body,handle);
    }
    const identity = (body: AnimalSim | null): number => body === null ? 0 : need(observed.get(body),'actor identity');
    const herds = owners.herds ?? [];
    if (herds.length > 64 || new Set(herds.map(row => JSON.stringify([row.group,row.slot]))).size !== herds.length) throw new Error('Ambiguous observation herd loan');
    // Resolve the complete suffix before invoking any native grass query.
    const prepared = this.rows.map(row => {
      const source = row.source;
      if (source.kind === 'environment' || source.kind === 'grass' || source.kind === 'player' || source.kind === 'wind') need(owners.environment,'environment');
      if (source.kind === 'clock') need(owners.clock,'clock');
      if (source.kind === 'weather') need(owners.weather,'weather');
      if (source.kind === 'taming') need(owners.taming,'taming');
      if (source.kind === 'mount') need(owners.mount,'mount');
      const herd = source.kind === 'herd' || source.kind === 'herd-state'
        ? need(herds.find(value => value.group === source.group && value.slot === source.slot),'herd').owner : null;
      if (source.kind === 'herd' && source.field === 'stallion' && herd !== null) identity(herd.stallion);
      if (source.kind === 'taming' && source.field === 'companion') identity(owners.taming?.companion ?? null);
      if (source.kind === 'mount' && source.field === 'actor') identity(owners.mount?.actor ?? null);
      return { row,herd };
    });
    return prepared.map(({ row,herd }) => {
      const source = row.source;let value: number;
      switch (source.kind) {
        case 'environment': value = Number(need(owners.environment,'environment')[source.field]);break;
        case 'wind': value = need(owners.environment,'environment').wind[source.field];break;
        case 'player': {
          const env = need(owners.environment,'environment');
          const fields = { crouched: Number(env.playerCrouched),forwardX: env.playerFwdX,forwardZ: env.playerFwdZ,mounted: Number(env.playerMounted),healthShare: env.playerHealth01 };
          value = fields[source.field];break;
        }
        case 'grass': {
          const point = source.at === 'self' ? actor?.position : owners.player.position;
          value = point === undefined ? 0 : need(owners.environment,'environment').grassHeightAt(finite(point.x),finite(point.z));break;
        }
        case 'clock': {
          const clock = need(owners.clock,'clock');
          value = source.field === 'dayPhase' ? clock.dayPhase === 'night' ? 2 : clock.dayPhase === 'dusk' ? 1 : 0 : clock[source.field];
          if (source.field === 'hour' && (value < 0 || value >= 24)) throw new Error('Observation hour outside day');break;
        }
        case 'time': value = owners[source.field];if (source.field === 'dt' && value < 0) throw new Error('Negative observation dt');break;
        case 'weather': value = Number(need(owners.weather,'weather').stormActive);break;
        case 'actor': {
          const field = source.field;
          if (actor === null) { value = field === 'attackPhase' ? -1 : 0;break; }
          if (field === 'lastHitValid' || field === 'lastHitSeconds') {
            const stamp = actor.lastHitT;
            if (stamp !== -Infinity && !Number.isFinite(stamp)) throw new Error('Invalid actor hit stamp');
            value = field === 'lastHitValid' ? Number(stamp !== -Infinity) : stamp === -Infinity ? 0 : stamp;
          } else if (field === 'x' || field === 'y' || field === 'z') value = actor.position[field];
          else if (field === 'hpShare') { if (actor.maxHp <= 0) throw new Error('Invalid actor maximum health');value = actor.hp/actor.maxHp; }
          else value = Number(actor[field]);break;
        }
        case 'herd': {
          const field = source.field;
          value = herd === null ? 0 : field === 'beaten' ? Number(herd.stallionState === 'beaten')
            : field === 'fleeing' ? Number(herd.mode === 'flee') : field === 'sameActor' ? Number(actor !== null && herd.stallion === actor)
            : field === 'stallion' ? identity(herd.stallion) : herd[field];break;
        }
        case 'herd-state': value = herd === null ? 0 : source.states.find(code => code.state === herd.stallionState)?.value ?? 0;break;
        case 'taming': value = source.field === 'bonded' ? Number(owners.taming?.phase === 'bonded') : identity(owners.taming?.companion ?? null);break;
        case 'mount': value = source.field === 'mounted' ? Number(owners.mount?.mounted === true) : identity(owners.mount?.actor ?? null);break;
        default: throw new Error('Unknown observation source');
      }
      return { name: row.name,id: row.id,value: finite(value) };
    });
  }
}
