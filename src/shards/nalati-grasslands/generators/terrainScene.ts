import { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { compressGlb } from '@wildshard/sdk/bake/glbCompression';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import type { PainterField } from '@wildshard/engine/render/look';
import { buildPainterlyGeometry, buildPainterlySlab, type TerrainPaintSource } from './terrainPainter';

/** The original native sampler and arithmetic run offline, without a renderer or physics world. */
export function terrainSceneBlobs(field: PainterField, source: TerrainPaintSource): NamedBlob[] {
  const steps = buildPainterlyGeometry(field, source);
  let step = steps.next();
  while (step.done !== true) step = steps.next();
  const shapes = [['ground', step.value], ['slab', buildPainterlySlab(field, source)]] as const;
  const material = new MeshBasicMaterial();
  try {
    return shapes.map(([id, geometry]) => nameBlob(`world/terrain/${id}.glb`, 'glb', compressGlb(staticGlb([{
      geometry, material, compactIndex: true, nativeAttributes: true,
      customAttributes: { _SURF: '_surf', _RDIR: '_rdir', _ZONE: '_zone' },
    }], id))));
  } finally { material.dispose(); for (const [, geometry] of shapes) geometry.dispose(); }
}

/** Preserve the original WaterSurface draw while moving its numeric payload out of private JSON. */
export function waterSceneBlob(row: { readonly position: readonly number[]; readonly water: readonly number[]; readonly index: readonly number[] }): NamedBlob {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(row.position, 3))
    .setAttribute('aWater', new Float32BufferAttribute(row.water, 4)).setIndex([...row.index]);
  const material = new MeshBasicMaterial();
  try { return nameBlob('world/water.glb', 'glb', compressGlb(staticGlb([{ geometry, material, compactIndex: true, nativeAttributes: true, customAttributes: { _WATER: 'aWater' } }]))); }
  finally { geometry.dispose(); material.dispose(); }
}
