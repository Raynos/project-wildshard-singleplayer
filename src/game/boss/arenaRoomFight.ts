/** The arena room's sim half (P1-E4.2): its row-driven fight and the brain each body runs, over whichever host lends its
 *  body, players and room (`ArenaFightPorts`): the page, or a SimHost's every player (arenaRoomNative.ts). Its looks are the
 *  view half's (arenaRoomView.ts `arenaRoomViews`), passed in; nothing here draws. */
import { Vector3 } from 'three';
import * as v from 'valibot';
import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import { canReach, type ReachActor } from '@wildshard/engine/ai/reach';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { StrikeRunner, type StrikeContext } from '@wildshard/engine/ai/strikes';
import type { CombatPipeline, CombatTag, DamageRequest } from '@wildshard/engine/combat/pipeline';
import type { Physics } from '@wildshard/engine/physics/Physics';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { parseBossProfile } from '@wildshard/format/bossProfiles';
import { CreatureStrikeSchema } from '@wildshard/format/creatures';
import { ArenaRoomSpeciesControlSchema } from '@wildshard/format/speciesBookRows';
import { bossFight, type BossViewBinding, type PhasedBossBody, type PhasedBossBrain, type PhasedBossFight, type PhasedBossPorts } from '../plugin/bossPhase';

const finite = v.pipe(v.number(), v.finite());
const rowId = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const triple = v.tuple([finite,finite,finite]);

/** The body of an arena fight, the page's or a host's: what the strike rows and the reach test read of it. */
export type ArenaFightBody = PhasedBossBody & StrikeContext['actor'] & ReachActor & { readonly kind: string; readonly label: string };
/** Built-in body binding for row-driven arena fights. Species adapters observe
 * the shared fight's brain rather than installing a shard decision owner. */
type SpeciesBody = Parameters<NonNullable<SpeciesDef['think']>>[0];
const arenaBrains = new WeakMap<object, PhasedBossBrain<SpeciesBody>>();
export function arenaRoomBrain(actor: SpeciesBody): PhasedBossBrain<SpeciesBody> | undefined { return arenaBrains.get(actor); }
/** Hand a body its fight's brain, for the species' forwards. */
export function bindArenaBrain(actor: SpeciesBody, brain: PhasedBossBrain<SpeciesBody>): void { arenaBrains.set(actor, brain); }

/** Row-selected controls over the original arena brain; no other fight/body
 * owner is installed. Nullish defaults retain authored order and lazy height. */
export function arenaRoomSpeciesControl(input:unknown):Pick<SpeciesDef,'think'|'act'|'damageMul'>{
  const rows=v.parse(ArenaRoomSpeciesControlSchema,input),initial=rows.initialize;
  if(new Set(initial.defaults.map(row=>row.field)).size!==initial.defaults.length
    ||initial.defaults.some(row=>row.field===initial.flag))throw new Error('Invalid arena species initialization');
  return{
    think:(actor,context)=>{
      const memory=actor.mem;
      if(memory[initial.flag]!==1){memory[initial.flag]=1;
        for(const row of initial.defaults)memory[row.field]??=row.source==='height'?context.heightAt(actor.position.x,actor.position.z):row.value;
      }
      arenaRoomBrain(actor)?.think(actor,context);
    },
    act:(actor,context)=>{arenaRoomBrain(actor)?.act(actor,context);},
    damageMul:(actor,point)=>arenaRoomBrain(actor)?.damageMul(actor,point)??1,
  };
}

