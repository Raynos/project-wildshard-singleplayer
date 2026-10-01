import type { TexMode } from '../boot/gpuFiles';
import type { ChunkFiles } from '../boot/bytes';
import type { LookStrategy } from '../render/look';
import type { Tier } from '../core/tier';
import type { HuntTuning } from '../entities/AnimalManager';
import type { RosterEntry } from '../models/live';
import type { InputContextDef } from './context';
import type { LevelAudioProfile } from '../audio/levelAudio';
import type { AtmosphereSpec, ExploreSpec, ForestSpec, GradeSpec, GradeLook, HerdPlan, HorizonSpec, HudSpec, LevelAssets, MinimapSpec, PoiSpec, RGB, SkySpec, SpawnPose, TerrainField, TreeSpec } from './data';
import type { BudgetInputs } from '../render/budgets';

export type EngineMechanism = 'hover' | 'explore' | 'practice' | 'water' | 'creatures' | 'weather' | 'dayCycle';
export interface FightRules { maxHitDamage?: number; capExempt?: readonly string[]; attackers?: number }
export interface Bounds { x0: number; x1: number; z0: number; z1: number; floor: number }
export interface TierKnobs { treeHiDist?: number; shadowFar?: number; animalShadowDist?: number; grassSlots?: number; envSteps?: boolean; pointLightSkip?: boolean; skipRaysOffscreen?: boolean; ao?: boolean; aa?: 'fxaa' | 'smaa' | 'off'; slices?: boolean; warmTurns?: number; textures?: 'img' | 'ktx2'; msaa?: number }
export type TierOverrides = Partial<Record<Tier, TierKnobs>>;
export type { BudgetInputs } from '../render/budgets';
export interface AudioSpec { ambience: string; score: string; cues?: () => Promise<object>; preload?: () => Promise<LevelAudioProfile> }
export interface BootSpec {
  /** The plugin runs grass, cabins and props as separate counted world steps. */
  stagedWorld?: boolean;
  files: (tier: Tier) => readonly string[];
  sources?: (tier: Tier, tex: TexMode) => ChunkFiles;
  bakedUnread?: RegExp;
  steps?: Readonly<Record<string, { label: string; weight: number }>>;
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
  id: string;
  ground: { terrain?: TerrainField; structures?: true };
  spawn: SpawnPose; bounds?: Bounds; camera?: { portraitFov: number };
  sky: SkySpec; atmosphere: AtmosphereSpec; grade: GradeSpec;
  look?: () => Promise<LookStrategy>; lookLayer?: GradeLook; tiers?: TierOverrides; budgets: BudgetInputs;
  mechanisms: readonly EngineMechanism[]; fight: FightRules; input?: readonly InputContextDef[];
  boot: BootSpec; audio: AudioSpec; loadout: LoadoutSpec;
  species: readonly string[]; spawns: readonly HerdPlan[]; spawnTables?: readonly string[];
  faunaTuning?: Partial<Record<string, Partial<HuntTuning>>>;
  trees?: TreeSpec; forest?: ForestSpec; horizon?: HorizonSpec;
  minimap: MinimapSpec; hud?: HudSpec; pois?: readonly PoiSpec[];
  groundColor?: (x: number, z: number, h: number, slope: number, terrain: TerrainField, out: RGB) => RGB;
  surfaceAt?: (x: number, z: number, h: number, slope: number) => [number, number, number];
  assets?: LevelAssets; explore?: ExploreSpec;
  kitLook: 'toon' | 'painterly' | 'pbr'; roster?: () => Promise<readonly RosterEntry[]>;
}

export function resolveTierKnobs(defaults: TierKnobs, kit: TierKnobs, level: TierOverrides | undefined, tier: Tier): TierKnobs {
  return { ...defaults, ...kit, ...level?.[tier] };
}

export function needsTerrainCollider(spec: Pick<LevelSpec, 'ground'>): boolean {
  return spec.ground.terrain !== undefined && spec.ground.structures !== true;
}