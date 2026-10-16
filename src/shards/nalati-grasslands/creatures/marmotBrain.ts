import * as v from 'valibot';
import { Rng } from '@wildshard/engine/core/rng';
import { ForagerPopulation } from '@wildshard/engine/ai/ambientForager';
import { ForagerPopulationSchema } from '@wildshard/format/ambientLife';
import marmotRow from './marmotForager.json' with { type: 'json' };

/** the marmot colonies on the ambient-forager population host (`marmotForager.json`), seeded apart from the herds */
export const marmotColonies = (seed: number): ForagerPopulation => new ForagerPopulation(v.parse(ForagerPopulationSchema, marmotRow), seed ^ 0x6a2b);

/** burrow sites: `n` spots on open, gentle ground (`normalY`) inside the given box, seeded */
export function marmotSites(seed: number, n: number, box: { x0: number; x1: number; z0: number; z1: number }, normalY: (x: number, z: number) => number): { x: number; z: number }[] {
  if (!Number.isInteger(n) || n < 0 || n > 64) throw new RangeError('Marmot site bound exceeded');
  const rng = new Rng(seed ^ 0x1717), out: { x: number; z: number }[] = [];
  for (let i = 0; i < 1280 && i < n * 20 && out.length < n; i++) {
    const x = rng.range(box.x0, box.x1), z = rng.range(box.z0, box.z1);
    if (Math.abs(x) > 230 || Math.abs(z) > 230 || normalY(x, z) < 0.93 || out.some(o => Math.hypot(o.x - x, o.z - z) < 25)) continue;
    out.push({ x, z });
  }
  return out;
}
