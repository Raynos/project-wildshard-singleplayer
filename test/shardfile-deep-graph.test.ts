import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile, shardfileRules } from '../src/game/shardfile/schema';
import { preflightAssetGraph } from '../src/game/shardfile/assetGraph';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '../src/game/shardfile/admissionLimits';

it('admits a maximum-length dependency chain without recursive walking and refuses its cycle', () => {
  const source = emptyShardfile({ slug: 'deep-graph', name: 'Graph', author: 'Local', seed: 1, revision: 1 });
  const hash = (index: number) => index.toString(16).padStart(64, '0');
  source.files = Array.from({ length: limits.files }, (_value, index) => ({ hash: hash(index), kind: 'binary', compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0, critical: false, dependencies: index < limits.files - 1 ? [hash(index + 1)] : [] }));
  source.library = [hash(0)];
  const admitted = parseShardfile(source); expect(() => preflightAssetGraph(admitted)).not.toThrow();
  source.files.at(-1)?.dependencies.push(hash(0)); expect(shardfileRules(source)).toContain('acyclic dependencies'); expect(() => parseShardfile(source)).toThrow('semantic');
});
