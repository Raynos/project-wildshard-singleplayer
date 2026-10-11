import type { HeadlessRuntimePreparation, HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { installPortableMath } from '../../fake/portableMath';

/** The same real Sky entry in the SDK worker, with the recorder's portable math installed before its imports. */
export async function prepareHeadlessRuntime(preparation: HeadlessRuntimePreparation): Promise<HeadlessRuntimePlan> {
  installPortableMath();
  const runtime = await import('../../../src/shards/far-reach/runtime/headless');
  return runtime.prepareHeadlessRuntime(preparation);
}
