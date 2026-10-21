import type { InteractTable } from '@wildshard/engine/world/interact/types';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { installChapterLead, installQuestSpawnDirector } from '@wildshard/game/quest/chapterDirector';
import type { MoverRuntime, MoverInstallation } from '@wildshard/game/plugin/mover';
import type { QuestPageTalksRows } from '@wildshard/format/npcs';

interface Point { x: number; z: number }
type Triple = [number, number, number];
/** Story content remains in its admitted section; hosts validate subcontracts. */
export interface ForestStoryContent {
  readonly table: InteractTable; readonly steps: unknown;
  readonly lead: { program: unknown }; readonly events: unknown; readonly pageDeaths: unknown; readonly content: unknown;
}
/** Data-only page composition over forest, ranged equipment and quest hosts. */
export interface ForestStoryRows {
  readonly page: string; readonly ranged: string; readonly content: `custom/${string}`;
  readonly panels: { readonly board: string; readonly count: string };
  readonly files: Readonly<Record<'stall' | 'contracts' | 'signals' | 'door' | 'services' | 'director', string>>;
  readonly talks: QuestPageTalksRows;
  readonly store: { readonly slot: string; readonly state: string };
  readonly collections: readonly { readonly event: string; readonly completeEvent: string; readonly prefix: string; readonly names: readonly string[];
    readonly label: string; readonly complete: string; readonly take?: string; readonly fallback?: string; readonly shelf?: string }[];
  readonly pickupEvent: string;
  /** `lantern`: the forest page lantern this signal lights while any of its `when` flags is set */
  readonly signals: readonly (Point & { readonly id: string; readonly height: number; readonly lantern: { readonly id: string; readonly when: readonly string[] } })[];
  readonly wheel: { readonly flag: string; readonly speed: number };
  readonly door: { readonly building: string; readonly flag: string };
  readonly board: { readonly at: Point & { readonly yaw: number }; readonly label: string; readonly filled: string; readonly finishes: Readonly<Record<string, string>>;
    readonly height: number; readonly radius: number; readonly ammunition: { readonly loadout: string; readonly kind: string };
    readonly notices: { readonly claimed: string; readonly filled: string; readonly progress: string } };
  readonly cable: { readonly id: string; readonly scene: string; readonly trolley: string; readonly prompt: Triple; readonly radius: number; readonly label: string;
    readonly top: Triple; readonly launch: Triple; readonly landing: Triple; readonly arrival: string; readonly audio: string; readonly shot: string };
  /** `rest`: the scene object standing in for the mover at rest, hidden while it is away */
  readonly mover: { readonly id: string; readonly mesh: string; readonly binding: { readonly systemId: string; readonly bindings: NonNullable<MoverInstallation['borrowed']>['rows'] }; readonly rest: string };
  readonly secret: { readonly scene: string; readonly flag: string; readonly text: string; readonly floorY: number; readonly mid: Triple; readonly mouths: Triple[] };
  readonly map: { readonly pois: readonly (Point & { id: string; name: string; r: number })[];
    readonly zones: readonly { label: string; x: number; z: number; size?: number; rot?: number }[] };
  readonly jumps: Readonly<Record<string, Point & { readonly flags: string[]; readonly look: Point; readonly height?: Point & { up: number }; readonly phase?: number }>>;
  readonly debug: { readonly id: string; readonly browser: string };
}
/** Custom rendering reads observations; platform scheduling invokes no shard view. */
export interface ForestStory {
  readonly flags: Flags; readonly stag: ReturnType<typeof installChapterLead>;
  readonly thralls: Awaited<ReturnType<typeof installQuestSpawnDirector>>;
  readonly motion: MoverRuntime | null;
}
