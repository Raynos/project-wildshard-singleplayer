// E306 / E315 M5: Nalati Grasslands' roster (src/chunks/nalati-grasslands/roster.ts) — every creature the steppe spawns
// is in the Model Explorer, alive now or not. The kinds are read off the spawners' own calls, so a new `animals.spawn` of a
// kind the roster doesn't list fails here.
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { WorldRegistry } from '../src/world/registry';
import type { Sky } from '../src/world/Sky';
import { modelContext } from '../src/models/model';
import { listRoster } from '../src/models/live';
import { ROSTER } from '../src/chunks/nalati-grasslands/roster';
import { GOLDEN_KING } from '../src/entities/species/goldenKing';
import { KURGAN_BALBAL } from '../src/entities/species/kurganBalbal';
import { BALBAL } from '../src/entities/species/balbal';
import { GHOST_RIDER } from '../src/entities/species/ghostRider';
import { LEOPARD } from '../src/entities/species/leopard';
import { KOKBORI } from '../src/entities/species/kokbori';
import { EAGLE } from '../src/entities/species/eagle';
import { ARGYMAQ, GHOST_HORSE } from '../src/nalati/elites';

const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ } } as Sky;

/** the kind constants the spawners pass (a new one: add it here) */
const KINDS: Readonly<Record<string, string>> = { GOLDEN_KING, KURGAN_BALBAL, BALBAL, GHOST_RIDER, GHOST_HORSE, LEOPARD, KOKBORI, EAGLE, ARGYMAQ };

/** Nalati's spawners: src/nalati/, the wildlife, the taming */
const SPAWNERS = import.meta.glob<string>(['../src/nalati/*.ts', '../src/entities/Wildlife.ts', '../src/game/Taming.ts'], { query: '?raw', import: 'default', eager: true });

/** every kind a spawner names: `spawn('horse', …)`, `spawn(GOLDEN_KING, …)`, `spawnAt(LEOPARD, …)` */
function spawnedKinds(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [file, code] of Object.entries(SPAWNERS)) {
    for (const m of code.matchAll(/\bspawn(?:At)?\(\s*(?:'([a-z-]+)'|([A-Z][A-Z_]*)\s*,)/g)) {
      const name = m[2];
      const kind = m[1] ?? (name === undefined ? undefined : KINDS[name]);
      if (kind === undefined) throw new Error(`${file}: spawns ${name ?? '?'} — add the constant to KINDS`);
      if (!out.has(kind)) out.set(kind, file);
    }
  }
  return out;
}

describe('Nalati roster (E315 M5)', () => {
  it('every kind the steppe spawns has a model on its species', () => {
    const kinds = spawnedKinds();
    expect([...kinds.keys()].sort()).toEqual(['argymaq', 'balbal', 'eagle', 'ghost-rider', 'golden-king', 'horse', 'kokbori', 'leopard', 'sheepdog', 'wolf']);
    const listed = new Set(ROSTER.map((r) => r.species).filter((s) => s !== undefined));
    for (const [kind, file] of kinds) expect(listed.has(kind), `${kind} (spawned in ${file}) has no roster model`).toBe(true);
  });

  it('lists one catalog entry per model, its copies the live animals of its kind (else its planned count)', () => {
    const ids = ROSTER.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('nalati-grasslands/') || id.startsWith('shared/'), id).toBe(true);
    const reg = new WorldRegistry();
    const animals = [{ kind: 'wolf' }, { kind: 'wolf' }, { kind: 'horse' }, { kind: 'wolf' }];
    listRoster(ROSTER, modelContext(sky), () => animals, reg);
    const models = reg.models();
    expect(models.map((m) => m.id)).toEqual(ids);
    const byId = new Map(models.map((m) => [m.id, m]));
    expect(byId.get('nalati-grasslands/wolf')).toMatchObject({ species: 'wolf', drawnAs: 'skinned', copies: 3, live: false });
    expect(byId.get('nalati-grasslands/golden-king')).toMatchObject({ species: 'golden-king', copies: 1 }); // not come yet: planned
    expect(byId.get('nalati-grasslands/ghost-rider')?.copies).toBe(3);
    expect(byId.get('nalati-grasslands/sheep')).toMatchObject({ category: 'creatures', drawnAs: 'instanced', copies: 40 });
    expect(byId.get('nalati-grasslands/camp-people')).toMatchObject({ category: 'people', drawnAs: 'skinned', copies: 5 });
    expect(byId.get('nalati-grasslands/camp-people')?.variants?.map((v) => v.id)).toEqual(['elder', 'herderGate', 'herderRail', 'child', 'cook']);
  });
});
