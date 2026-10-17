// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the installed native families on shipped Rapier bytes.
import { readFileSync } from 'node:fs';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { HOST_PROBE } from '../src/game/plugin/simulation';
import { createNativeCombatFrame, installNativeItems } from '../src/game/plugin/nativeItems';
import { parseItems } from '../src/format/items';
import itemRows from '../src/shards/pine-hollow/data/items.generated.json' with { type: 'json' };
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { AmmoPouch } from '../src/game/loadout/pouch';
import { NativeHeldAmmunition } from '../src/game/loadout/nativeAmmunition';
import { loadoutLegacySlot } from '../src/game/loadout/persistence';
import { restoreHeldOwnership } from '../src/game/loadout/held';
import { SaveStore } from '../src/engine/saves/store';
import { LoadoutSchema } from '../src/format/loadout';
import pineRows from '../src/shards/pine-hollow/data/loadout.json' with { type: 'json' };

test('harbour rows cycle unrelated ammunition and retain the selected live stack', () => {
  const pouch = new AmmoPouch({ kinds: ['harpoon', 'flare', 'net'], fallback: 'harpoon', capacity: 12 }, { flare: 4 });
  expect(pouch.cycle(9)).toBe(4); expect(pouch.selected).toBe('flare');
  expect(pouch.count('harpoon', 4)).toBe(9);
  expect(pouch.select('net', 2)).toBeNull();
  expect(pouch.cycle(2)).toBe(9); expect(pouch.selected).toBe('harpoon');
  pouch.add('net', 100); expect(pouch.count('net', 9)).toBe(12);
  expect(pouch.cycle(7)).toBe(2); expect(pouch.cycle(0)).toBe(12);
  expect(pouch.cycle(6)).toBe(7); expect(pouch.next()).toBe('net');
  expect(() => new AmmoPouch({ kinds: ['net'], fallback: 'harpoon', capacity: 12 })).toThrow();
});

test('existing v1 Pine loadout saves continue with the exact ABI and owned flags', () => {
  const rows = v.parse(LoadoutSchema, pineRows), documents = new Map<string, string>();
  const local = { get length() { return documents.size; }, key: (index: number) => [...documents.keys()][index] ?? null,
    getItem: (key: string) => documents.get(key) ?? null, setItem: (key: string, value: string) => { documents.set(key, value); },
    removeItem: (key: string) => { documents.delete(key); } };
  const store = new SaveStore({ local, session: null });
  const legacy = { pitch: 11, broadhead: 3, rounds: 42, arrows: 7 };
  // Produce the previous definition, then open the same document through a fresh store.
  const old = store.define({ key: 'loadout', scope: 'shard', version: 1,
    schema: v.object({ pitch: v.optional(v.number()), broadhead: v.optional(v.number()), rounds: v.optional(v.number()), arrows: v.optional(v.number()) }), initial: () => ({}) });
  old.write(legacy, 'pine-hollow');
  const resumed = new SaveStore({ local, session: null });
  const slot = loadoutLegacySlot(rows, resumed);
  expect(slot.read('pine-hollow')).toEqual(legacy);
  expect(loadoutLegacySlot(rows, resumed)).toBe(slot);
  slot.write({ ...legacy, pitch: 8, rounds: 39 }, 'pine-hollow');
  expect(slot.read('pine-hollow')).toEqual({ ...legacy, pitch: 8, rounds: 39 });
  expect(restoreHeldOwnership(['warden-longbow'], ['lever-rifle'], rows))
    .toEqual({ bow: true, rifle: true, grants: ['warden-longbow'] });
});

