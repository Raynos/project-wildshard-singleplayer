import type { Rolldown } from 'vite';
import { resolve } from 'node:path';
import { startupModuleRoots } from './bootModules';

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

/** Batch only code already required by startSelected. Title code stays automatic;
 * session membership stays separate so neither guarded closure gains bytes.
 * The returned selector belongs to one build, never a process-global graph cache. */
export function controlChunkSelector(root: string, startup = startupModuleRoots(root)): (id: string, graph: ModuleGraph) => string | null {
  let common: Set<string> | undefined, title: Set<string> | undefined, session: Set<string> | undefined;
  return (id, graph) => {
    if (common === undefined) {
      common = staticClosure(graph, startup);
      title = staticClosure(graph, ['src/entry.ts', 'src/engine/ui/StartTitle.ts', 'src/game/mainMenu.ts',
        'src/game/grid/pageEntry.ts', 'src/game/travel/travel.ts'].map(file => resolve(root, file)));
      session = staticClosure(graph, [resolve(root, 'src/game/session/session.ts')]);
    }
    if (!common.has(id) || title?.has(id) === true || !/\.[cm]?[jt]sx?$/u.test(id)
      || id.includes('/src/shards/') || id.includes('/out/')) return null;
    return session?.has(id) === true ? 'control-session' : 'control-startup';
  };
}

/** Explicit dependency capture plus execution-order wrappers avoid the circular
 * binding failures of the former broad vendor/engine groups. Optional code and
 * shard owners keep Rolldown's automatic lazy boundaries. */
export function controlChunkGroups(root: string): Rolldown.CodeSplittingGroup[] {
  return [{ name: controlChunkSelector(root), includeDependenciesRecursively: false, maxSize: 192_000 }];
}
