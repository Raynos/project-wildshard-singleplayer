import type { SetName } from '../player/viewmodelTextures';
import type { FallCause } from '../combat/pipeline';
import type { HorizonStrips } from '../world/HorizonMatte';
import type { ByteKey } from '../boot/steps';
import type { TexMode } from '../boot/gpuFiles';
import type { ChunkFiles } from '../boot/bytes';
import type { LookStrategy } from '../render/look';
import type { WaterBody } from '../world/water/body';
import type { Tier } from '../core/tier';
import type { HuntTuning } from '../ai/hunt';
import type { RosterEntry } from '../models/live';
import type { InputContextDef } from './context';
import type { SfxDecodePolicy } from '../audio/preload';
import type { LevelAudioProfile } from '../audio/levelAudio';
import type { AtmosphereSpec, ExploreSpec, ForestSpec, GradeSpec, GradeLook, HerdPlan, HorizonSpec, HudSpec, LevelAssets, MinimapSpec, PoiSpec, RGB, SkySpec, SpawnPose, TerrainField, TreeSpec } from './data';
import type { EngineTierKnobs } from '../render/tiers';
import type { BudgetInputs } from '../render/budgets';
import type { TickRate } from '../app/scheduler';

export type EngineMechanism = 'weather' | 'dayCycle' | 'bosses' | 'elites' | 'spawns' | 'quests' | 'swim' | 'hover' | 'explore' | 'practice';
export interface CreatureRenderSpec { lowPoly: boolean; waitForModels: boolean; furRim: boolean; tintRange: number; oneMaterial: boolean }
export interface FightRules { input?: { bufferMs: number; coyoteMs: number }; telegraphed?: boolean; maxHitDamage?: number; capExempt?: readonly string[]; attackers?: number }
export interface Bounds { x0: number; x1: number; z0: number; z1: number; floor: number }
// oxlint-disable-next-line typescript/no-empty-object-type, typescript/no-empty-interface -- Shards declare typed tier knobs through the public engine API.
export interface TierKnobMap {}
export interface TierKnobs extends Partial<EngineTierKnobs>, Partial<TierKnobMap> { treeHiDist?: number; shadowFar?: number; animalShadowDist?: number; grassSlots?: number; envSteps?: boolean; pointLightSkip?: boolean; skipRaysOffscreen?: boolean; godRays?: boolean; ao?: boolean; aa?: 'fxaa' | 'smaa' | 'off'; slices?: boolean; warmTurns?: number; textures?: 'img' | 'ktx2'; msaa?: number; ticks?: Readonly<Record<string, TickRate>> }
export type TierOverrides = Partial<Record<Tier, TierKnobs>>;
export interface AudioSpec {
  bed?: string; samples?: SfxDecodePolicy; alertOnlyHostile?: boolean;
  /** 'none' declares no ambience: omit bed and install no sampled/synth/zoned ambient content. Score and cues remain independent. */
  ambience: string;
  score: string; cues?: () => Promise<object>; preload?: () => Promise<LevelAudioProfile>;
}
export interface BootSpec {
  viewmodelSets?: readonly SetName[];
  shaders?: { scene?: boolean; shadows?: boolean; background?: boolean; post?: boolean };
  /** The plugin runs grass, cabins and props as separate counted world steps. */
  stagedWorld?: boolean;
  lateReads?: (tier: Tier, tex?: TexMode) => readonly string[];
  files: (tier: Tier) => readonly string[];
  sources?: (tier: Tier, tex: TexMode) => ChunkFiles;
  bakedUnread?: RegExp;
  steps?: Readonly<Record<string, { label: string; weight: number }>>;
  bytes?: Readonly<Partial<Record<ByteKey, string>>>;
  audio?: () => Promise<readonly string[]>;
  explore?: { art: readonly string[] };
  precache?: readonly string[];
  barrier?: boolean;
  phone?: { deferExtras?: boolean; fragile?: boolean; trace?: boolean };
  cullBeforeFirstDraw?: boolean;
}
export interface LoadoutSpec {
  weapons: readonly string[]; tools: readonly string[]; start: readonly string[]; held?: string;
  pickups?: readonly { id: string; at: string }[];
  loans?: readonly { id: string; in: string }[];
  grants?: readonly { id: string; by: string; replaces?: string }[];
  viewmodel?: string; ammo?: readonly string[];
}