export const ArenaFightPageSchema: v.GenericSchema<BoundedArenaFightInput, BoundedArenaFight> = v.strictObject({
  profile: v.unknown(), body: rowId, identity: v.picklist(['runtime', 'declared']),
  add: v.strictObject({ kind: rowId, variant: rowId, memory: v.record(rowId, finite) }),
  damageTag: v.custom<CombatTag>(value => typeof value === 'string' && /^[a-z][a-zA-Z0-9.-]*\.[a-zA-Z0-9.*-]+$/u.test(value)),
  maxZ: finite, reward: triple, respawn: triple, yaw: finite,
  presentation: v.strictObject({ reach: finite, ringMax: finite, beamRadius: finite }),
  cuts: v.pipe(v.array(CreatureStrikeSchema), v.minLength(1), v.maxLength(16)),
  hazards: v.record(rowId, CreatureStrikeSchema),
});
/** The fight's world from wherever it runs. `target` is whom the fight deals with right now; a lone player always. */
export interface ArenaFightTarget {
  readonly position: Vector3; readonly dash: (x: number, z: number, seconds: number) => void;
  /** The target's health in the combat pipeline; null: nobody to hurt yet. */
  readonly health: DamageRequest['target'] | null;
}
export interface ArenaFightPorts<A extends ArenaFightBody> {
  /** The walkable room the fight piles, drains and seals. */
  readonly room: { readonly floorHeightAt: (x: number, z: number) => number | undefined; readonly addSand: (x: number, z: number, r: number, dh: number, cap: number) => void;
    readonly clearSand: () => void; readonly drainSand: (dt: number, rate: number) => void; readonly inChamber: (p: Vector3) => boolean; readonly setSealed: (on: boolean) => void };
  readonly body: { readonly spawn: () => A | null; readonly retire: (actor: A) => void; readonly bind: (actor: A, brain: PhasedBossBrain<A>) => void; readonly ready: (actor: A, floorY: number) => void };
  readonly spawnAdd: PhasedBossPorts<A>['spawnAdd'];
  readonly target: () => ArenaFightTarget;
  readonly combat: Pick<CombatPipeline, 'hit'>;
  readonly physics: () => Physics | null;
  readonly rng: () => number;
  readonly feed: (line: string) => void;
}
/** The fight a row describes: the same strikes, hazards and hurts for whichever host lends its ports. */
export function arenaRoomFight<A extends ArenaFightBody>(ports: ArenaFightPorts<A>, rows: BoundedArenaFight, views: (presentation: BoundedArenaFight['presentation']) => BossViewBinding): {
  phased: PhasedBossFight<A>; script: BossScript; body: () => A | null; devKill: () => void;
} {
  const profile = parseBossProfile(rows.profile);
  if (profile.pattern !== 'arena') throw new Error('Arena room requires an arena boss profile');
  const { room, body, combat, physics } = ports, cuts = rows.cuts.map(strikeFromData), hazards = new Map(Object.entries(rows.hazards).map(([id, row]) => [id, strikeFromData(row)]));
  const contacts = new StrikeRunner();
  const phased = bossFight<A>(profile, {
    arena: { floorAt: room.floorHeightAt, pile: (x, z, r, dh, cap) => { room.addSand(x, z, r, dh, cap); },
      clear: () => { room.clearSand(); }, drain: (dt, rate) => { room.drainSand(dt, rate); },
      inArena: p => room.inChamber(p) && p.z < rows.maxZ, seal: on => { room.setSealed(on); } },
    body: { spawn: () => body.spawn(), retire: actor => { body.retire(actor); }, bind: (actor, brain) => { body.bind(actor, brain); }, ready: (actor, floorY) => { body.ready(actor, floorY); } },
    spawnAdd: ports.spawnAdd,
    player: { get position() { return ports.target().position; }, dash: (x, z, seconds) => { ports.target().dash(x, z, seconds); } },
    hurt: (amount, throughWalls = false) => {
      const actor = phased.body(), { position, health } = ports.target();
      if (actor === null || health === null || (!throughWalls && !canReach(actor, position, physics()))) return;
      combat.hit({ source: 'env', sourceTags: [rows.damageTag, 'feel.blow', 'cover.checked'], target: health, amount,
        point: actor.position, dir: new Vector3(), cause: { kind: actor.kind, label: actor.label } });
    },
    cut: (i, actor, hit) => {
      const strike = cuts[i] ?? cuts[0], { position } = ports.target();
      return strike !== undefined && contacts.contact(strike, { actor, target: position, hit, canReach: () => canReach(actor, position, physics()) });
    },
    hazard: (id, from, hit, options) => {
      const strike = hazards.get(id); if (strike === undefined) throw new Error('Missing arena hazard strike');
      const noop = (): void => undefined, { position } = ports.target();
      const actor = { position: from, scale: 1, yaw: 0, alive: true, dims: { bodyY: 1.2, bodyRadius: .1 },
        headWorld: (out: Vector3) => out.copy(from).add(new Vector3(0, 1.2, 0)), startAttack: noop, cancelAttack: noop, setMotion: noop };
      contacts.contact(strike, { actor, target: position, hit, ...options, canReach: () => canReach(actor, position, physics()) });
    },
    rng: ports.rng, feed: ports.feed,
    views: views(rows.presentation),
    rewardPoint: () => new Vector3().fromArray(rows.reward),
    respawnPoint: () => ({ pos: new Vector3().fromArray(rows.respawn), yaw: rows.yaw }),
  });
  return { phased, script: phased.script, body: phased.body, devKill: phased.kill };
}

