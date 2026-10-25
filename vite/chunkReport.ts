import type { Plugin } from 'vite';
import { gzipSync } from 'node:zlib';
import { relative, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { genShards, shardFolders } from '../scripts/gen-shards.mjs';
import { gridSessionBudgetErrors, titleClosureBudgetErrors } from '../scripts/check-chunks.mjs';

/** Data closures share startup; plugin code stays in exactly one chunk per discovered shard. */
interface ChunkGroup { name: string; test: RegExp | ((id: string) => boolean); priority: number; includeDependenciesRecursively: boolean }
export function shardChunkGroups(root = process.cwd()): ChunkGroup[] {
  genShards(root);
  const closures = JSON.parse(readFileSync(resolve(root, 'src/game/shard/manifest-closure.generated.json'), 'utf8')) as Record<string, string[]>;
  const closure = new Set(Object.values(closures).flat());
  const idOf = (id: string): string => relative(root, id.split('?')[0] ?? id).replaceAll('\\', '/');
  return [
    { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 30, includeDependenciesRecursively: false },
    { name: 'engine', test: (id: string) => /^(?:src\/(?:engine|game|kit)\/)/.test(idOf(id)) || closure.has(idOf(id)), priority: 20, includeDependenciesRecursively: false },
    ...shardFolders(root).map((slug) => ({ name: `shard-${slug}`, test: (id: string): boolean => idOf(id).startsWith(`src/shards/${slug}/`) && !closure.has(idOf(id)), priority: 10, includeDependenciesRecursively: false })),
  ];
}

export function chunkReport(): Plugin {
  let root = process.cwd();
  return {
    name: 'wildshard-chunk-report',
    configResolved(config) { root = config.root; },
    generateBundle(_options, bundle) {
      const report: Record<string, { name: string; moduleIds: string[]; rawBytes: number; gzBytes: number; imports: string[] }> = {};
      for (const [file, chunk] of Object.entries(bundle)) {
        if (chunk.type !== 'chunk') continue;
        report[file] = { name: chunk.name, moduleIds: Object.keys(chunk.modules).map((id) => relative(root, id).replaceAll('\\', '/')).sort(), rawBytes: Buffer.byteLength(chunk.code), gzBytes: gzipSync(chunk.code).byteLength, imports: [...chunk.imports] };
      }
      const policy = JSON.parse(readFileSync(resolve(root, 'lint/ratchet.json'), 'utf8')) as { budgets: Record<string, number> };
      const errors = [...gridSessionBudgetErrors(report, policy.budgets), ...titleClosureBudgetErrors(report, policy.budgets)];
      if (errors.length > 0) this.error(errors.join('\n'));
      this.emitFile({ type: 'asset', fileName: '.vite/chunk-modules.json', source: JSON.stringify(report, null, 2) });
    },
  };
}
