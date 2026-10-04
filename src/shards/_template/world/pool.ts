import type { WaterBody } from '@wildshard/engine';

export const poolMask = (x: number, z: number): boolean => Math.hypot(x - 25, z - 20) < 5;
export const POOL: WaterBody = { id: 'template.pool', level: 0,
  restAt: (x, z) => poolMask(x, z) ? 0 : null,
  surfaceAt: () => 0, inside: (x, z, y) => poolMask(x, z) && y < 0 };
