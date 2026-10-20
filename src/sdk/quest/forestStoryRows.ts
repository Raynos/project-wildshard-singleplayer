import type { HeldLoadout } from '@wildshard/game/loadout/held';
import type { InteractTable } from '@wildshard/engine/world/interact/types';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import type { ShopGood } from '@wildshard/game/loot/ui/ShopPanel';
import type { installChapterLead, installQuestSpawnDirector } from '@wildshard/game/quest/chapterDirector';
import type { MoverRuntime } from '@wildshard/game/plugin/mover';
import type { InteractionRowsData } from '@wildshard/format/questInteractions';
import type { PackedGeometryJson } from '../kit/geometryPack';

interface Point { x: number; z: number }
type Triple = [number, number, number];
/** Story content remains in its admitted section; hosts validate subcontracts. */
export interface ForestStoryContent {
  readonly table: InteractTable; readonly interactions: InteractionRowsData; readonly steps: unknown;
  readonly lead: { program: unknown }; readonly events: unknown; readonly pageDeaths: unknown; readonly content: unknown;
}
/** Existing shop cards carry the authored transaction identity. */
export interface ForestStoryGood extends ShopGood { readonly trade: { readonly id: string } }
/** Data-only page composition over forest, ranged equipment and quest hosts. */
export interface ForestStoryRows {
  readonly page: string; readonly ranged: string; readonly content: `custom/${string}`;
  readonly ammo: Parameters<HeldLoadout['addAmmo']>[0];
  readonly panels: { readonly board: string; readonly count: string };
  readonly files: Readonly<Record<'stall' | 'exchange' | 'contracts' | 'signals' | 'door' | 'transactions' | 'services' | 'director', string>>;
  readonly figures: { readonly catalogue: string; readonly ids: string[] };
  readonly parts: { readonly url: string; readonly rows: PackedGeometryJson; readonly label: string };
  readonly store: { readonly slot: string; readonly state: string };
  readonly collections: readonly { readonly event: string; readonly completeEvent: string; readonly prefix: string; readonly names: readonly string[];
    readonly label: string; readonly complete: string; readonly item?: string; readonly take?: string; readonly fallback?: string; readonly shelf?: string }[];
  readonly pickupEvent: string;
  /** `lantern`: the forest page lantern this signal lights while any of its `when` flags is set */
  readonly signals: readonly (Point & { readonly id: string; readonly height: number; readonly lantern: { readonly id: string; readonly when: readonly string[] } })[];
  readonly wheel: { readonly flag: string; readonly speed: number };
  readonly door: { readonly building: string; readonly flag: string };
  readonly trades: { readonly section: `custom/${string}`; readonly finishes: readonly string[]; readonly name: string; readonly place: string; readonly figure: string; readonly call: string };
  readonly board: { readonly at: Point & { readonly yaw: number }; readonly label: string; readonly filled: string };
  readonly payment: { readonly flag: string; readonly speaker: string; readonly action: string; readonly call: string };
  readonly cable: { readonly id: string; readonly geometry: number; readonly prompt: Triple; readonly radius: number; readonly label: string;
    readonly top: Triple; readonly launch: Triple; readonly landing: Triple; readonly arrival: string };
  /** `rest`: the scene object standing in for the mover at rest, hidden while it is away */
  readonly mover: { readonly id: string; readonly geometry: number; readonly system: string; readonly rest: string };
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
  readonly motion: MoverRuntime | null; readonly moverAway: boolean;
  readonly bindAudio: (id: string) => void;
}
