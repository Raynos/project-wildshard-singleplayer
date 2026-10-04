import type { BootRuntime, CombatCueMap, Audio, StepProgress, SkinDef, Music, TitleArrival, Player, Tool } from '@wildshard/engine';
import type { ItemRow, TravelHandoff, ShardManifest, ShardRuntime } from '../index';
import type { BagIcons } from '../bag/tabs';
import type { Scene, PerspectiveCamera } from 'three';
import type { LoadStage } from '../shard/load';

export interface KitPorts {
  items: readonly ItemRow[];
  tools: readonly { id: string; create: (camera: PerspectiveCamera, player: Player) => Tool }[];
  combatCues: (audio: Audio, meleeSilent: boolean) => CombatCueMap;
  /** the bag's glyphs (AG4: the game names no content icon) */
  bagIcons: BagIcons;
}
export interface SessionState {
  music: Music | null;
  arrival: TitleArrival | null;
  fatalShown: boolean;
}
export interface BuiltWorld { readonly scene: Scene; dispose: () => void }
export interface StagedBoot {
  runtime: ShardRuntime;
  skins: readonly SkinDef[];
  progress: StepProgress;
  worldHook: (work: () => Promise<void>) => Promise<void>;
  handoff: TravelHandoff | null;
  items: ReadonlyMap<string, ItemRow>;
  featTotal: number | undefined;
}
export interface SessionContext {
  engine: BootRuntime; manifest: ShardManifest; slug: string; stage: LoadStage;
  boot: StagedBoot; session: SessionState; kit: KitPorts;
}
