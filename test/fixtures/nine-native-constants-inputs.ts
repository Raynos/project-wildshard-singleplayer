import { headlessConstants } from '../../src/shards/nine-dragon-stack/generators/headless';

/** Original native facts in original wire order. The expected entry counts are
 * retained independent policy, never recomputed from the geometry under test. */
export function nineNativeConstantsInputs() {
  return structuredClone({ ...headlessConstants, entryProof: { lanes: 92, steps: 15984, portalTransfers: 8 } });
}
