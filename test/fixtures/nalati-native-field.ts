import * as v from 'valibot';
import { PopulationFieldSchema } from '../../src/format/populationEnvironment';

/** Independent pre-retirement river recipe, evaluated on the producer's host.
 * Frozen field and assembly pins still check the original Darwin publication;
 * current construction checks every native f64 sample, without a tolerance. */
export function nativeFieldFromOriginal(input: unknown): v.InferOutput<typeof PopulationFieldSchema> {
  const before = v.parse(PopulationFieldSchema, input);
  return { ...before, river: { from: -250, step: 1,
    values: Array.from({ length: 501 }, (_, index): [number, number] => {
      const x = index - 250, s = Math.min(1, Math.max(0, (Math.abs(x) - 8) / 52));
      return [168 + 4 * Math.exp(-((x / 70) ** 2)) + 5 * Math.sin(x * .017) + 3 * Math.sin(x * .041 + 1.3) - 3 * Math.sin(1.3),
        (15 + 3 * Math.sin(x * .009 + 2.1) + 2 * Math.sin(x * .031)) * (.62 + .38 * s * s * (3 - 2 * s))];
    }),
  } };
}
