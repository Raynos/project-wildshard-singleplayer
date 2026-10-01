// E306 / E315 M5: every shard's roster (ShardManifest.roster) — the live models its Model Explorer lists at boot. Each species
// its fauna spawns is some roster model's species (the Explorer's species list, not the live animals), the ids are unique
// and every entry is a defined model in a known tab; shared/… models are the ones several shards list.
import { describe, expect, it } from 'vitest';
import { SHARDS } from '#game/shard/shards.generated';
import type { ShardManifest } from '#game/shard/manifest';
import type { RosterEntry } from '#engine/models/live';
import { definedModels } from '#engine/models/model';

const TABS = new Set(['buildings', 'nature', 'creatures', 'people', 'gear', 'props']);

const defined = (id: string): ReturnType<typeof definedModels>[number] | undefined => definedModels().find((m) => m.id === id);

async function rosterOf(def: ShardManifest): Promise<readonly RosterEntry[]> {
  const r = await def.roster?.();
  if (r === undefined) throw new Error(`${def.slug} has no roster`);
  return r;
}

describe('shard rosters (E315 M5)', () => {
  for (const def of SHARDS.filter((m) => m.roster !== undefined)) {
    it(`${def.slug}: every fauna species is on the roster; ids unique; every entry a defined model`, async () => {
      const roster = await rosterOf(def);
      const ids = roster.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      const species = new Set(roster.map((r) => r.species).filter((s) => s !== undefined));
      for (const plan of def.spawns) expect(species.has(plan.kind), `${def.slug} fauna '${plan.kind}'`).toBe(true);
      // every shard lists the gear its player holds
      expect(roster.some((r) => defined(r.id)?.category === 'gear'), `${def.slug} gear`).toBe(true);
      for (const id of ids) {
        const m = defined(id);
        expect(m, id).toBeDefined();
        expect(TABS.has(m?.category ?? ''), `${id} tab`).toBe(true);
        expect(m?.file.startsWith(id.startsWith('shared/') ? 'src/engine/models/' : `src/shards/${def.slug}/models/`), `${id} file`).toBe(true);
      }
    }, 60_000); // (a roster's first import compiles the shard's creatures, people and weapons: slow on a loaded box)
  }
});
