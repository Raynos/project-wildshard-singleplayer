import type { HeldArmsRows } from './heldArms';
import type { HeldGearRows } from './heldGear';
import type { HeldFinishesRows } from './heldFinishes';
import type { LoadoutRows } from './loadout';
import type { HeldEquipmentRows } from './heldEquipment';
import type { CompletionRows } from './completion';
import type { SpeciesPrograms } from './speciesPrograms';
import type { Shardfile } from './shardSchema';
import type { CreatureStrikes } from './creatures';
import type { ActorMoves } from './actorMoves';
import type { DecisionScriptRow } from './decisionScripts';
import type { WorldPhysics } from './worldPhysics';
import type { WorldTargets } from './worldTargets';
import type { NativeRuntimePlanData } from './nativeRuntimePlan';

type Rows = Shardfile['rows'];
type Spawns = NonNullable<NonNullable<Shardfile['runtime']>['spawns']>;

/**
 * The platform sections of a built shard (shardfile format 2, `out/<slug>/sections/<name>.json`) and the value each file
 * holds: the type contract shared by the output writer (P1, `OUTPUT_SECTIONS`), the loader and the runtime data API
 * (`ShardProduct.section`, `@wildshard/game/shardfile/shardProduct`; spec progress/shard-platform/p2a-runtime-data-api/).
 *
 * A section that slices today's `Shardfile` is a root-key envelope (`{ quests: … }`, `{ rows: { strikes: … } }`), so an
 * optional field keeps its absence and the loader reassembles the unchanged `Shardfile` for every host. A section added
 * after format 2 (marked "new") is a plain value and is not part of `Shardfile`: the runtime reads it with `section()` and
 * hands it to its host as an argument. A section file holds its schema's output, validated at build time; the runtime
 * trusts it. Adding a platform section = one entry here, its schema in this package and its row in the writer's table.
 */
export interface PlatformSections {
  'held/arms': HeldArmsRows;
  'held/gear': HeldGearRows;
  'held/finishes': HeldFinishesRows;
  'held/loadout': LoadoutRows;
  'held/equipment': HeldEquipmentRows;
  'ui/completion': CompletionRows;
  /** Existing native owners selected by admitted data, never client runtime code. */
  'sim/runtime-plan': NativeRuntimePlanData;
  'world/tiles': Pick<Shardfile, 'tiles' | 'far' | 'near'>;
  'world/terrain': Pick<Shardfile, 'terrain' | 'nativeGround'>;
  'world/edge': Pick<Shardfile, 'edge' | 'entryways'>;
  'world/collision': Pick<Shardfile, 'meshCollision'>;
  'world/navigation': Pick<Shardfile, 'navigation'>;
  'world/props': Pick<Shardfile, 'props'>;
  'world/water': Pick<Shardfile, 'water'>;
  'world/movers': Pick<Shardfile, 'movers'>;
  'world/traversal': Pick<Shardfile, 'traversal'>;
  'world/spawn': Pick<Shardfile, 'spawn'>;
  /** new (P2b): common raw native physics, read alongside owner metadata */
  'world/physics': WorldPhysics;
  /** new (KA6): immutable strike targets and named movement/perch points. */
  'world/targets': WorldTargets;
  'world/days': { readonly rows: Pick<Rows, 'days'> };
  'world/weather': { readonly rows: Pick<Rows, 'weather'> };
  'look/look': Pick<Shardfile, 'look' | 'presentation'>;
  'look/map': Pick<Shardfile, 'map'>;
  'look/materials': { readonly rows: Pick<Rows, 'looks'> };
  /** new (KA5): sim-side steering mechanics, independently selected by decisions. */
  'actors/moves': ActorMoves;
  /** Callback-free gameplay species, in each owning world's original registration order. */
  'actors/species-programs': SpeciesPrograms;
  'actors/creatures': Pick<Shardfile, 'creatures'>;
  'actors/crowds': Pick<Shardfile, 'crowds'>;
  'actors/npcs': Pick<Shardfile, 'questNpcs'>;
  'actors/species': { readonly rows: Pick<Rows, 'species'> };
  'actors/spawns': { readonly runtime: { readonly spawns: Spawns } };
  /** new (P2b): the creature strike table species programs name by id (Sky's Roc rows), `CreatureStrikeSchema` rows */
  'actors/strikes': Readonly<CreatureStrikes>;
  'combat/items': Pick<Shardfile, 'items'>;
  'combat/encounters': Pick<Shardfile, 'encounters'>;
  'combat/strikes': { readonly rows: Pick<Rows, 'strikes'> };
  'quests/quests': Pick<Shardfile, 'quests'>;
  'quests/host': Pick<Shardfile, 'questHost'>;
  'quests/directors': Pick<Shardfile, 'directors'>;
  'economy/ledger': Pick<Shardfile, 'ledger'>;
  'economy/loot': { readonly rows: Pick<Rows, 'loot'> };
  'state/state': Pick<Shardfile, 'state'>;
  'state/migrations': Pick<Shardfile, 'migrations'>;
  'state/modes': Pick<Shardfile, 'modes'>;
  /** new (KA1): admitted v1 decisions, independent of the retained v0 hash/binding envelope */
  'sim/scripts': readonly DecisionScriptRow[];
  'sim/sim': Pick<Shardfile, 'sim'>;
  'sim/hooks': Pick<Shardfile, 'hooks'>;
  'sim/client-scripts': Pick<Shardfile, 'clientScripts'>;
  'sim/client-channels': Pick<Shardfile, 'clientChannels'>;
  'sim/plumbing': Pick<Shardfile, 'plumbing'>;
  'audio/audio': Pick<Shardfile, 'audio'>;
  'ui/card': Pick<Shardfile, 'accent'>;
  /** the level metadata the catalog joins before publication (sp-x1, `LevelSectionSchema` in `./level`, moved out of `ui/card`) */
  'ui/level': { readonly manifest: NonNullable<Shardfile['manifest']> };
  'ui/ui': Pick<Shardfile, 'ui' | 'targets'>;
  'ui/compendium': { readonly rows: Pick<Rows, 'compendiums'> };
  /** new (P2b): the shard's player-facing strings, key → text, read through `ShardProduct.strings(keys)` */
  'ui/strings': Readonly<Record<string, string>>;
}

/** A platform section's name, as the index lists it (`<group>/<name>`). */
export type PlatformSectionName = keyof PlatformSections;
/** A shard-private section's name (`sections/custom/<name>.json`, schema in `schemas/custom/<name>.schema.json`). */
export type CustomSectionName = `custom/${string}`;
/** Any section name an index may list. */
export type SectionName = PlatformSectionName | CustomSectionName;
/** When the loader fetches a section: with admission (`boot`), on entering the shard (`enter`), or as the player moves. */
export type SectionLoad = 'boot' | 'enter' | 'stream';
/** Who reads a section: the headless simulation, the client, or both. */
export type SectionAudience = 'sim' | 'client' | 'both';
