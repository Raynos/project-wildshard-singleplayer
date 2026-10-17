import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { addVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import { buildTerrainMetadata } from '@wildshard/engine/world/terrainField';
import { driftwoodGroundSampler } from './groundSampling.ts';
import { SEED, TRAILS, PLATEAU, HEADLAND } from './landscapeRows.ts';
import SHRINE_SITES from '../data/shrineSites.json' with { type: 'json' };
import WRECK_SITES from '../data/wreckSites.json' with { type: 'json' };
import { islandCoveSpec } from './coveLayout.ts';
import { driftLogBox } from './driftLogs.ts';
import { duneLogs } from './duneLogs.ts';

/** Compile the native dune ring and its drawn-into catalogue from the authored terrain. */
export function originalDuneLogs() {
  const ground = driftwoodGroundSampler(), cave = islandCoveSpec().cave;
  const avoid = [
    { x: PLATEAU.x + 2, z: PLATEAU.z - 2, r: 9 }, { x: HEADLAND.x - 4, z: HEADLAND.z - 2, r: 8 },
    { x: SHRINE_SITES.world.x, z: SHRINE_SITES.world.z, r: 9.5 }, { x: WRECK_SITES.world.x, z: WRECK_SITES.world.z, r: 13 },
    { x: cave.x, z: cave.z + cave.depth / 2, r: 8 }, { x: 0, z: -151, r: 3.2 },
  ];
  const trailDistance = buildTerrainMetadata(SEED, { trails: TRAILS, cabinSites: [] }, () => 0).trailDistance;
  const ao = Uint8Array.from(readFileSync(new URL('../../../../public/assets/models/driftwood-blender/voxel-ao.bin', import.meta.url)));
  const release = addVoxelAOBake(ao.buffer);
  try {
    const { geometry, logs } = duneLogs(ground, trailDistance, avoid, 0, SEED);
    /** @type {number[]} */
    const boxes = []; const box = new THREE.Box3();
    const placements = logs.map((l) => {
      driftLogBox(l.a, l.b, l.r, box);
      boxes.push(box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z);
      const d = l.b.clone().sub(l.a);
      return { x: (l.a.x + l.b.x) / 2, y: (l.a.y + l.b.y) / 2, z: (l.a.z + l.b.z) / 2, yaw: Math.atan2(-d.z, d.x), params: { len: d.length(), r0: l.r, r1: l.r * 0.7, tone: ((l.tone % 3) + 3) % 3 } };
    });
    return { geometry, catalogue: { placements, boxes } };
  } finally { release(); }
}
