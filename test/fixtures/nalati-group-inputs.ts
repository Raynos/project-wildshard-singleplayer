import * as v from 'valibot';
import { NativeGroupRowsSchema } from '@wildshard/format/creatures';
import { WildlifePopulationSchema } from '@wildshard/format/wildlifePopulation';

/** Rejoin only the duplicate pasture declarations. The original complete
 * group parser still admits every ordered step, contact and guest binding. */
export function nalatiGroupInputs(input: unknown, wildlife: unknown): v.InferOutput<typeof NativeGroupRowsSchema> {
  const pasture = v.parse(WildlifePopulationSchema, wildlife).pasture;
  const rows = v.parse(v.looseObject({ steps: v.array(v.looseObject({ kind: v.string() })) }), input);
  return v.parse(NativeGroupRowsSchema, { ...rows, steps: rows.steps.map(step => {
    if (step.kind !== 'group' || step['guest'] === undefined) return step;
    // An embedded programme must never override the defining wildlife owner.
    const guest = v.parse(v.strictObject({ binding: v.unknown() }), step['guest']);
    return { ...step, guest: { ...guest, program: pasture } };
  }) });
}
