import { HullLookBook } from '@wildshard/game/looks/speciesBook';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';

let admitted: HullLookBook | undefined;
function book(): HullLookBook { if (admitted === undefined) throw new Error('Pine grazers are not admitted'); return admitted; }
/** Page and cold Explorer admit the same checked rest-body and coat rows. */
export function preparePineGrazers(product: { readonly section: (name: 'custom/nativeView') => { SPECIES_LOOKS: unknown } }): Promise<void> {
  admitted = new HullLookBook(product.section('custom/nativeView').SPECIES_LOOKS);
  return Promise.resolve();
}
export function pineGrazer(kind: 'deer' | 'elk'): ReturnType<HullLookBook['definition']> { return book().definition(kind); }
export function pineLook(kind: string): SpeciesLook { return book().look(kind); }
/** The caller's legacy thrall argument is already compiled into the admitted book. */
export function pineLooks(_thrall?: unknown): readonly SpeciesLook[] { return book().looks; }
