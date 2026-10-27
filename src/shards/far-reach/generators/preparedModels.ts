import { skyHeroLibrarySource, HERO_LIBRARY_INPUTS } from './heroLibrary';
import { skyVanePartSource, VANE_INPUTS } from './vaneProgram';
import { PREPARED_MODEL_INPUTS, preparedModelSource } from './preparedModelProgram';

/** The retained writer consumes the same owned source program as future product readers. */
export function bakePreparedModels(read: (url: string) => Uint8Array): Promise<Uint8Array> {
  return preparedModelSource(new Map(PREPARED_MODEL_INPUTS.map(url => [url, read(url)])));
}

/** The authored vane post; flat channels stay exact through the standard facet library. */
export const bakeVanePost = (read: (url: string) => Uint8Array): Promise<Uint8Array> => skyVanePartSource(new Map(VANE_INPUTS.map(url => [url, read(url)])), 0);
/** The authored vane rotor in its local 2.2 metre pivot frame. */
export const bakeVaneRotor = (read: (url: string) => Uint8Array): Promise<Uint8Array> => skyVanePartSource(new Map(VANE_INPUTS.map(url => [url, read(url)])), 1);

/** Prepared geometry and original atlas rows; the author explicitly names nonempty NPC parts. */
export async function bakePreparedLibrary(read: (url: string) => Uint8Array): Promise<Uint8Array> {
  const rows = await skyHeroLibrarySource(new Map(HERO_LIBRARY_INPUTS.map(url => [url, read(url)])));
  return new TextEncoder().encode(`${JSON.stringify(rows)}\n`);
}