test('another shard declares independent save fields and ownership identities', () => {
  const rows = v.parse(LoadoutSchema, { ...pineRows,
    pouch: { kinds: ['harpoon', 'flare'], fallback: 'harpoon', capacity: 12 },
    persistence: { ...pineRows.persistence, key: 'harbour-kit', firearm: 'canisters', bow: 'lines' },
    bow: { ...pineRows.bow, owned: 'sea-bow', legacyItem: 'old-sea-bow' },
    firearm: { ...pineRows.firearm, owned: 'deck-gun' },
  });
  const slot = loadoutLegacySlot(rows, new SaveStore({ local: null, session: null }));
  slot.write({ flare: 5, canisters: 9, lines: 2 }, 'fixture-harbour');
  expect(slot.read('fixture-harbour')).toEqual({ flare: 5, canisters: 9, lines: 2 });
  expect(restoreHeldOwnership(['old-sea-bow'], ['deck-gun'], rows))
    .toEqual({ bow: true, rifle: true, grants: ['sea-bow'] });
});

test('harbour native ammunition keeps swaps, caps, fallback and atomic continuation', async () => {
  const rows = { ...pineRows, pouch: { kinds: ['harpoon', 'flare'], fallback: 'harpoon', capacity: 12 },
    firearm: { ...pineRows.firearm, ammo: 'canister' }, bow: { ...pineRows.bow, ammo: 'line' } };
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const host = createSimHost({ version: 1, id: 'harbour-ammunition', seed: 7, ground: { size: 20, height: 0 },
    player: { at: { x: 0, y: 1, z: 0 }, yaw: 0, speed: 5 }, weapon: HOST_PROBE, entities: [], quests: [] }, { rapier });
  const frame = createNativeCombatFrame(), items = parseItems(itemRows);
  let crossbowState: { quiver: number; loaded: boolean; reloading: boolean } | undefined;
  for (const item of items.rows) {
    if (item.kind !== 'weapon' || item.ranged === undefined) continue;
    item.ranged.defaultAmmo = 'harpoon';
    item.ranged.ammunition = item.ranged.ammunition.slice(0, 2).map((ammo, index) => Object.assign(ammo, { id: index === 0 ? 'harpoon' : 'flare' }));
    if (item.profile?.family === 'bow') {
      item.profile.quiver = 6;
      const bow = installNativeItems(host, frame, { kind: 'bow', policy: item.ranged, profile: item.profile }); bow.state.arrows = 2;
    } else if (item.profile?.family === 'firearm' && item.profile.action === 'lever') {
      item.profile.magazine = 1; item.profile.reserve = 3;
      installNativeItems(host, frame, { kind: 'cycle', policy: item.ranged, profile: item.profile });
    } else {
      const bolt = installNativeItems(host, frame, { kind: 'bolt', policy: item.ranged, profile: item.profile }); crossbowState = bolt.state;
      bolt.state.quiver = 12;
    }
  }
  if (crossbowState === undefined) throw new Error('Missing native harbour launcher');
  const crossbow = { state: crossbowState };
  const ammunition = new NativeHeldAmmunition(host, rows, items);
  try {
  ammunition.add('flare', 5); ammunition.loadKind('flare'); expect(crossbow.state.quiver).toBe(5);
  expect(crossbow.state.loaded).toBe(true); expect(ammunition.changed).toBe(true);
  const saved = ammunition.snapshot();
  const resumed = new NativeHeldAmmunition(host, rows, items), commit = resumed.prepareRestore(saved);
  expect(resumed.selected).toBe('harpoon'); commit(); expect(resumed.snapshot()).toEqual(saved);
  expect(() => resumed.prepareRestore({ ...saved, flare: 4 })).toThrow(); expect(resumed.snapshot()).toEqual(saved);
  expect(() => resumed.prepareRestore({ ...saved, harpoon: 13 })).toThrow(); expect(resumed.snapshot()).toEqual(saved);
  resumed.add('canister', 2); expect(resumed.count('canister')).toBe(6);
  resumed.add('line', 10); expect(resumed.count('line')).toBe(6); expect(resumed.room('line', 1)).toBe(false);
  crossbow.state.quiver = 0; crossbow.state.loaded = false; resumed.update();
  expect(resumed.selected).toBe('harpoon'); expect(crossbow.state.quiver).toBe(12);
  expect(crossbow.state.loaded).toBe(false);
  } finally { host.dispose(); }
});
