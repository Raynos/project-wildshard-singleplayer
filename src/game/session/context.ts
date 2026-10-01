import type { BootRuntime, CombatCueMap, Audio, StepProgress, SkinDef, Music, TitleArrival } from '#engine';
import type { ItemRow, TravelHandoff, ShardManifest, ShardRuntime } from '../index';
import type { Scene } from 'three';
import type { LoadStage } from '../shard/load';

export interface KitPorts {
  items: readonly ItemRow[];
  combatCues: (audio: Audio, meleeSilent: boolean) => CombatCueMap;
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
