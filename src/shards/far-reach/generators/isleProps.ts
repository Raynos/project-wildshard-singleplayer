import { Group, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import { bakeProps, type BakedProps } from '@wildshard/sdk/bake/props';
import { ISLES } from '../data/layout';
import { RISING_ISLETS } from '../world/islets';
import { isleNode } from '../data/isleLook';
import { bakeSkyIsles } from './isles';

/**
 * Build-time only (SHARD-PLATFORM M3, honest tiles): Sky Reach's twelve static islands (the eight playable and the four gate
 * isles; the moving islets stay in `baked/isles.bin`) as compiled props tiles, each island kept whole at its own position
 * (`bakeProps` `whole`: never cut at a tile seam, its baked triangles and vertex paint exactly as `islandMesh` draws them),
 * in the L0 tile holding its centre. The trusted runtime binds the section and draws every island in the painted
 * island material (world/isle.ts); `generators/bake-sky-world.mjs` writes `data/props.json` and the tile GLBs.
 */
export function skyIsleProps(): BakedProps {
  const { bin, rows } = bakeSkyIsles(), pack = new GeometryPack(bin, packedRows(rows), 'far-reach isles');
  const whole = [...ISLES, ...RISING_ISLETS.map((entry) => entry.gate)].map((isle) => {
    const geometry = pack.geometry(rows.isles.indexOf(isle.id)); geometry.computeVertexNormals();
    return { id: isleNode(isle.id), mesh: new Mesh(geometry, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })), transform: new Matrix4().makeTranslation(isle.x, isle.y, isle.z) };
  });
  const baked = bakeProps({ static: new Group(), whole, family: 'toon' });
  for (const { mesh } of whole) { mesh.geometry.dispose(); mesh.material.dispose(); }
  return baked;
}
