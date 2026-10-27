import { Group, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import { bakeProps, type BakedProps } from '@wildshard/sdk/bake/props';
import { coarseCopy } from '@wildshard/sdk/bake/coarseCopy';
import { ISLES } from "./layout";
import { RISING_ISLETS } from './risingIslets';
import { bakeSkyIsles } from './isles';

/**
 * Build-time only (SHARD-PLATFORM M3, honest tiles): Sky Reach's twelve static islands (the eight playable and the four gate
 * isles; the moving islets stay in `baked/isles.bin`) as compiled props tiles, each island kept whole at its own position
 * (`bakeProps` `whole`, partitioned: each triangle in the L0 tile holding its centroid, its baked vertices, index and paint
 * kept with the ordinals that reassemble the island exactly), the shardfile's tiles; the ground scene reads each island
 * back whole (islandScenes.ts SKY_ISLE_TILES); `generators/bake-sky-world.mjs` writes `data/props.json` and the tile GLBs.
 */
export function skyIsleProps(): BakedProps {
  const { bin, rows } = bakeSkyIsles(), pack = new GeometryPack(bin, packedRows(rows), 'far-reach isles');
  const whole = [...ISLES, ...RISING_ISLETS.map((entry) => entry.gate)].map((isle) => {
    const geometry = pack.geometry(rows.isles.indexOf(isle.id)); geometry.computeVertexNormals();
    return { id: `isle_${isle.id.replace('.', '-')}`, partition: 'runs' as const, mesh: new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })), transform: new Matrix4().makeTranslation(isle.x, isle.y, isle.z) };
  });
  // G748 / U2: the L1 tiles beyond the render ring draw the isles simplified in their own toon look (whole shapes are
  // never in the default coarse source, so the occupied parents had no L1 at all)
  const coarse = coarseCopy(whole, 0.1, 2);
  const baked = bakeProps({ static: new Group(), whole, family: 'toon', coarse: coarse.group });
  for (const { mesh } of whole) { mesh.geometry.dispose(); mesh.material.dispose(); }
  coarse.dispose();
  return baked;
}
