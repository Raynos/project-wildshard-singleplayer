import { HullLookBook } from '@wildshard/game/looks/speciesBook';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';

let admitted: HullLookBook | undefined;
function book(): HullLookBook { if (admitted === undefined) throw new Error('Pine grazers are not admitted'); return admitted; }
/** Page and cold Explorer admit the same checked rest-body and coat rows. */
export async function preparePineGrazers(product: { readonly json: (name: string) => Promise<{ SPECIES_LOOKS: unknown }> }): Promise<void> {
  const rows = await product.json('look/native-view.json');
  admitted = new HullLookBook(rows.SPECIES_LOOKS);
}
export function pineGrazer(kind: 'deer' | 'elk'): ReturnType<HullLookBook['definition']> { return book().definition(kind); }
export function pineLook(kind: string): SpeciesLook { return book().look(kind); }
/** The caller's legacy thrall argument is already compiled into the admitted book. */
export function pineLooks(_thrall?: unknown): readonly SpeciesLook[] { return book().looks; }
