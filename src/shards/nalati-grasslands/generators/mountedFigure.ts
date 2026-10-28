import * as v from 'valibot';
import { authorFormatRows } from '@wildshard/sdk/formatJsonSchema';
import rows from '../data/mountedFigure.json' with { type: 'json' };

/** The shepherd's seat rows with his two painted shape files (the riding session's figure and his Explorer card). */
export function nalatiMountedFigure(input: unknown): ReturnType<typeof authorFormatRows<'mountedSpecimenRows.MountedSpecimenSeatSchema'>> {
  const supplied = v.parse(v.object({ rows: v.array(v.object({ key: v.string(), name: v.string(), geometry: v.unknown() })) }), input);
  return authorFormatRows('mountedSpecimenRows.MountedSpecimenSeatSchema', { ...rows, shapes: supplied.rows.filter(row => row.key.startsWith('shepherd-'))
    .map(({ key, name, geometry }) => ({ key, file: name, geometry })) });
}

