import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Private artifact-only substitutions must run before Vite's ordinary filesystem resolver. */
export function nativeOwnerProofComposition(root: string, tables: ReadonlyMap<string, string>): Plugin {
  return { name: 'private-native-owner-composition', enforce: 'pre',
    resolveId(source, importer) {
      if (importer === undefined || !source.startsWith('.')) return null;
      const path = resolve(dirname(importer), source).replace(/\.ts$/u, '');
      if (path === resolve(root, 'src/practiceBoot') && importer === resolve(root, 'src/practice.ts')) return resolve(root, 'src/nativeOwnerProofBoot.ts');
      return tables.has(path) ? `\0native-owner-proof:${path}.ts` : null;
    },
    load(id) { return id.startsWith('\0native-owner-proof:') ? tables.get(id.slice('\0native-owner-proof:'.length).replace(/\.ts$/u, '')) ?? null : null; },
  };
}

/** No successful receipt may describe the normal boot or un-replaced global generated tables. */
export function assertNativeOwnerProofComposition(files: Readonly<Record<string, string | undefined>>, expectedBoot: string): void {
  if (files['src/nativeOwnerProofBoot.ts'] !== expectedBoot || files['src/practiceBoot.ts'] !== undefined)
    throw new Error('Private proof requires exact native boot and excludes normal practice boot');
  for (const path of ['src/game/boot/bytes.generated.ts', 'src/game/boot/versions.generated.ts',
    'src/game/systems/viewmodel/clips.generated.ts', 'src/game/systems/effects/starter.generated.ts'])
    if (files[path] !== undefined) throw new Error(`Private proof loaded an un-replaced generated table: ${path}`);
}
