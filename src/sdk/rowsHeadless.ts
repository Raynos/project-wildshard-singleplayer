import * as v from 'valibot';
import { SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import type { StrikeData } from './species';
import { addBakedTerrainCollider } from '@wildshard/engine/physics/terrainTiles';
import { addPiece } from '@wildshard/engine/physics/pieces';
import type { Material } from '@wildshard/engine/physics/surface';
import { decodeTerrainTile, terrainTileHeight } from '@wildshard/engine/world/terrainTileData';
import { installSpeciesHomes, type BrainedSpecies } from '@wildshard/game/shardfile/speciesBrains';
import type { KeptHomeRow, KeptBossRow } from '@wildshard/game/shardfile/homeKeeper';
import { installMarkedBossRow, type MarkedBossRowSpec } from '@wildshard/game/shardfile/markedBossRow';
import { installLashHost, type LashCommand, type LashHostSpec, type LashTargetRow } from '@wildshard/game/systems/items/lashHost';
import { installQuestGraph, type QuestGraphPorts, type QuestGraphRows } from '@wildshard/game/quest/questGraph';
import { proveTerrainEntries, type TerrainEntryWalk } from '@wildshard/game/shardfile/terrainEntries';
import { speciesBrains } from './speciesBrains';
import type { PrepareHeadlessRuntime } from './headlessRuntime';

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
  pieces: v.array(v.object({ id: v.string(), name: v.string(), file: v.string(), active: v.boolean(), surface: v.picklist(SURFACES), colliders: v.array(Collider) })),
  spots: v.strictObject({ interact: v.array(Spot), crack: v.array(Spot) }),
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

/** Every kind declares its brain: a kind without one has no runtime policy to fall back on. */
function noPolicy(kind: string): never { throw new Error(`No declared policy for ${kind}`); }

/**
 * A trusted runtime's `prepareHeadlessRuntime` from its rows (SF27). Owns: the admitted terrain collider and heights; the
 * baked native colliders; the declared homes on the platform's species homes (their brains admitted from the rows, the
 * creature stream, attack tokens and respawn clocks, the declared holds); the marked boss, armed by the quest graph's
 * `summon`, its body the keeper's; the lash item (a player command's attack is its light crack, a `script` command on the
 * quest's actor naming a crack row's act is its world crack; the player's weapons lock through the boss's intro); the
 * quest graph at the baked spots; and the terrain entry walk, so `finish` answers with real lanes and steps. The order of
 * installation (colliders, homes, boss, lash, quest) is the continuation's.
 */
export function rowsHeadlessRuntime(manifest: RowsHeadlessManifest): PrepareHeadlessRuntime {
  return ({ shard, assets }) => {
    if (shard.terrain === null) throw new Error('A rows headless runtime declares its admitted terrain collider');
    const bytes = assets.get(shard.terrain.collider);
    if (bytes === undefined) throw new Error('Missing the admitted terrain collider');
    const baked = v.parse(Baked, manifest.baked), terrain = decodeTerrainTile(bytes), heightAt = (x: number, z: number): number => terrainTileHeight(terrain, x, z);
    const specs = bakedSpecs(manifest.baked), spots = baked.spots, homes = manifest.homes, boss = manifest.boss, quest = manifest.quest;
    const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: { size: 500, height: 0 },
      player: { at: { x: shard.spawn.x, y: heightAt(shard.spawn.x, shard.spawn.z) + 0.1, z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(5, shard.authorCaps.speed) },
      // the host's player strike is a zero-damage probe, never the lash: the lash is its declared item row
      entities: [], quests: [], weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
    const colliders = (host: SimHost): void => {
      addBakedTerrainCollider(host.physics, bytes, host.scope);
      baked.pieces.forEach(piece => {
        if (!piece.active) return;
        addPiece(host.physics, { id: piece.id, name: piece.name, category: 'props', file: piece.file, surface: piece.surface,
          colliders: piece.colliders.map(c => ({ kind: 'box' as const, x: c.x, y: c.y, z: c.z, hx: c.hx, hy: c.hy, hz: c.hz, ...(c.yaw === undefined ? {} : { yaw: c.yaw }), ...(c.surface === undefined ? {} : { surface: c.surface }) })), colliderOwner: piece.id });
      });
    };
    const row = shard.items.rows.find(item => item.id === manifest.lash.id);
    if (row?.kind !== 'weapon') throw new Error(`Missing the declared lash weapon row ${manifest.lash.id}`);
    // the crack rows' spots (a crack row's `at` is `crack.<baked crack spot id>`)
    const cracks = quest.interactions.rows.flatMap((entry): LashTargetRow[] => {
      if (entry.crack === undefined) return [];
      const spot = spots.crack.find(s => `crack.${s.id}` === entry.at); if (spot === undefined) throw new Error(`Crack row ${entry.id} has no baked spot`);
      return [{ act: entry.act, at: spot, radius: spot.radius, crack: entry.crack }];
    });
    const reach = { light: row.light.range, heavy: row.heavy.range };
    const brains = speciesBrains(homes.species, homes.strikes, homes.modules), holds = homes.holds ?? [];
    return { level, ports: { ground: false, heightAt }, proveEntries: host => proveTerrainEntries(host.physics, shard.entryways, heightAt, manifest.entries), install: (host, context) => {
      if (!context.restoring) colliders(host);
      const keeper = installSpeciesHomes(host, { step: homes.step, seed: homes.seed, homes: homes.rows, boss: boss.row, specs, species: homes.species, brains,
        attackers: homes.attackers, think: homes.think, contactMove: kind => `${homes.contact.prefix}${kind}${homes.contact.suffix}`, custom: noPolicy,
        ...(holds.length === 0 ? {} : { beforeStep: kept => { for (const hold of holds) { const actor = kept[hold.home]?.actor; if (actor) actor.mem[hold.field] = host.flags.has(hold.until) ? 0 : 1; } } }) }, context.snapshot);
      if (keeper.boss === null) throw new Error('The rows headless runtime declares its boss\'s body');
      const fact = (name: string, actorId: string): void => { context.emit({ kind: 'fact', name, actorId }); };
      const coins = (amount: number, actorId: string): void => { context.emit({ kind: 'coins', amount, actorId }); };
      const encounter = installMarkedBossRow(host, boss, { body: keeper.boss, fact, coins });
      // the browser disables the player's weapons through the boss's intro (BossPorts.lockInput)
      const lash = installLashHost(host, { step: manifest.lash.step, row, timing: manifest.lash.timing, moves: manifest.lash.moves, eye: manifest.lash.eye, targets: cracks,
        commands: () => encounter.locked() ? [] : context.commands().flatMap((command): LashCommand[] => {
          if (command.kind === 'player') return command.attack === undefined ? [] : [{ targetId: command.attack.targetId }];
          const crack = command.kind === 'script' && command.actorId === quest.graph.actor ? cracks.find(target => target.act === command.value) : undefined;
          return crack === undefined ? [] : [{ world: crack.act, heavy: crack.crack === 'heavy' }];
        }) });
      installQuestGraph(host, { quests: shard.quests, ...quest }, { spots, crack: { reach, cracked: lash.cracked },
        commands: () => context.commands().flatMap(command => command.kind === 'script' ? [command] : []), fact, coins, summon: id => { if (id === boss.row.id) encounter.summon(); } });
      keeper.settle();
    } };
  };
}
