import { lateSceneMaterialFiles } from '@wildshard/sdk/worldScenes';
import type { ProjectOutput } from '@wildshard/sdk/projectOutput';
import type { TimberWorld } from './timberWorldRows';
import { HAMLET } from './layout';

/** Fine landmark maps already wait behind the coarse placement, and cabin
 * props behind the late shell weld. Their product receipts share that fence. */
export function pineLateMaterialFiles(files: NonNullable<ProjectOutput['namedFiles']>, landmarks: TimberWorld['landmarks']): ReturnType<typeof lateSceneMaterialFiles> {
  const nearest = (poses: readonly { readonly x: number; readonly z: number }[]): [number, number] => {
    const point = [...poses].sort((a, b) => a.x ** 2 + (a.z + 235) ** 2 - b.x ** 2 - (b.z + 235) ** 2)[0];
    if (point === undefined) throw new Error('Late landmark material needs its original placement');
    return [point.x, point.z];
  };
  const marks = [...landmarks.stones.map(row => ({ id: row.kind, poses: row.places })),
    { id: 'waystone', poses: landmarks.waystones }, { id: 'beaver-dam', poses: landmarks.dam },
    { id: 'canoe', poses: landmarks.canoe }, { id: 'contract-board', poses: landmarks.board }, { id: 'cave-arch', poses: [landmarks.arch] }];
  return lateSceneMaterialFiles(files, [
    ...marks.map(row => ({ variantOf: `pine-hollow-hero/${row.id}`, at: nearest(row.poses) })),
    ...['hatchet', 'wine_barrel_01', 'wooden_bucket_01', 'wooden_crate_02'].map(variantOf => ({ variantOf, at: [HAMLET.x, HAMLET.z] as const })),
  ]);
}