/** The engine consumes opaque level data; game presentation and discovery stay above this boundary. */
export interface LevelSpec {
  blender?: { area: { x0: number; x1: number; z0: number; z1: number }; models: readonly string[] };
  id: string;
  seed?: number; treeCount?: number; label?: string;
  creatureStyle?: string; creatures?: CreatureRenderSpec;
  debugOptions?: readonly string[];
  /** Authored diagnostic camera poses, exposed to capture scripts without content-world casts. */
  capturePoses?: () => Promise<Readonly<Record<string, { eye: readonly [number, number, number]; yaw: number; pitch: number; feet?: readonly [number, number, number]; probe?: { name?: string; x?: number; y?: number; z?: number; yaw?: number; pitch?: number } }>>>;
  /** Offline creature-navigation policy; the ground exclusion does not remove registered walkable decks. */
  navmesh?: { excludeGroundAt: (x: number, z: number, y: number) => boolean };
  /** `water`: the level's water bodies, registered in `app.world.water` at level.data (before any world step reads them) */
  ground: { terrain?: TerrainField; structures?: true; paths?: 'plugin'; water?: readonly WaterBody[] };
  spawn: SpawnPose; bounds?: Bounds; camera?: { portraitFov: number };
  /** Optional creature death plane; absent keeps existing worlds unchanged. */
  world?: { killY: number; fallCause?: FallCause };
  sky: SkySpec; atmosphere: AtmosphereSpec; grade: GradeSpec;
  look?: () => Promise<LookStrategy>; lookLayer?: GradeLook; tiers?: TierOverrides; budgets: BudgetInputs;
  mechanisms: readonly EngineMechanism[]; fight: FightRules; input?: readonly InputContextDef[];
  boot: BootSpec; audio: AudioSpec; loadout: LoadoutSpec;
  species: readonly string[]; spawns: readonly HerdPlan[]; spawnTables?: readonly string[];
  faunaTuning?: Partial<Record<string, Partial<HuntTuning>>>;
  /**
   * Edge dressing and containment. `visible` hides the drawing only; `walls: false` leaves out the four chunk-edge walls,
   * for a level placed inside a larger platform that owns what lies past its edge (absent = walls).
   */
  boundary?: { visible?: boolean; walls?: boolean };
  trees?: TreeSpec; forest?: ForestSpec; horizon?: HorizonSpec; horizonStrips?: HorizonStrips;
  minimap: MinimapSpec; hud?: HudSpec; pois?: readonly PoiSpec[];
  groundColor?: (x: number, z: number, h: number, slope: number, terrain: TerrainField, out: RGB) => RGB;
  surfaceAt?: (x: number, z: number, h: number, slope: number) => [number, number, number];
  assets?: LevelAssets; explore?: ExploreSpec;
  kitLook: 'toon' | 'painterly' | 'pbr';
  /** the first-person hands: the flat-shaded toon gloves, or the smooth ones (absent = 'pbr') */
  hands?: 'toon' | 'pbr';
  roster?: () => Promise<readonly RosterEntry[]>;
}

export function resolveTierKnobs(defaults: TierKnobs, kit: TierKnobs, level: TierOverrides | undefined, tier: Tier): TierKnobs {
  return { ...defaults, ...kit, ...level?.[tier] };
}

export function needsTerrainCollider(spec: Pick<LevelSpec, 'ground'>): boolean {
  return spec.ground.terrain !== undefined && spec.ground.structures !== true;
}
