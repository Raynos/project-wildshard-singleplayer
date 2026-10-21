import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

export const ROOTED_PITCHER_TABLES = ['src/game/boot/bytes.generated', 'src/game/boot/versions.generated',
  'src/game/systems/viewmodel/clips.generated', 'src/game/systems/effects/starter.generated'] as const;
/** tables resolve first. The explicit HTML/entry/boot are not normal or synthetic practice. */
export function rootedPitcherProofComposition(root: string, tables: ReadonlyMap<string, string>): Plugin {
  if (tables.size !== ROOTED_PITCHER_TABLES.length || ROOTED_PITCHER_TABLES.some(path => !tables.has(resolve(root, path))))
    throw new Error('Rooted Pitcher diagnostic requires exactly four isolated generated tables');
  return { name: 'isolated-rooted-pitcher-composition', enforce: 'pre',
    resolveId(source, importer) {
      if (importer === undefined || !source.startsWith('.')) return null;
      const path = resolve(dirname(importer), source).replace(/\.ts$/u, '');
      return tables.has(path) ? `\0rooted-pitcher-proof:${path}.ts` : null;
    },
    load(id) { return id.startsWith('\0rooted-pitcher-proof:') ? tables.get(id.slice('\0rooted-pitcher-proof:'.length).replace(/\.ts$/u, '')) ?? null : null; },
  };
}
/** A receipt must witness both exact actual-source entries, never either older practice boot. */
export function assertRootedPitcherProofComposition(files: Readonly<Record<string, string | undefined>>,
  expected: Readonly<Record<'src/rootedPitcherProof.ts' | 'src/rootedPitcherProofBoot.ts', string>>): void {
  for (const path of ['src/rootedPitcherProof.ts', 'src/rootedPitcherProofBoot.ts'] as const)
    if (files[path] !== expected[path]) throw new Error(`Missing exact rooted Pitcher entry: ${path}`);
  for (const path of ['src/practice.ts', 'src/practiceBoot.ts', 'src/nativeOwnerProofBoot.ts',
    'src/shards/driftwood-isle/generators/nativeOwnerProof.ts', 'src/shards/driftwood-isle/data/nativeOwnerProof.json',
    ...ROOTED_PITCHER_TABLES.map(table => `${table}.ts`)])
    if (files[path] !== undefined) throw new Error(`Unexpected rooted Pitcher build input: ${path}`);
}
