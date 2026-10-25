import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { nineLayoutSource } from './layout';

/** Original ordered layout rows, float64 records and measured geometry bounds. */
export interface NineLayoutData {
  readonly version: 1; readonly count: number;
  readonly rows: ReturnType<typeof nineLayoutSource>['rows']; readonly records: ReturnType<typeof nineLayoutSource>['records'];
  readonly bounds: { readonly sphere: number[]; readonly box: number[] }[];
}
/** Measure the source layout without constructing world GLBs, spill, or an atlas consumer. */
export function projectNineLayout(layout: ReturnType<typeof nineLayoutSource>): NineLayoutData {
  const bounds = layout.geometries.map(geometry => {
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    const { boundingSphere: sphere, boundingBox: box } = geometry;
    if (sphere === null || box === null) throw new Error('Nine layout geometry has no bounds');
    return { sphere: [...sphere.center, sphere.radius], box: [...box.min, ...box.max] };
  });
  return { version: 1, count: layout.records.length, records: layout.records, rows: layout.rows, bounds };
}
/** Remaining native adapters call the defining source under its existing portable math law. */
export function nineLayoutData(): NineLayoutData { return withPortableMath(() => projectNineLayout(nineLayoutSource())); }
