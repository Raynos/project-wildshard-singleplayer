import * as v from 'valibot';
import { vi } from 'vitest';
import { SpeciesPresentationSchema } from '@wildshard/format/speciesBookRows';
import { HullLookBookSchema } from '@wildshard/format/speciesLooks';
import { originalSpeciesJson, originalSpeciesFile } from './nalati-original-species';

let installed: Promise<void> | undefined;
/** Lend the complete original species and packed bodies without unrelated world setup. */
export function installNalatiSpeciesFixture(): Promise<void> { return installed ??= prepare(); }

async function prepare(): Promise<void> {
  const { registerSpecies } = await import('../../src/engine/entities/species/registry');
  const { speciesWithLook } = await import('../../src/engine/entities/species/look');
  const { nalatiSpeciesCatalogue, prepareNalatiSpecies } = await import('../fake/nalatiSpecies');
  // Admit the complete original envelope; its looks retain their defining
  // packed-look admission inside productSpeciesCatalogue.
  const speciesPresentation = v.parse(v.object({
    hullBook: HullLookBookSchema, presentation: SpeciesPresentationSchema, looks: v.unknown(),
    crackBytes: v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(255))),
    packedBodies: v.object({ file: v.string() }),
  }), originalSpeciesJson('species.json'));
  const { productSpeciesCatalogue } = await import('../../src/game/looks/speciesBook');
  prepareNalatiSpecies(productSpeciesCatalogue({section:()=>speciesPresentation.hullBook,
    file: name => name === 'actors/balbal-cracks.bin' ? Promise.resolve(Uint8Array.from(speciesPresentation.crackBytes)) : Promise.reject(new Error(`Unexpected product file ${name}`)) },speciesPresentation.presentation,speciesPresentation.looks));
  for(const row of nalatiSpeciesCatalogue().rows){
    const look=nalatiSpeciesCatalogue().looks.find(candidate=>candidate.kind===row.kind);
    if(look===undefined)throw new Error('Missing species look');
    registerSpecies(speciesWithLook(row,look));
  }
  // Production uses the packed-body host; preload its exact binary through its normal fetch port.
  const speciesBodies = speciesPresentation.packedBodies;
  const bodyFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(input => {
    if (input !== speciesBodies.file) throw new Error('Unexpected packed-body preload');
    return Promise.resolve(new Response(originalSpeciesFile('bodies.bin')));
  });
  try { await nalatiSpeciesCatalogue().preload(); } finally { bodyFetch.mockRestore(); }
}
