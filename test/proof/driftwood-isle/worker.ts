import type { HeadlessRuntimePreparation, HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { installPortableMath } from '../../fake/portableMath';

/** The same real entry in the SDK worker, with the witness's portable transcendental math installed before its imports. */
export async function prepareHeadlessRuntime(preparation: HeadlessRuntimePreparation): Promise<HeadlessRuntimePlan> {
  installPortableMath();
  const runtime = await import('../../../src/shards/driftwood-isle/runtime/headless');
  return runtime.prepareHeadlessRuntime(preparation);
}
