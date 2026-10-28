import { specimenShapeSources } from '@wildshard/sdk/bake/specimenCatalogue';
import { authorFormatRows } from '@wildshard/sdk/formatJsonSchema';
import rows from '../data/mountedFigure.json' with { type: 'json' };

/** The shepherd's seat rows with his two painted shape files (the riding session's figure and his Explorer card). */
export function nalatiMountedFigure(input: unknown): ReturnType<typeof authorFormatRows<'mountedSpecimenRows.MountedSpecimenSeatSchema'>> {
  const supplied = specimenShapeSources(input);
  return authorFormatRows('mountedSpecimenRows.MountedSpecimenSeatSchema', { ...rows, shapes: supplied.filter(row => row.key.startsWith('shepherd-'))
    .map(({ key, name, geometry }) => ({ key, file: name, geometry })) });
}

