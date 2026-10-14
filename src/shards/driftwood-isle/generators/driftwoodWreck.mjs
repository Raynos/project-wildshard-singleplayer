import { readFileSync } from 'node:fs';
import { addVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { ShipwreckBuilder } from './shipwreck.ts';
import { wreckSite } from './wreckSite.ts';
import { driftwoodGroundSampler } from './groundSampling.ts';
import { WRECK_SITES } from '../data/wreckSites.ts';

/** The two admitted sites, using the original world AO and flat-ground specimen. */
export function originalWreck() {
  const bytes = Uint8Array.from(readFileSync(new URL('../../../../public/assets/models/driftwood-blender/voxel-ao.bin', import.meta.url)));
  const release = addVoxelAOBake(bytes.buffer);
  try {
    const world = wreckSite(WRECK_SITES.world, driftwoodGroundSampler());
    const builder = new ShipwreckBuilder(WRECK_SITES.specimen, () => 0), specimen = builder.build();
    return { world, specimen };
  } finally { release(); }
}
