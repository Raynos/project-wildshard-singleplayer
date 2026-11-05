/** The arena room's sim half (P1-E4.2): its row-driven fight and the brain each body runs. Its looks are the view half's
 *  (arenaRoomView.ts `arenaRoomViews`), passed in; nothing here draws. */
import { Vector3 } from 'three';
import * as v from 'valibot';
import type { BossScript } from '@wildshard/engine/ai/BossBrain';
import { canReach } from '@wildshard/engine/ai/reach';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import type { CombatTag } from '@wildshard/engine/combat/pipeline';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { SpeciesDef } from '@wildshard/engine/entities/species/registry';
import { parseBossProfile } from '@wildshard/format/bossProfiles';
import { CreatureStrikeSchema } from '@wildshard/format/creatures';
import { ArenaRoomSpeciesControlSchema } from '@wildshard/format/speciesBookRows';
import { bossFight, type BossViewBinding, type PhasedBossBrain, type PhasedBossFight } from '../plugin/bossPhase';
import type { ShardContext } from '../plugin/context';
import { bindRuntimeBoss } from '../plugin/headless';
import type { BossArenaRoom } from './arenaRoomView';

const finite = v.pipe(v.number(), v.finite());
const rowId = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const triple = v.tuple([finite,finite,finite]);

/** Built-in body binding for row-driven arena fights. Species adapters observe
 * the shared fight's brain rather than installing a shard decision owner. */
const arenaBrains = new WeakMap<Animal, PhasedBossBrain<Animal>>();
export function arenaRoomBrain(actor: Animal): PhasedBossBrain<Animal> | undefined { return arenaBrains.get(actor); }

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
/** Client-only adapter over the existing boss host: admitted body rows, floor,
 * strikes and arena presentation. All public author inputs are data and ids. */
export function arenaRoomFight(ctx: ShardContext, dungeon: BossArenaRoom, input: unknown, views: (presentation: BoundedArenaFight['presentation']) => BossViewBinding): {
  phased: PhasedBossFight<Animal>; script: BossScript; body: () => Animal | null; setPresent: (on: boolean) => void; devKill: () => void;
} {
  const rows = v.parse(ArenaFightPageSchema, input), profile = parseBossProfile(rows.profile);
  if (profile.pattern !== 'arena') throw new Error('Arena room requires an arena boss profile');
  const runtime = ctx.game.runtime, world = runtime?.world, play = runtime?.play;
  if (world === undefined || world === null || play === undefined || play === null) throw new Error('Arena fight requires its actual page owners');
  const { animals } = play, { player } = world, owner = bindRuntimeBoss(ctx, ctx.product.shardfile, rows.body, undefined, { identity: rows.identity });
  const cuts = rows.cuts.map(strikeFromData), hazards = new Map(Object.entries(rows.hazards).map(([id, row]) => [id, strikeFromData(row)]));
  const contacts = new StrikeRunner();
  const floor = (actor: Animal): void => { actor.levelGround = true; actor.sampleTerrain(); };
  const retire = (actor: Animal): void => {
    if (dungeon.actor === actor) dungeon.actor = null;
    actor.hidden = true; actor.mesh.visible = false; actor.position.y = -9999;
    const index = animals.animals.indexOf(actor); if (index !== -1) animals.animals.splice(index, 1);
    actor.mesh.removeFromParent();
  };
  const phased = bossFight<Animal>(profile, {
    arena: { floorAt: dungeon.floorHeightAt, pile: (x, z, r, dh, cap) => { dungeon.addSand(x, z, r, dh, cap); },
      clear: () => { dungeon.clearSand(); }, drain: (dt, rate) => { dungeon.drainSand(dt, rate); },
      inArena: p => dungeon.inChamber(p) && p.z < rows.maxZ, seal: on => { dungeon.setSealed(on); } },
    body: { spawn: () => {
      const actor = owner.spawn(); if (actor === null) return null;
      dungeon.actor = actor; actor.herd = -1; floor(actor); return actor;
    }, retire, bind: (actor, brain) => { arenaBrains.set(actor, brain); },
    ready: (actor, floorY) => { actor.yOffset = floorY - actor.position.y; actor.mesh.visible = true; } },
    spawnAdd: (_i, x, z, yaw) => {
      const actor = animals.spawn(rows.add.kind, x, z, yaw, rows.add.variant);
      actor.herd = -1; floor(actor); Object.assign(actor.mem, rows.add.memory);
      actor.yOffset = dungeon.rows.origin.y - actor.position.y; return actor;
    },
    player: { get position() { return player.position; }, dash: (x, z, seconds) => { player.dash(x, z, seconds); } },
    hurt: (amount, throughWalls = false) => {
      const actor = phased.body(), target = ctx.app.player;
      if (actor === null || target === null || (!throughWalls && !canReach(actor, player.position, ctx.app.physics))) return;
      ctx.app.combat.hit({ source: 'env', sourceTags: [rows.damageTag, 'feel.blow', 'cover.checked'], target, amount,
        point: actor.position, dir: new Vector3(), cause: { kind: actor.kind, label: actor.label } });
    },
    cut: (i, actor, hit) => {
      const strike = cuts[i] ?? cuts[0];
      return strike !== undefined && contacts.contact(strike, { actor, target: player.position, hit, canReach: () => canReach(actor, player.position, ctx.app.physics) });
    },
    hazard: (id, from, hit, options) => {
      const strike = hazards.get(id); if (strike === undefined) throw new Error('Missing arena hazard strike');
      const noop = (): void => undefined;
      const actor = { position: from, scale: 1, yaw: 0, alive: true, dims: { bodyY: 1.2, bodyRadius: .1 },
        headWorld: (out: Vector3) => out.copy(from).add(new Vector3(0, 1.2, 0)), startAttack: noop, cancelAttack: noop, setMotion: noop };
      contacts.contact(strike, { actor, target: player.position, hit, ...options, canReach: () => canReach(actor, player.position, ctx.app.physics) });
    },
    rng: () => ctx.app.rng.stream('ai').next(), feed: line => { play.hud.killFeed(line); },
    views: views(rows.presentation),
    rewardPoint: () => new Vector3().fromArray(rows.reward),
    respawnPoint: () => ({ pos: new Vector3().fromArray(rows.respawn), yaw: rows.yaw }),
  });
  return { phased, script: phased.script, body: phased.body, devKill: phased.kill,
    setPresent: on => {
      const body = phased.body(), bodies = body === null ? phased.adds() : [body, ...phased.adds()];
      for (const actor of bodies) {
        const index = animals.animals.indexOf(actor);
        if (on && index === -1 && !actor.hidden) { animals.animals.push(actor); animals.group.add(actor.mesh); }
        if (!on && index !== -1) { animals.animals.splice(index, 1); actor.mesh.removeFromParent(); }
      }
    } };
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
type BoundedArenaFight = { [Key in keyof BoundedArenaFightFields]: BoundedArenaFightFields[Key] };
