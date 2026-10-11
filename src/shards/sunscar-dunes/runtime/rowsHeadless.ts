import { SIGNAL_LEVEL } from '../data/headlessLevel';
import * as v from 'valibot';
import { SIM_API_VERSION, type SimLevel } from '@wildshard/engine/sim';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { StrikeData } from '@wildshard/sdk/species';
import type { Material } from '@wildshard/engine/physics/surface';
import { decodeTerrainTile, terrainTileHeight } from '@wildshard/engine/world/terrainTileData';
import type { BrainedSpecies } from '@wildshard/game/plugin/brain';
import type { KeptHomeRow, KeptBossRow } from '@wildshard/game/shardfile/homeKeeper';
import type { MarkedBossRowSpec } from './shardfile/markedBossRow';
import type { LashHostSpec } from './items/lashHost';
import type { QuestGraphPorts, QuestGraphRows } from '@wildshard/game/plugin/quests';
import { proveTerrainEntries, type TerrainEntryWalk } from '@wildshard/game/plugin/mover';
import type { HeadlessRuntimePreparation, HeadlessRuntimePlan } from '@wildshard/sdk/headlessRuntime';

/**
 * A trusted runtime's renderer-free host declared as rows (SHARD-PLATFORM SF27): the browser-baked metadata (`baked`:
 * each kind's native spec, the collider pieces, the prompt and crack spots), the creature homes and their declared
 * brains, a marked boss, a lash item, the quest graph and the terrain entry walk.
 */
export interface RowsHeadlessManifest {
  /** The browser-baked metadata (`{ actors, bosses, pieces, spots }`), parsed strictly here. */
  readonly baked: unknown;
  readonly homes: {
    /** The keeper's fixed-step id; its continuation names the live roster. */
    readonly step: string;
    readonly seed: number;
    readonly rows: readonly KeptHomeRow[];
    readonly species: readonly BrainedSpecies[];
    readonly strikes: readonly StrikeData[];
    /** Admitted species script modules, sha256 → base64. */
    readonly modules: Readonly<Record<string, string>>;
    readonly attackers: number;
    readonly think: { readonly every: number; readonly dt: number };
    /** A kind's contact move is `${prefix}${kind}${suffix}`. */
    readonly contact: { readonly prefix: string; readonly suffix: string };
    /** A home's actor holds (its memory `field` is 1) until a flag is raised (a creature that waits for the quest). */
    readonly holds?: readonly { readonly home: number; readonly field: string; readonly until: string }[];
  };
  /** The marked boss: its body row and fight rows; its body is the keeper's. */
  readonly boss: MarkedBossRowSpec & { readonly row: KeptBossRow };
  /** The lash item: its declared row's id and its host rows (a player attack is its light crack; a crack row's act its world crack). */
  readonly lash: { readonly id: string } & Pick<LashHostSpec, 'step' | 'timing' | 'moves' | 'eye'>;
  /** The quest graph (the admitted quests come from the shardfile). */
  readonly quest: Omit<QuestGraphRows, 'quests'>;
  readonly entries: TerrainEntryWalk;
}

const finite = v.pipe(v.number(), v.finite());
const BakedSpec = v.strictObject({ kind: v.string(), label: v.string(), variant: v.string(), rarity: v.picklist(['common', 'uncommon', 'rare', 'legendary']),
  hp: finite, aggressive: v.boolean(), lockable: v.optional(v.boolean()),
  dims: v.strictObject({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, feet: v.array(v.tuple([finite, finite])), halfWidth: finite }),
  mods: v.strictObject({ speed: finite, chargeDist: finite, damageTaken: finite, chargeDamage: finite, relentless: v.boolean() }),
  flight: v.optional(v.strictObject({ altitude: finite, above: v.optional(v.picklist(['ground', 'world'])), climbRate: finite, diveRate: finite, lockRange: v.optional(finite), bank: v.optional(finite) })) });
const Spot = v.strictObject({ id: v.string(), x: finite, y: finite, z: finite, radius: v.pipe(finite, v.minValue(0)) });
const SURFACES = ['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand'] as const satisfies readonly Material[];
const Collider = v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite, hx: finite, hy: finite, hz: finite, yaw: v.optional(finite), surface: v.optional(v.picklist(SURFACES)) });
const Baked = v.object({
  actors: v.array(v.object({ kind: v.string(), spec: v.unknown() })), bosses: v.array(v.object({ kind: v.string(), spec: v.unknown() })),
  pieces: v.array(v.object({ id: v.string(), name: v.string(), file: v.string(), active: v.boolean(), surface: v.picklist(SURFACES), colliders: v.array(Collider), owner: v.optional(v.string()) })),
  spots: v.strictObject({ interact: v.array(Spot), crack: v.array(Spot) }),
  promptRegistrations: v.optional(v.unknown()),
});

/** The baked prompt spots and crack targets (the built world's order), strictly. */
export function bakedSpots(baked: unknown): QuestGraphPorts['spots'] { return v.parse(Baked, baked).spots; }
/** The baked native specs by kind; every home of a kind shares one recipe (a divergent one refuses). */
export function bakedSpecs(baked: unknown): ReadonlyMap<string, AnimalSimSpec> {
  const specs = new Map<string, AnimalSimSpec>(), rows = v.parse(Baked, baked);
  [...rows.actors, ...rows.bosses].forEach(actor => {
    const { flight, lockable, ...rest } = v.parse(BakedSpec, actor.spec);
    const spec: AnimalSimSpec = { ...rest, ...(lockable === undefined ? {} : { lockable }),
      ...(flight === undefined ? {} : { flight: { altitude: flight.altitude, climbRate: flight.climbRate, diveRate: flight.diveRate,
        ...(flight.above === undefined ? {} : { above: flight.above }), ...(flight.lockRange === undefined ? {} : { lockRange: flight.lockRange }),
        ...(flight.bank === undefined ? {} : { bank: flight.bank }) } }) };
    const known = specs.get(actor.kind);
    if (spec.kind !== actor.kind || (known !== undefined && JSON.stringify(known) !== JSON.stringify(spec))) throw new Error(`Divergent native spec ${actor.kind}`);
    specs.set(actor.kind, spec);
  });
  return specs;
}

/** Prepare only the admitted native level; Signal installs its declared owners exactly once in signalPlan.ts. */
export function prepareRowLevel(manifest: Pick<RowsHeadlessManifest, 'entries'>, { shard, assets }: HeadlessRuntimePreparation): Omit<HeadlessRuntimePlan, 'install'> {
  if (shard.terrain === null) throw new Error('A rows headless runtime declares its admitted terrain collider');
  const bytes = assets.get(shard.terrain.collider);
  if (bytes === undefined) throw new Error('Missing the admitted terrain collider');
  const terrain = decodeTerrainTile(bytes), heightAt = (x: number, z: number): number => terrainTileHeight(terrain, x, z);
  const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: SIGNAL_LEVEL.ground,
    player: { at: { x: shard.spawn.x, y: heightAt(shard.spawn.x, shard.spawn.z) + SIGNAL_LEVEL.player.lift, z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(SIGNAL_LEVEL.player.speed, shard.authorCaps.speed) },
    // A zero-damage probe: only the declared lash row owns player damage.
    entities: [], quests: [], weapon: SIGNAL_LEVEL.probe };
  return { level, ports: { ground: false, heightAt }, proveEntries: host => proveTerrainEntries(host.physics, shard.entryways, heightAt, manifest.entries) };
}
