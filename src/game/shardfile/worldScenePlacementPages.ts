import { parseWorldScenePlacementPage, type WorldScenePlacementPage } from '@wildshard/format/worldScenePlacement';
import type { WorldSceneReads } from './worldSceneReads';

type Prepared = { readonly ok: true; readonly bytes: Uint8Array; readonly page: WorldScenePlacementPage }
  | { readonly ok: false; readonly error: unknown };
const decoder = new TextDecoder('utf-8', { fatal: true });

/** Decode complete verified pages during metadata read-ahead. Failures stay
 * retained until the original ordered admission cursor; no row is published. */
export class WorldScenePlacementPages {
  private readonly entries = new Map<string, Promise<Prepared>>();
  constructor(reads: Pick<WorldSceneReads, 'file'>, names: readonly string[]) {
    for (const name of names) {
      if (this.entries.has(name)) continue;
      this.entries.set(name, this.prepare(reads, name));
    }
  }
  private async prepare(reads: Pick<WorldSceneReads, 'file'>, name: string): Promise<Prepared> {
    try {
      const bytes = await reads.file(name);
      return { ok: true, bytes, page: parseWorldScenePlacementPage(JSON.parse(decoder.decode(bytes))) };
    } catch (error) { return { ok: false, error }; }
  }
  async read(name: string, bytes: Uint8Array): Promise<WorldScenePlacementPage> {
    const pending = this.entries.get(name);
    if (pending === undefined) throw new Error('Missing prepared placement page');
    const result = await pending;
    if (!result.ok) throw result.error;
    if (result.bytes !== bytes) throw new Error('Scene placement page owner changed');
    return result.page;
  }
  clear(): void { this.entries.clear(); }
}
