import { parse } from 'valibot';
import { MountedSpecimenSeatSchema } from '@wildshard/format/mountedSpecimenRows';
import rows from '../data/mountedFigure.json' with { type: 'json' };
import paint from '../data/poiPaint.json' with { type: 'json' };

/** The shepherd's seat rows with his two painted shape files (the riding session's figure and his Explorer card). */
export const MOUNTED_FIGURE: ReturnType<typeof parse<typeof MountedSpecimenSeatSchema>> = parse(MountedSpecimenSeatSchema, { ...rows,
  shapes: paint.rows.filter(row => row.key.startsWith('shepherd-')).map(({key,name,geometry})=>({key,file:name,geometry})) });
