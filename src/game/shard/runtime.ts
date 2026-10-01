import type { BodyShadow } from '../cosmetics/bodyShadow';
import type { World, StepRunner, Interactable, Animal, AnimalManager, EquipmentService, WeaponId, Weapon, Audio, StepSurface, Music, HUD, GameMenu, FullMap, SkinLocker, SkinDef, CombatCues, Targets, GameMenuOptions, FirstHints, MapMark } from '#engine';
import type { Group, Vector2, Vector3 } from 'three';
import type { Inventory } from '../Inventory';
import type { Progress } from '../Progress';
import type { Owned } from '../loot/Owned';
import type { ShardSword } from './manifest';

/** Services supplied by the gameplay shell after it has built the player kit and UI. */
export interface ShardPlayHost {
  animals: AnimalManager; weapons: EquipmentService; primary: Weapon; rifle: Weapon | null; secondary: Weapon | null;
  inventory: Inventory; owned: Owned; progress: Progress; hud: HUD; menu: GameMenu; fullMap: FullMap;
  audio: Audio; music: Music; skins: SkinLocker; wearSkin: (skin: SkinDef) => void;
  touchUi: () => boolean; nolock: boolean; disposeRifleDrop: () => void; cues: CombatCues;
  firstHints?: FirstHints;
  minimap?: { setMarks: (source: (() => readonly MapMark[]) | null) => void } | null;
  bodyShadow?: BodyShadow | null;
}
export interface ShardPlayHooks {
  spawnFloor?: (x: number, z: number) => number | undefined;
  wearFinish?: (id: string) => void;
  updatePickups?: (dt: number, t: number) => void;
  disposeRifleDrop?: () => void;
  animalsReady?: (animals: AnimalManager) => void;
  worldUpdate?: (dt: number, t: number) => void;
  equipmentUpdate?: (dt: number) => void;
  audioUpdate?: (dt: number) => void;
  dispose?: () => void;
  questFlags?: () => readonly string[];
  adventureFlags?: () => readonly string[];
  places?: () => readonly { id: string; label: string; x: number; z: number; r: number }[];
  checkpoint?: () => boolean;
  eliteEngaged?: () => boolean;
  isElite?: (animal: Animal) => boolean;
  harvestBusy?: () => boolean;
  harvest?: (animal: Animal, give: () => void) => void;
  stepSurface?: (at: Vector3) => StepSurface;
  directional?: boolean;
}
/** Typed, per-build handoff between the staged shell and an authored plugin. */
export interface ShardRuntime {
  world: World | null; step: StepRunner | null; play: ShardPlayHost | null;
  readonly interactables: Interactable[];
  readonly overhead: Group[];
  readonly hooks: ShardPlayHooks;
  readonly objects: Record<string, unknown>;
  buildEquipment?: (targets: Targets, nolock: boolean, viewmodel?: ShardSword | null) => Promise<{ primary: Weapon; rifle: Weapon | null; secondary: Weapon | null; extras?: readonly Weapon[]; order?: readonly WeaponId[]; install?: (equipment: EquipmentService) => void }>;
  menu?: Pick<GameMenuOptions, 'skins' | 'onWearSkin' | 'skinsTitle' | 'pack'>;
  viewer: () => Vector3;
  horizonVeil: { value: Vector2 } | null;
}

declare module '#engine/events/maps' {
  interface AskMap {
    'feat.toast': [{ id: string; event?: string; allowed: boolean }, { id: string; event?: string; allowed: boolean }];
  }
}
