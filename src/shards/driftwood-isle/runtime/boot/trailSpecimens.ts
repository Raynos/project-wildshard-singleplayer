import { Mesh, type Material, type Object3D } from 'three';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { createOwnedGeometry as modelGeometry } from '@wildshard/engine/models/ownedGeometry';
import { TRAIL_SPECIMENS } from '../../data/trailSpecimens';
import { TRAIL_SPECIMEN_ROWS } from '../../data/trailSpecimenRows';
import type { PlankStepParams, SignpostParams } from '../../models/trailside';

const key = (params: object): string => JSON.stringify(Object.entries(params).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
/** Admit the six original Explorer shapes. World placements borrow their existing fixed weld. */
export function trailSpecimen(kind: 'fence-post' | 'signpost' | 'plank-step', params: Record<string, never> | SignpostParams | PlankStepParams, material: Material): Object3D {
  const wanted = key(params), row = TRAIL_SPECIMEN_ROWS.find(candidate => candidate.kind === kind && key(candidate.params) === wanted);
  if (row === undefined) throw new Error('Trail model has no authored geometry');
  return loadingSpecimen(`driftwood-isle/${kind}`, row.size, async () => {
    const intake = modelGeometry(TRAIL_SPECIMENS[row.id]); await intake.load();
    const mesh = new Mesh(intake.take(), material); mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
  });
}
