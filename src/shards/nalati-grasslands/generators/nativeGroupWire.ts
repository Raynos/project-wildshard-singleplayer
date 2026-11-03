import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import type { parseNativeGroupRows } from '@wildshard/sdk/nativePopulationRows';

type GroupRows = ReturnType<typeof parseNativeGroupRows>;
type Step = GroupRows['steps'][number];
type GroupStep = Extract<Step, { kind: 'group' }>;
type WireStep = Exclude<Step, GroupStep> | (Omit<GroupStep, 'guest'> & {
  guest?: Omit<NonNullable<GroupStep['guest']>, 'program'>;
});
type GroupWire = Omit<GroupRows, 'steps'> & { steps: WireStep[] };

/** The wildlife owner already ships the complete pasture declaration. Only
 * identical guest copies may leave the native assembly; every binding stays. */
export function nalatiNativeGroupWire(input: GroupRows, pasture: unknown): GroupWire {
  const declaration = encodeCanonicalJson(pasture);
  return { ...input, steps: input.steps.map(step => {
    if (step.kind !== 'group' || step.guest === undefined) return step;
    if (encodeCanonicalJson(step.guest.program) !== declaration)
      throw new Error('Native group pasture differs from its wildlife owner');
    return { ...step, guest: { binding: step.guest.binding } };
  }) };
}
