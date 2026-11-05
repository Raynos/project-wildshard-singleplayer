import { NATIVE_ASSEMBLY_FILE, parseNativeAssembly } from '@wildshard/format/nativeAssembly';
import type { ShardProduct } from '../../src/game/shared/shardfile/shardProduct';
import type { PrepareHeadlessRuntime } from '../../src/sdk/headlessRuntime';
import manifest from '../../src/shards/nine-dragon-stack/manifest.json' with { type: 'json' };
import { prepareProductPlan } from './headless-native';
import { registerNativeWalkBounds } from './headless/nativeBounds';

/** Nine's own plan with the claw's rise turned off: the path a lifting crossing used to take. */
async function flatProduct(product: ShardProduct): Promise<ShardProduct> {
  const plan = parseNativeAssembly(await product.json(NATIVE_ASSEMBLY_FILE));
  const bytes = new TextEncoder().encode(JSON.stringify({ ...plan, features: plan.features.map(row => row.host === 'grapple' ? { ...row, rise: false } : row) }));
  return { ...product, file: name => name === NATIVE_ASSEMBLY_FILE ? Promise.resolve(bytes) : product.file(name) };
}

/** The world Nine's product builds, with the walk proofs' bounds lent over it. `rise` false is a negative control. */
export function nineHeadlessRuntime(rise: boolean): PrepareHeadlessRuntime {
  return async preparation => {
    const product = rise ? preparation.product : await flatProduct(preparation.product), plan = await prepareProductPlan({ ...preparation, product });
    return { ...plan, install: (host, context) => { registerNativeWalkBounds(host, manifest.bounds); plan.install(host, context); } };
  };
}

/** Current browser winner; the flat factory remains a negative QB17 control. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = nineHeadlessRuntime(true);
