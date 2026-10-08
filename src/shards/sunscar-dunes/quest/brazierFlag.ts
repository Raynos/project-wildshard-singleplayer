import { FLAG } from '../data/flags';

/** Brazier i's lit flag (`sunscar.brazier.<i>`); the prefix is data in data/flags.ts, which holds no functions (SP3 rows are data). */
export const brazierFlag = (i: number): string => `${FLAG.brazierPrefix}${String(i)}`;
