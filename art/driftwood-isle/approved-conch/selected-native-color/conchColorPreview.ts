/** Isolated material-only candidate. Existing host, poses, decisions and lights are reused. */
import type { DecisionBuildOptions } from '@wildshard/sdk/buildDecisionScripts';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import { validateOutputProduct, writeOutputProduct } from '@wildshard/sdk/outputProduct';
import { mergeProjectBlobs, prepareProjectOutput } from '@wildshard/sdk/projectOutput';
import { createConchSelectedViewPreviewSource, createConchSelectedViewPreviewOutput } from '../selected-native-view/conchSelectedViewPreview';
import graph from './graph.json' with { type: 'json' };

export function createConchColorSource() {
  const source = createConchSelectedViewPreviewSource('neutral-gray-v2');
  return parseShardfile({ ...source, look: { ...source.look, materials: {
    ...source.look.materials, 'driftwood-creature': { family: 'graph', graph },
  } } });
}

export async function buildConchColorProduct(project: string, destination: string, options: DecisionBuildOptions, bodies: unknown): Promise<ReturnType<typeof validateOutputProduct>> {
  const source = createConchColorSource();
  const prepared = await prepareProjectOutput(project, createConchSelectedViewPreviewOutput(bodies), { source, options });
  const merged = mergeProjectBlobs(source, prepared.assets, prepared.blobs, prepared.options.namedFiles);
  writeOutputProduct(merged.shard, merged.assets, destination, { ...prepared.options, namedFiles: merged.namedFiles });
  return validateOutputProduct(destination);
}
