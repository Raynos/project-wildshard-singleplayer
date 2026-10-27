import type { Rolldown } from 'vite';
import { resolve } from 'node:path';
import { startupModuleRoots, homeModuleRoots, gridModuleRoots } from './bootModules';

interface ModuleGraph {
  readonly getModuleInfo: (id: string) => { readonly importedIds: readonly string[] } | null;
}

/** Only static dependencies: an optional import never becomes an entry requirement. */
function staticClosure(graph: ModuleGraph, roots: readonly string[]): Set<string> {
  const found = new Set<string>(), pending = [...roots];
  while (pending.length > 0) {
    const id = pending.pop();
    if (id === undefined || found.has(id)) continue;
    found.add(id);
    pending.push(...graph.getModuleInfo(id)?.importedIds ?? []);
  }
  return found;
}

function membership(graph: ModuleGraph, rows: readonly (readonly string[])[]): Map<string, bigint> {
  const masks = new Map<string, bigint>();
  for (let index = 0; index < rows.length; index++) {
    const bit = 1n << BigInt(index);
    for (const id of staticClosure(graph, rows[index] ?? [])) masks.set(id, (masks.get(id) ?? 0n) | bit);
  }
  return masks;
}

/** Merge only equal requirements across actual title roots and home entries.
 * A home never fetches another home's optional feature. The session budget and
 * initial HTML boundaries remain separate. All graph state belongs to one build. */
export function controlChunkSelector(root: string, startup = startupModuleRoots(root), boundary: 'control' | 'title' | 'initial' = 'control', homes: readonly (readonly string[])[] = []): (id: string, graph: ModuleGraph) => string | null {
  let controls: Map<string, bigint> | undefined, title: Map<string, bigint> | undefined, initial: Map<string, bigint> | undefined, session: Set<string> | undefined;
  return (id, graph) => {
    if (controls === undefined) {
      controls = membership(graph, homes.length === 0 ? [startup] : homes);
      const titleRoots = ['src/entry.ts', 'src/engine/ui/StartTitle.ts', 'src/game/mainMenu.ts',
        'src/game/grid/pageEntry.ts', 'src/game/travel/travel.ts'].map(file => resolve(root, file));
      for (const file of titleRoots) if (graph.getModuleInfo(file) === null) throw new Error(`Missing title chunk boundary: ${file}`);
      title = membership(graph, titleRoots.map(file => [file]));
      initial = membership(graph, [[resolve(root, 'index.html')], [resolve(root, 'calibration/index.html')]]);
      session = staticClosure(graph, [resolve(root, 'src/game/session/session.ts')]);
    }
    if (id.includes('/src/shards/')) return null;
    const needed = controls.get(id) ?? 0n, titleMask = title?.get(id) ?? 0n;
    if (needed === 0n && titleMask === 0n) return null;
    const roles = `${(initial?.get(id) ?? 0n).toString(36)}-${titleMask.toString(36)}-${needed.toString(36)}-${session?.has(id) === true ? 'session' : 'startup'}`;
    if (boundary === 'initial') return `entry-${roles}`;
    if (boundary === 'title') return titleMask > 0n ? `title-${roles}` : null;
    if (titleMask > 0n || !/\.(?:[cm]?[jt]sx?|json)$/u.test(id) || id.includes('/out/')) return null;
    return `control-${roles}`;
  };
}

/** Explicit equal-requirement cohorts plus execution-order wrappers avoid broad
 * vendor/engine groups. Unselected optional code and shard owners retain their
 * automatic lazy boundaries; initial-only helpers remain entry-aware. */
export function controlChunkGroups(root: string): Rolldown.CodeSplittingGroup[] {
  const startup = startupModuleRoots(root), grid = gridModuleRoots(root);
  const base = [...startup, ...['src/main.ts', 'src/game/shardfile/client.ts', 'src/game/session/session.ts'].map(file => resolve(root, file))];
  const homes = homeModuleRoots(root).flatMap(optional => [[...base, ...optional], [...base, ...optional, ...grid]]);
  return [
    // HTML proxies and compiler helpers are entry dependencies too. Their actual
    // entry sets keep calibration's initial Three graph off the public shell.
    { name: controlChunkSelector(root, startup, 'initial', homes), tags: ['$initial'], includeDependenciesRecursively: false, maxSize: 384_000 },
    { name: 'entry-optional', tags: ['$initial'], test: id => !id.includes('/src/shards/'), entriesAware: true, includeDependenciesRecursively: false, maxSize: 192_000 },
    { name: controlChunkSelector(root, startup, 'title', homes), includeDependenciesRecursively: false, maxSize: 192_000 },
    { name: controlChunkSelector(root, startup, 'control', homes), includeDependenciesRecursively: false, maxSize: 384_000 },
  ];
}

/** Entry-aware subgroup labels contain '~'; named module banks accept only
 * URL-safe tokens. Keep the content hash, not a permissive bank parser. */
export function controlChunkFileName(chunk: Pick<Rolldown.PreRenderedChunk, 'name'>): string {
  return `assets/${chunk.name.replaceAll(/[^a-zA-Z0-9_.-]/gu, '-')}-[hash].js`;
}
