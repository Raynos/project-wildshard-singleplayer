// E306 / E315 M5: every shard's roster (ChunkDef.roster) — the live models its Model Explorer lists at boot. Each species
// its fauna spawns is some roster model's species (the Explorer's species list, not the live animals), the ids are unique
// and every entry is a defined model in a known tab; shared/… models are the ones several shards list.
import { describe, expect, it } from 'vitest';
import { DRIFTWOOD_ISLE } from '../src/chunks/driftwood-isle';
import { PINE_HOLLOW } from '../src/chunks/pine-hollow';
import { NALATI_GRASSLANDS } from '../src/chunks/nalati-grasslands';
import type { ChunkDef } from '../src/chunks/ChunkDef';
import type { RosterEntry } from '../src/models/live';
import { definedModels } from '../src/models/model';

const SHARDS: readonly ChunkDef[] = [DRIFTWOOD_ISLE, PINE_HOLLOW, NALATI_GRASSLANDS];
const TABS = new Set(['buildings', 'nature', 'creatures', 'people', 'gear', 'props']);

async function rosterOf(def: ChunkDef): Promise<readonly RosterEntry[]> {
  const r = await def.roster?.();
  if (r === undefined) throw new Error(`${def.slug} has no roster`);
  return r;
}

describe('shard rosters (E315 M5)', () => {
  for (const def of SHARDS) {
    it(`${def.slug}: every fauna species is on the roster; ids unique; every entry a defined model`, async () => {
      const roster = await rosterOf(def);
      const ids = roster.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      const species = new Set(roster.map((r) => r.species).filter((s) => s !== undefined));
      for (const plan of def.fauna) expect(species.has(plan.kind), `${def.slug} fauna '${plan.kind}'`).toBe(true);
      const defined = new Map(definedModels().map((m) => [m.id, m]));
      for (const id of ids) {
        const m = defined.get(id);
        expect(m, id).toBeDefined();
        expect(TABS.has(m?.category ?? ''), `${id} tab`).toBe(true);
        expect(m?.file.startsWith(id.startsWith('shared/') ? 'src/models/' : `src/chunks/${def.slug}/models/`), `${id} file`).toBe(true);
      }
    });
  }
});
