import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

export const ACTUAL_CONCH_TABLES = ['src/game/boot/bytes.generated', 'src/game/boot/versions.generated',
  'src/game/systems/viewmodel/clips.generated', 'src/game/systems/effects/starter.generated'] as const;
/** Private tables resolve first. The explicit HTML/entry/boot are not normal or synthetic practice. */
export function actualConchProofComposition(root: string, tables: ReadonlyMap<string, string>): Plugin {
  if (tables.size !== ACTUAL_CONCH_TABLES.length || ACTUAL_CONCH_TABLES.some(path => !tables.has(resolve(root, path))))
    throw new Error('Actual Conch diagnostic requires exactly four private generated tables');
  return { name: 'private-actual-conch-composition', enforce: 'pre',
    resolveId(source, importer) {
      if (importer === undefined || !source.startsWith('.')) return null;
      const path = resolve(dirname(importer), source).replace(/\.ts$/u, '');
      return tables.has(path) ? `\0actual-conch-proof:${path}.ts` : null;
    },
    load(id) { return id.startsWith('\0actual-conch-proof:') ? tables.get(id.slice('\0actual-conch-proof:'.length).replace(/\.ts$/u, '')) ?? null : null; },
  };
}
/** A receipt must witness both exact actual-source entries, never either older practice boot. */
export function assertActualConchProofComposition(files: Readonly<Record<string, string | undefined>>,
  expected: Readonly<Record<'src/actualConchProof.ts' | 'src/actualConchProofBoot.ts', string>>): void {
  for (const path of ['src/actualConchProof.ts', 'src/actualConchProofBoot.ts'] as const)
    if (files[path] !== expected[path]) throw new Error(`Missing exact actual Conch entry: ${path}`);
  for (const path of ['src/practice.ts', 'src/practiceBoot.ts', 'src/nativeOwnerProofBoot.ts',
    'src/shards/driftwood-isle/generators/nativeOwnerProof.ts', 'src/shards/driftwood-isle/data/nativeOwnerProof.json',
    ...ACTUAL_CONCH_TABLES.map(table => `${table}.ts`)])
    if (files[path] !== undefined) throw new Error(`Unexpected actual Conch build input: ${path}`);
}
