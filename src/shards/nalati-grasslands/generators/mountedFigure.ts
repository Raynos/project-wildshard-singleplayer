import * as v from 'valibot';
import { MountedSpecimenSeatSchema } from '@wildshard/format/mountedSpecimenRows';
import rows from '../data/mountedFigure.json' with { type: 'json' };
import paint from '../data/poiPaint.json' with { type: 'json' };

/** The shepherd's seat rows with his two painted shape files (the riding session's figure and his Explorer card). */
export function nalatiMountedFigure(input: unknown): v.InferOutput<typeof MountedSpecimenSeatSchema> {
  const supplied = v.parse(v.object({ rows: v.array(v.object({ key: v.string(), name: v.string(), geometry: v.unknown() })) }), input);
  return v.parse(MountedSpecimenSeatSchema, { ...rows, shapes: supplied.rows.filter(row => row.key.startsWith('shepherd-'))
    .map(({ key, name, geometry }) => ({ key, file: name, geometry })) });
}

/** Retained predecessor view until the remaining synchronous readers migrate. */
export const MOUNTED_FIGURE: v.InferOutput<typeof MountedSpecimenSeatSchema> = nalatiMountedFigure(paint);
