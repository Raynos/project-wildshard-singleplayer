import { Box3, Matrix4, Vector3, type BufferGeometry } from 'three';
import { modelGeometry } from '@wildshard/sdk/modelGeometry';
import { FIXED_MODEL_FILES } from '../data/modelFiles';
import bake from '../data/coveBake.json' with { type: 'json' };
import { coveSpecKey, type CoveSpec } from '../world/coveLayout';

const templates = {
  structure: modelGeometry(FIXED_MODEL_FILES.coveStructure),
  rocks: modelGeometry(FIXED_MODEL_FILES.coveRocks),
  glow: modelGeometry(FIXED_MODEL_FILES.coveGlow),
  pools: modelGeometry(FIXED_MODEL_FILES.covePools),
};

/** Explicit intake; a fixture can admit these same immutable templates without fetch. */
export async function loadCoveGeometry(bytes?: ReadonlyMap<string, Uint8Array>): Promise<void> {
  await Promise.all([
    templates.structure.load(bytes?.get(FIXED_MODEL_FILES.coveStructure)),
    templates.rocks.load(bytes?.get(FIXED_MODEL_FILES.coveRocks)),
    templates.glow.load(bytes?.get(FIXED_MODEL_FILES.coveGlow)),
    templates.pools.load(bytes?.get(FIXED_MODEL_FILES.covePools)),
  ]);
}

/** The authored island is one admitted layout. Refuse a different spec rather than draw geometry with mismatched collision. */
export function copyCoveGeometry(spec: CoveSpec): {
  geometry: Record<keyof typeof templates, BufferGeometry>;
  placements: { m: Matrix4; r: number; squash: number; moss: number; box: Box3 }[];
} {
  if (coveSpecKey(spec) !== bake.specKey) throw new Error('Cove layout changed; regenerate its fixed geometry');
  return {
    geometry: {
      structure: templates.structure.copy(), rocks: templates.rocks.copy(),
      glow: templates.glow.copy(), pools: templates.pools.copy(),
    },
    placements: bake.placements.map(row => {
      const m = new Matrix4().fromArray(row.matrix);
      // JSON normalizes -0. Retain those matrix entries too, so every placement number matches the builder.
      for (const index of row.matrixNegativeZero) m.elements[index] = -0;
      return { m, r: row.r, squash: row.squash, moss: row.moss,
        box: new Box3(new Vector3().fromArray(row.min), new Vector3().fromArray(row.max)) };
    }),
  };
}
