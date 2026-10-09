// E306 / E315 M5: every shard's roster (ShardManifest.roster) — the live models its Model Explorer lists at boot. Each species
// its fauna spawns is some roster model's species (the Explorer's species list, not the live animals), the ids are unique
// and every entry is a defined model in a known tab; shared/… models are the ones several shards list.
import { describe, expect, it } from 'vitest';
import { SHARDS } from '../src/shards.generated';
import type { ShardManifest } from '../src/game/shard/manifest';
import type { RosterEntry } from '../src/engine/models/live';
import { definedModels } from '../src/engine/models/model';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test verifies roster sources are committed in the checkout.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Node test verifies source existence in clean git archives too.
import { existsSync } from 'node:fs';

const TABS = new Set(['buildings', 'nature', 'creatures', 'people', 'gear', 'props']);
const ROOT = new URL('../', import.meta.url);
// A clean git archive has no .git; existence there already proves the source was committed.
const TRACKED = existsSync(new URL('.git', ROOT)) ? new Set(execFileSync('git', ['ls-files', '-z', '--', 'src/'], { cwd: ROOT, encoding: 'utf8' }).split('\0')) : null;

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
        // Include hidden and experimental rosters. Definitions live in models/, but their build source may be weapons/ or world/.
        // a shared model is the engine's (the swim hands) or the game's (the creatures, E405 / SF54); a level's own lives in its folder
        expect(id.startsWith('shared/') ? /^src\/(engine|game)\/models\//u.test(m?.file ?? '') : m?.file.startsWith(`src/shards/${def.slug}/`), `${id} file ownership`).toBe(true);
        if (m === undefined) throw new Error(`${id}: no defined model`);
        expect(m.file.split('/'), `${id} source stays within its owner`).not.toContain('..');
        expect((TRACKED?.has(m.file) ?? true) && existsSync(new URL(m.file, ROOT)), `${id}: tracked source ${m.file}`).toBe(true);
      }
    }, 60_000); // (a roster's first import compiles the shard's creatures, people and weapons: slow on a loaded box)
  }
});
