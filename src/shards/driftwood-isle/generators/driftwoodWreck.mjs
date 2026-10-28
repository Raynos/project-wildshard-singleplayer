import { withFacetedAO } from '@wildshard/sdk/bake/facetedGeometry';
import { ShipwreckBuilder } from './shipwreck.ts';
import { wreckSite } from './wreckSite.ts';
import { driftwoodGroundSampler } from './groundSampling.ts';
import WRECK_SITES from '../data/wreckSites.json' with { type: 'json' };

/** The two admitted sites, using the original world AO and flat-ground specimen. */
/** @param {Uint8Array} aoBytes caller-owned committed native AO table */
export function originalWreck(aoBytes) {
  return withFacetedAO(aoBytes, () => {
    const world = wreckSite(WRECK_SITES.world, driftwoodGroundSampler());
    const builder = new ShipwreckBuilder(WRECK_SITES.specimen, () => 0), specimen = builder.build();
    return { world, specimen };
  });
}
