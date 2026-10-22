import { speciesBehaviour, type HullLookBook } from '@wildshard/game/looks/speciesBook';
import type { CreatureGuestRows, SpeciesPresentationRows } from '@wildshard/format/speciesBookRows';

let book:HullLookBook|null=null,looks:ReturnType<HullLookBook['packedLooks']>|null=null,behaviour:ReturnType<typeof speciesBehaviour>|null=null;
let speciesData: SpeciesPresentationRows | null = null;
/** Product JSON is admitted before the first creature build or frame: the looks are the hull book's packed looks. */
export function prepareNalatiSpecies(data: SpeciesPresentationRows, hull: HullLookBook, lookRows: unknown): void {
  speciesData = data;
  book ??= hull; looks ??= hull.packedLooks(lookRows); behaviour ??= speciesBehaviour(data.lookBook);
}
/** The page and specimens share the same data-owned packed body cache. */
export function nalatiPackedLooks():ReturnType<HullLookBook['packedLooks']>{if(looks===null)throw new Error('Species looks are not prepared');return looks;}
/** The species rows' behaviour hooks (outside the look book until L4 / L5). */
export function nalatiBehaviour():ReturnType<typeof speciesBehaviour>{if(behaviour===null)throw new Error('Species behaviour is not prepared');return behaviour;}
export async function preloadNalatiBodies():Promise<void>{if(book===null)throw new Error('Species looks are not prepared');await book.packed.preload();}

export function speciesGuestRows(): CreatureGuestRows { if (speciesData === null) throw new Error('Missing species guest program'); return speciesData.guest; }
