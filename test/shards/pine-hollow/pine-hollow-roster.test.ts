// E306 / E315 M5: Pine Hollow's roster (src/shards/pine-hollow/roster.ts) — every species its fauna spawns and the Antler
// King are roster creatures; the birds, the hare and the three people are listed with their copies; every entry is a
// defined model of the shard (or a shared one) in the right tab, and the King's spelled-out fields are what
// `creature('antler-king')` gives once his fight has registered his species.
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import type { SkyRig as Sky } from '../../../src/engine/world/skyRig';
import { WorldRegistry } from '../../../src/engine/world/registry';
import { definedModels, modelContext } from '../../../src/engine/models/model';
import { listRoster } from '../../../src/engine/models/live';
import { creature } from '../../../src/engine/models/creature';
import { hasSpecies, registerSpecies, speciesDef } from '../../../src/engine/entities/species/registry'; // (the factory registers every species file)
import { PINE_HOLLOW } from '../../../src/shards/pine-hollow/manifest';
import { ROSTER } from '../../../src/shards/pine-hollow/roster';
import { GEAR } from '../../../src/shards/pine-hollow/models/gear';
import { antlerKing, KING_VARIANT } from '../../../src/shards/pine-hollow/models/antlerKing';

const sky = { setupMaterial(_m: THREE.Material): void { /* nothing to prepare */ } } as Sky;

describe("Pine Hollow's roster (E315 M5)", () => {
  it('every fauna species and the Antler King are roster creatures; ids unique; every entry a defined model', () => {
    const gear = new Set([...GEAR.map((g) => g.id), 'shared/swim-hands']); // (the gloved hands in the pond: shared gear, E348)
    const ids = ROSTER.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const species = new Set(ROSTER.map((r) => r.species).filter((s) => s !== undefined));
    for (const plan of PINE_HOLLOW.spawns) expect(species.has(plan.kind), `fauna '${plan.kind}'`).toBe(true);
    expect(species.has('antler-king')).toBe(true);
    const defined = new Map(definedModels().map((m) => [m.id, m]));
    for (const id of ids) {
      const m = defined.get(id);
      expect(m, id).toBeDefined();
      expect(id.startsWith('shared/') ? /^src\/(engine|game)\/models\//u.test(m?.file ?? '') : m?.file.startsWith('src/shards/pine-hollow/models/'), `${id} file`).toBe(true);
      expect(m?.category, id).toBe(['pine-hollow/ranger-hale', 'pine-hollow/miller-brandt', 'pine-hollow/trader-mott'].includes(id) ? 'people' : gear.has(id) ? 'gear' : 'creatures');
    }
    expect(ids).toEqual([
      'shared/deer', 'shared/boar', 'shared/bear', 'pine-hollow/elk', 'pine-hollow/antler-king',
      'pine-hollow/raven', 'pine-hollow/great-grey-owl', 'pine-hollow/pileated-woodpecker', 'pine-hollow/snowshoe-hare',
      'pine-hollow/ranger-hale', 'pine-hollow/miller-brandt', 'pine-hollow/trader-mott',
      'pine-hollow/crossbow', 'pine-hollow/crossbow-bolt', 'pine-hollow/lever-action', 'pine-hollow/wardens-longbow', 'pine-hollow/longbow-arrow',
      'pine-hollow/skinning-knife', 'shared/swim-hands',
    ]);
  });

  it('lists each once: creatures count the live animals of their kind (the King his planned one), the rest their own copies', () => {
    const reg = new WorldRegistry();
    const animals = [{ kind: 'elk' }, { kind: 'deer' }, { kind: 'elk' }, { kind: 'wolf' }];
    listRoster(ROSTER, modelContext(sky), () => animals, reg);
    const byId = new Map(reg.models().map((m) => [m.id, m]));
    expect(byId.size).toBe(ROSTER.length);
    expect(byId.get('pine-hollow/elk')).toMatchObject({ species: 'elk', drawnAs: 'skinned', pipeline: ['hunyuan', 'code'], copies: 2 });
    expect(byId.get('shared/deer')).toMatchObject({ species: 'deer', pipeline: ['trellis', 'hunyuan', 'code'], copies: 1 });
    expect(byId.get('shared/bear')).toMatchObject({ species: 'bear', pipeline: ['hunyuan', 'code'], copies: 1 }); // none alive: one planned
    expect(byId.get('pine-hollow/antler-king')).toMatchObject({ species: 'antler-king', drawnAs: 'skinned', pipeline: ['hunyuan', 'code'], copies: 1 });
    expect(byId.get('pine-hollow/raven')).toMatchObject({ drawnAs: 'instanced', pipeline: 'hunyuan', copies: 7 });
    expect(byId.get('pine-hollow/snowshoe-hare')).toMatchObject({ drawnAs: 'instanced', pipeline: 'code', copies: 5 });
    expect(byId.get('pine-hollow/ranger-hale')).toMatchObject({ name: 'Hale, ranger of the Hollow', drawnAs: 'skinned', pipeline: ['hunyuan', 'code'], copies: 1 });
  });

  it("the Antler King's fields are creature('antler-king')'s once his species is registered (the fight's registerKing)", () => {
    if (!hasSpecies('antler-king')) registerSpecies({ ...speciesDef('elk'), kind: 'antler-king', label: 'The Antler King', variants: [KING_VARIANT] });
    const fields = creature('antler-king');
    expect(antlerKing.name).toBe(fields.name);
    expect(antlerKing.defaults).toEqual(fields.defaults);
    expect(antlerKing.variants).toEqual(fields.variants);
    expect({ clips: antlerKing.rig?.clips, species: antlerKing.rig?.species }).toEqual(fields.rig); // (+ his dressing, rig.dress)
    expect(antlerKing.rig?.dress).toBeTypeOf('function');
    expect(antlerKing.category).toBe(fields.category);
  });
});