type BoundedArenaFightInput = BoundedArenaFight;
interface BoundedArenaFightFields {
    profile: unknown;
    body: string;
    identity: "runtime" | "declared";
    add: {
        kind: string;
        variant: string;
        memory: Record<string, number>;
    };
    damageTag: `${string}.${string}`;
    maxZ: number;
    reward: [
        number,
        number,
        number
    ];
    respawn: [
        number,
        number,
        number
    ];
    yaw: number;
    presentation: {
        reach: number;
        ringMax: number;
        beamRadius: number;
    };
    cuts: {
        id: string;
        shape: {
            kind: "arc";
            radius: number;
            halfAngle: number;
            yawOffset?: number;
        } | {
            kind: "lane";
            length: number;
            width: number;
        } | {
            kind: "ring";
            inner: number;
            outer: number;
        } | {
            kind: "wedge";
            length: number;
            halfAngle: number;
        } | {
            kind: "point";
            radius: number;
            exclusive?: boolean;
        } | {
            kind: "sphere";
            radius: number;
        };
        windup: number;
        active: number;
        recover: number;
        cooldown: number;
        range: number | null;
        damage: number;
        tags: `${string}.${string}`[];
        weight: {
            kind: "constant";
            value: number;
        } | {
            kind: "horizontal-distance";
            above: number;
            far: number;
            near: number;
        };
        units?: "world" | "actor";
        alternatives?: ({
            kind: "arc";
            radius: number;
            halfAngle: number;
            yawOffset?: number;
        } | {
            kind: "lane";
            length: number;
            width: number;
        } | {
            kind: "ring";
            inner: number;
            outer: number;
        } | {
            kind: "wedge";
            length: number;
            halfAngle: number;
        } | {
            kind: "point";
            radius: number;
            exclusive?: boolean;
        } | {
            kind: "sphere";
            radius: number;
        })[];
        motion?: {
            speed?: number;
            delay?: number;
            track?: "none" | "lead" | "follow";
            overshoot?: number;
            skid?: number;
        };
        eligibility?: {
            maxDy?: number;
            jumpDodges?: boolean;
        };
    }[];
    hazards: Record<string, {
            id: string;
            shape: {
                kind: "arc";
                radius: number;
                halfAngle: number;
                yawOffset?: number;
            } | {
                kind: "lane";
                length: number;
                width: number;
            } | {
                kind: "ring";
                inner: number;
                outer: number;
            } | {
                kind: "wedge";
                length: number;
                halfAngle: number;
            } | {
                kind: "point";
                radius: number;
                exclusive?: boolean;
            } | {
                kind: "sphere";
                radius: number;
            };
            windup: number;
            active: number;
            recover: number;
            cooldown: number;
            range: number | null;
            damage: number;
            tags: `${string}.${string}`[];
            weight: {
                kind: "constant";
                value: number;
            } | {
                kind: "horizontal-distance";
                above: number;
                far: number;
                near: number;
            };
            units?: "world" | "actor";
            alternatives?: ({
                kind: "arc";
                radius: number;
                halfAngle: number;
                yawOffset?: number;
            } | {
                kind: "lane";
                length: number;
                width: number;
            } | {
                kind: "ring";
                inner: number;
                outer: number;
            } | {
                kind: "wedge";
                length: number;
                halfAngle: number;
            } | {
                kind: "point";
                radius: number;
                exclusive?: boolean;
            } | {
                kind: "sphere";
                radius: number;
            })[];
            motion?: {
                speed?: number;
                delay?: number;
                track?: "none" | "lead" | "follow";
                overshoot?: number;
                skid?: number;
            };
            eligibility?: {
                maxDy?: number;
                jumpDodges?: boolean;
            };
        }>;
}
export type BoundedArenaFight = { [Key in keyof BoundedArenaFightFields]: BoundedArenaFightFields[Key] };
