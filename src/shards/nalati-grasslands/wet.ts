import { wetMask } from './world/geography';

/** Baked walker corridor, including the elevated meltwater stream. */
export function nalatiWetAt(x: number, z: number): boolean { return wetMask(x, z) > 0.5; }
