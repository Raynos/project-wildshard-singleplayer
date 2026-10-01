import type { World, StepRunner, Interactable, Animal, AnimalManager, EquipmentService, Weapon, Audio, StepSurface, Music, HUD, GameMenu, FullMap, SkinLocker, SkinDef, CombatCues, Targets, GameMenuOptions } from '#engine';
import type { Group, Vector2, Vector3 } from 'three';
import type { Inventory } from '../Inventory';
import type { Progress } from '../Progress';
import type { Owned } from '../loot/Owned';

/** Services supplied by the gameplay shell after it has built the player kit and UI. */
export interface ShardPlayHost {
  animals: AnimalManager; weapons: EquipmentService; primary: Weapon; rifle: Weapon | null; secondary: Weapon | null;
  inventory: Inventory; owned: Owned; progress: Progress; hud: HUD; menu: GameMenu; fullMap: FullMap;
  audio: Audio; music: Music; skins: SkinLocker; wearSkin: (skin: SkinDef) => void;
  touchUi: () => boolean; nolock: boolean; disposeRifleDrop: () => void; cues: CombatCues;
}
export interface ShardPlayHooks {
  wearFinish?: (id: string) => void;
  updatePickups?: (dt: number, t: number) => void;
  disposeRifleDrop?: () => void;
  worldUpdate?: (dt: number, t: number) => void;
  equipmentUpdate?: (dt: number) => void;
  audioUpdate?: (dt: number) => void;
  dispose?: () => void;
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
  buildEquipment?: (targets: Targets, nolock: boolean) => Promise<{ primary: Weapon; rifle: Weapon | null; secondary: Weapon | null }>;
  menu?: Pick<GameMenuOptions, 'skins' | 'onWearSkin' | 'skinsTitle' | 'pack'>;
  viewer: () => Vector3;
  horizonVeil: { value: Vector2 } | null;
}
