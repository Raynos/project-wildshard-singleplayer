import { parse } from 'valibot';
import { MountedSpecimenSeatSchema } from '@wildshard/format/mountedSpecimenRows';
import rows from '../data/mountedFigure.json' with { type: 'json' };
import paint from '../data/poiPaint.json' with { type: 'json' };

/** The shepherd's seat rows with his two painted shapes inline (the riding session's figure and his Explorer card). */
export const MOUNTED_FIGURE = parse(MountedSpecimenSeatSchema, { ...rows,
  shapes: paint.rows.filter(row => row.key.startsWith('shepherd-')).map(({ key, data, geometry }) => ({ key, data, geometry })) });
