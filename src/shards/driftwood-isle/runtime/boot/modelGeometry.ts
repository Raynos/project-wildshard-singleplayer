import type { BufferGeometry } from 'three';
import type { readWholeGeometry } from '@wildshard/game/plugin/geometry';
import { FIXED_MODEL_FILES } from '../../data/modelFiles';

/** Decode the admitted scene's subsets through the shared assembler; original materials and placements stay local. */
export type ProductGeometryOwner = Parameters<typeof readWholeGeometry>[0];
export async function readProductGeometry(owner: ProductGeometryOwner): Promise<{ templates: Map<string, BufferGeometry>; release: () => void }> {
  const { readWholeGeometry } = await import('@wildshard/game/plugin/geometry');
  const assembled = await readWholeGeometry(owner, 'driftwood-isle'), result = new Map<string, BufferGeometry>();
  const urls = Object.values(FIXED_MODEL_FILES);
  if (urls.length !== 74) throw new Error('Driftwood requires all authored source draws');
  for (let i = 0; i < 74; i++) {
    const url = urls[i]; if (url === undefined) throw new Error('Missing Driftwood source draw URL');
    const id = url.slice(url.lastIndexOf('/') + 1, -4), view = assembled.get(id);
    if (view === undefined) throw new Error(`Missing admitted Driftwood source draw: ${id}`);
    result.set(url, view.geometry);
  }
  if (assembled.size !== result.size) throw new Error('Unexpected admitted Driftwood source draw');
  return { templates: result, release: () => {
    for (let i = 0; i < 74; i++) {
      const url = urls[i]; if (url === undefined) throw new Error('Missing Driftwood source draw URL');
      const id = url.slice(url.lastIndexOf('/') + 1, -4);
      assembled.get(id)?.release?.();
    }
  } };
}
