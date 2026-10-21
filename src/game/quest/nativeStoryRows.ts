import type { InteractTable } from '@wildshard/engine/world/interact/types';
import type { NpcDialogueRow } from '@wildshard/format/npcs';
import type { AchievementCounterData } from '@wildshard/format/achievementCounters';
import type { ContractCatalogue } from '@wildshard/format/contracts';
import type { QuestStory } from '@wildshard/format/questStory';
import type { ChapterDirectorRows } from '@wildshard/format/chapterDirector';
import type { QuestReadingRows } from '../plugin/quests';

interface Point { x: number; y: number; z: number }
interface Prompt extends Point { radius: number }
/** Captured placement data shared with the page's actual prompts. */
export interface NativeStorySpots {
  readonly rows: readonly (Point & { id: string; kind: string; yaw: number; prompt: Point | null })[];
  readonly people: readonly { kind: string; at: Point; prompt: Prompt }[];
  readonly board: Prompt; readonly pickup: Prompt;
  readonly cable: { readonly prompt: Prompt };
  readonly signals: Readonly<Record<string, Prompt>>;
}
/** Immutable composition over native quest steps, modal services and admitted AS.
 * G474 quests are approved platform functionality; there are no shard hooks. */
export interface NativeStoryRows {
  readonly content: {
    readonly table: InteractTable;
    readonly steps: unknown; readonly deaths: unknown; readonly readings: QuestReadingRows<NpcDialogueRow>;
    readonly policy: { readonly touchCount: number; readonly readingDelay: number };
    readonly lead: { readonly program: unknown; readonly path: readonly (readonly [number, number])[] };
  };
  readonly counters: AchievementCounterData; readonly contracts: ContractCatalogue; readonly trades: unknown;
  readonly spots: NativeStorySpots;
  readonly policy: {
    readonly savedNames: Readonly<Record<string, string>>;
    readonly actor: string; readonly trade: string; readonly ammo: string; readonly step: string;
    readonly eye: number; readonly launcher: number; readonly boss: string; readonly cable: string; readonly pack: string;
    readonly primary: string; readonly trader: string;
    readonly latch: string; readonly benchRow: string; readonly bench: QuestStory['bench'];
    readonly pickup: { readonly flag: string };
    readonly touch: { readonly prefix: string; readonly item: string };
    readonly finish: { readonly id: string; readonly claims: number; readonly ids: readonly string[] };
    readonly lead: { readonly step: string; readonly target: string; readonly nightAbove: number };
    readonly clock: { readonly director: ChapterDirectorRows;
      readonly wait: string; readonly nightRequest: string; readonly step: string; readonly dawnRequest: string };
  };
}
