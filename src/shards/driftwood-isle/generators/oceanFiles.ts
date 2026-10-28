import { driftwoodOceanBank } from './oceanBank';

/** Sea datum and content URLs supplied by the grid/floor byte producer. */
export const OCEAN_FILES = { level: 0, ...driftwoodOceanBank().urls } as const;
