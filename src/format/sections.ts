import type { CollectionDisplaysRows } from './collectionDisplay.ts';
import type { ResolvedIslandLibraryRows } from './islandLibrary.ts';
import type {StealthRows} from './stealth.ts';
import type { ColourFunctionBook } from './colourFunction.ts';
import type { PaintedLookRow } from './paintedLook.ts';
import type { ExplorerCatalogue } from './explorerCatalogue.ts';
import type { RiggedHullBook } from './riggedHulls.ts';
import type { HullLookBookRows } from './speciesLooks.ts';
import type { ToonLookRow } from './toonLook.ts';
import type { KeyedSkyStyle } from './keyedSky.ts';
import type { SpawnScriptRows } from './spawnScripts.ts';
import type { ClientPlan } from './clientPlan.ts';
import type { ReturnModuleRow, ViewModuleRow } from './scriptContract.ts';
import type { WorldScenesSection } from './worldScenes.ts';
import type { TreeSetRows } from './treeSetRows.ts';
import type { HeldArmsRows } from './heldArms.ts';
import type { HeldGearRows } from './heldGear.ts';
import type { HeldFinishesRows } from './heldFinishes.ts';
import type { LoadoutRows } from './loadout.ts';
import type { HeldEquipmentRows } from './heldEquipment.ts';
import type { CompletionRows } from './completion.ts';
import type { SpeciesPrograms } from './speciesPrograms.ts';
import type { Shardfile } from './shardSchema.ts';
import type { DeclaredBodyOpsRows } from './bodySlots.ts';
import type { CreatureStrikes } from './creatures.ts';
import type { ActorMoves } from './actorMoves.ts';
import type { DecisionScriptRow } from './decisionScripts.ts';
import type { WorldPhysics } from './worldPhysics.ts';
import type { WorldTargets } from './worldTargets.ts';
import type { NativeRuntimePlanData } from './nativeRuntimePlan.ts';

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
  /** Complete client display catalogue and native keepsake rows. */
  'collections/displays': CollectionDisplaysRows;
  /** Synchronous product-owned fixed draws, figures and collection slots. */
  'models/island-library': ResolvedIslandLibraryRows;
  'player/stealth':StealthRows;
  'view/modules': ViewModuleRow[];
  /** Client-only ordered model references, ignored by simulation. */
  'explore/catalogue': ExplorerCatalogue;
  'look/rigged-hulls': RiggedHullBook;
  'look/hull-book': HullLookBookRows;
  'look/toon': ToonLookRow;
  'look/painted': PaintedLookRow;
  'look/colour-functions': ColourFunctionBook;
  'look/keyed-sky': KeyedSkyStyle;
  /** Client-only compiled feature declarations; ignored by the authoritative simulation. */
  'client/plan': ClientPlan;
  'held/arms': HeldArmsRows;
  'held/gear': HeldGearRows;
  'held/finishes': HeldFinishesRows;
  'held/loadout': LoadoutRows;
  'held/equipment': HeldEquipmentRows;
  'ui/completion': CompletionRows;
  /** Existing native owners selected by admitted data, never client runtime code. */
  'sim/runtime-plan': NativeRuntimePlanData;
  'world/tiles': Pick<Shardfile, 'tiles' | 'far' | 'near' | 'ring'>;
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
  'world/scenes': WorldScenesSection;
  /** Client-only baked forest tree set (game models/treeSet): a manifest's `trees.treeSet` and a forest page draw it. */
  'world/trees': TreeSetRows;
  'world/days': { readonly rows: Pick<Rows, 'days'> };
  'world/weather': { readonly rows: Pick<Rows, 'weather'> };
  'look/look': Pick<Shardfile, 'look' | 'presentation'>;
  'look/map': Pick<Shardfile, 'map'>;
  'look/materials': { readonly rows: Pick<Rows, 'looks'> };
  /** new (KA5): sim-side steering mechanics, independently selected by decisions. */
  'actors/moves': ActorMoves;
  'actors/spawn-scripts': SpawnScriptRows[];
  /** Stateless return-policy modules are admitted but never auto-scheduled. */
  'actors/return-scripts': ReturnModuleRow[];
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
  /** G566: declared bodies the shard's decision scripts own */
  'sim/bodies': DeclaredBodyOpsRows;
  'sim/sim': Pick<Shardfile, 'sim'>;
  'sim/hooks': Pick<Shardfile, 'hooks'>;
  'sim/client-scripts': Pick<Shardfile, 'clientScripts'>;
  'sim/client-channels': Pick<Shardfile, 'clientChannels'>;
  'sim/plumbing': Pick<Shardfile, 'plumbing'>;
  'audio/audio': Pick<Shardfile, 'audio'>;
  'ui/card': Pick<Shardfile, 'accent'>;
  /** Plain manifest metadata for admitted data-client discovery. */
  'ui/level': { readonly manifest: NonNullable<Shardfile['manifest']> };
  'ui/ui': Pick<Shardfile, 'ui' | 'targets'>;
  'ui/compendium': { readonly rows: Pick<Rows, 'compendiums'> };
  /** new (P2b): the shard's player-facing strings, key → text, read through `ShardProduct.strings(keys)` */
  'ui/strings': Readonly<Record<string, string>>;
}

/** A platform section's name, as the index lists it (`<group>/<name>`). */
export type PlatformSectionName = keyof PlatformSections;
/** Every admitted section is defined by the platform. */
export type SectionName = PlatformSectionName;
