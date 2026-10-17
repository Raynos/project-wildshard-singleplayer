// @vitest-environment happy-dom
import { zlibSync } from 'fflate';
import { Scope } from '../src/engine/app/scope';
import { readGeometrySource } from '../src/engine/models/geometrySources';
import { registerPackedGeometrySource } from '../src/sdk/models/geometrySources';
import { GeometryPackWriter } from '../src/sdk/kit/geometryPack';
import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, MeshStandardMaterial, Object3D, PerspectiveCamera, Vector3 } from 'three';
import { CollectionDisplay, collectionModel, collectionTrophy, collectionCosmetic } from '../src/game/models/collectionDisplay';
import { installCollectionKeepsakes } from '../src/game/compendium/keepsakes';
import { TrophyWall } from '../src/game/models/collectionWall';
import { CompendiumState } from '../src/game/compendium/state';
import type { ShardCompendium } from '../src/game/compendium/types';
import { Owned } from '../src/game/loot/Owned';
import { ownedSave, compendiumSave } from '../src/game/saves';
import { Flags } from '../src/engine/world/interact/flags';
import { defineModel, modelContext } from '../src/engine/models/model';
import { parseRows } from '../src/format/rows';
import { emptyShardfile } from '../src/sdk/author';
import { Audio } from '../src/engine/audio/Audio';
import { InteractSfx } from '../src/engine/audio/interactSfx';
import { SkyRig } from '../src/engine/world/skyRig';
import { parseCollectionDisplays, CollectionMountPackSchema, CollectionChalkSchema } from '../src/format/collectionDisplay';
import { collectionRows } from '../src/shards/driftwood-isle/generators/collections';
import { DRIFTWOOD_LOOT } from '../src/shards/driftwood-isle/generators/loot';
import { declaredLootEconomy } from '../src/game/shard/declaredRows';
import { FakeGame, legacyDouble } from './fake/FakeGame';
import { mockCanvas } from './fake/weaponParity';
import * as v from 'valibot';

const material = new MeshStandardMaterial();
const geometry = (vertices = 15): BufferGeometry => new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3));

test('cosmetic part-array builders preserve independent native mesh copies and shadow flags', () => {
  const model = defineModel({ id: 'fixture/moon-cap', name: 'Moon cap', category: 'gear', pipeline: 'code', file: 'test/collections-display.test.ts', defaults: {},
    build: (ctx) => [{ geometry: ctx.once('cap', () => geometry(3)), material, castShadow: true, receiveShadow: true }],
  });
  const ctx = modelContext(SkyRig.prototype), a = collectionCosmetic(model, ctx), b = collectionCosmetic(model, ctx);
  expect(a.name).toBe('moon-cap'); expect(a.castShadow).toBe(true); expect(a.receiveShadow).toBe(true);
  expect(Reflect.get(a, 'geometry')).not.toBe(Reflect.get(b, 'geometry'));
});

test('a made-up shard drives count slots, paired trophies and loose drops from different rows', () => {
  const row = parseCollectionDisplays(collectionRows()).models['plaques'];
  if (row?.trophies === undefined) throw new Error('Missing fixture source');
  const madeUp = { ...row, id: 'fixture/moon-shelf', objectName: 'moon-shelf', geometry: 'moon', ranges: Array.from({ length: 5 }, (_, i) => ({ start: i * 3, count: 3 })),
    count: { from: 1, to: 3, parameter: 'stars' },
    trophies: { base: 0, empty: { shell: 3 }, full: { shell: 4 }, dropGeometry: 'shell', dropOffsets: { shell: [1, 2, 3] as [number, number, number] } },
  };
  const display = new CollectionDisplay(madeUp, geometry(), material, { stars: 0 });
  const attributes = display.geometry.attributes, index = display.geometry.index;
  expect(display.geometry.drawRange.count).toBe(6);
  display.setCount(1); display.setFilled('shell', true);
  expect(Array.from(display.geometry.index?.array ?? []).slice(0, display.geometry.drawRange.count)).toEqual([0, 1, 2, 3, 4, 5, 12, 13, 14]);
  display.setCount(100); expect(display.pieces).toBe(2);
  expect(display.geometry.index).toBe(index); expect(display.geometry.attributes).toBe(attributes);
  const drop = collectionTrophy(madeUp, { prepare: () => Promise.resolve(), geometry: () => geometry(), material: () => material }, modelContext(SkyRig.prototype), 'shell');
  expect(drop.children[0]?.position.toArray()).toEqual([1, 2, 3]);
  expect(drop.children[0]).toBeInstanceOf(CollectionDisplay);
  if (!(drop.children[0] instanceof CollectionDisplay)) throw new Error('Missing loose display');
  expect(drop.children[0].filled('shell')).toBe(true);
  expect(drop.children[0].geometry.drawRange.count).toBe(3);
});

test('collect, slot and continue use the existing flags and Owned save, including historical saves', () => {
  mockCanvas();
  vi.spyOn(InteractSfx.prototype, 'interact').mockImplementation(() => undefined);
  const rows = collectionRows(), economy = declaredLootEconomy(parseRows({
    ...emptyShardfile({ slug: 'fixture-collection', name: 'Fixture', author: 'Test', revision: 1, seed: 1 }).rows, loot: [DRIFTWOOD_LOOT],
  }).loot), game = new FakeGame().asGame();
  const models = Object.fromEntries(Object.entries(rows.models).map(([key, row]) => { const { id, name, file, surface, defaults, variants } = row; return [key, collectionModel({ id, name, file, surface, defaults, variants },
    () => row, { prepare: () => Promise.resolve(), geometry: () => geometry(row.ranges.reduce((n, range) => Math.max(n, range.start + range.count), 0)), material: () => material })]; }));
  const slug = 'fixture-collection';
  // The old store predates the shared collection presenter. No migration/replay should be required.
  ownedSave.write({ owned: ['bear-claw'], worn: [] }, slug);
  new Flags(slug).restore(['glass:1', 'glass:2', 'glass:3', 'glass:4', 'glass:5', 'dead:captain']);
  const flags = new Flags(slug), owned = new Owned(slug), toast = vi.fn<(_: string) => void>();
  const install = () => installCollectionKeepsakes({ rows: rows.keepsakes, models, loose: () => new Object3D(),
    flags, owned, progression: economy.progression, pickups: economy.pickups ?? {},
    place: row => ({ x: row.x, z: row.z, y: row.y ?? 0, yaw: row.yaw ?? 0 }), floorAt: () => 0, rewardAt: () => new Vector3(1, 0, 1),
    sky: legacyDouble<SkyRig>({ night: 0 }), game, player: { position: new Vector3(), yaw: 0 }, hud: { toast },
    audio: new Audio(), music: { sting: () => undefined }, swords: [], body: null,
  });
  const first = install();
  expect(first.chime?.pieces).toBe(5); expect(first.plaques?.filled('bear')).toBe(true);
  expect(owned.has('charm-1')).toBe(true); expect(toast).not.toHaveBeenCalled();
  const hat = first.drops.get('captain-hat'); expect(hat).toBeDefined(); hat?.onPickup?.();
  expect(owned.has('captain-hat')).toBe(true); expect(owned.worn('captain-hat')).toBe(true);
  toast.mockClear();
  for (let i = 6; i <= 10; i++) flags.set(`glass:${i}`);
  owned.grant('boar-tusk');
  expect(first.chime?.pieces).toBe(10); expect(first.plaques?.filled('boar')).toBe(true); expect(owned.has('charm-2')).toBe(true);
  const loaded = new Owned(slug), continued = install();
  expect(loaded.all).toEqual(owned.all); expect(continued.chime?.pieces).toBe(10); expect(continued.plaques?.filled('boar')).toBe(true);
  expect(toast).not.toHaveBeenCalled();
});

test('a second-shard wall restores old journal slots and its examine prompt without fetching untaken mounts', async () => {
  const def: ShardCompendium = { chunkId: 'fixture-gallery', skin: { className: 'journal', title: 'Moon log', tabs: [{ id: 'beasts', label: 'Beasts' }], stamp: () => 'Taken', stats: () => [] },
    entries: [{ id: 'moon-fox', kind: 'species', tab: 'beasts', name: 'Moon Fox', match: { kind: 'fox' }, plate: { sketch: 'fox.webp' }, notes: 'A moon fox.' }],
    trophies: [{ entry: 'moon-fox', outline: 'fox', title: 'Moon keeper' }],
  };
  const pack = v.parse(CollectionMountPackSchema, { notice: 'Fixture', url: 'mounts', sha256: 'fixture', rows: { bytes: 0, geometries: [] }, slots: { 'moon-fox': 0 } });
  const chalk = v.parse(CollectionChalkSchema, { size: [8, 8], outlines: { fox: [0, 0, 4, 4] }, labels: { '???': [4, 0, 4, 4], 'moon-fox': [0, 4, 4, 4] } });
  const loaded = vi.fn(() => Promise.resolve([geometry(3)])), anchor = new Group();
  const state = new CompendiumState(def), wall = new TrophyWall({ pack, loadMounts: loaded, chalk, loadChalk: () => new Promise(() => { /* chalk is deliberately pending */ }), anchor, state, rows: [1], rowY: [1], width: 2 });
  await Promise.resolve(); expect(loaded).not.toHaveBeenCalled();
  state.animalKilled('fox', undefined, 4); wall.refresh(); await Promise.resolve(); await Promise.resolve();
  expect(loaded).toHaveBeenCalledWith([0]); expect(wall.group.getObjectByName('trophy-mounts')).toBeDefined();
  const camera = new PerspectiveCamera(); camera.position.set(0, 1, 2); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true); anchor.updateMatrixWorld(true);
  wall.update(camera); expect(wall.interactable.label).toBe('Examine Moon Fox');
  const open = vi.fn<(_: string) => void>(); wall.onExamine = open; wall.interactable.onInteract(); expect(open).toHaveBeenCalledWith('moon-fox');
  const saved = compendiumSave.read(def.chunkId), restored = new CompendiumState(def);
  expect(saved['moon-fox']?.t).toBe(1); expect(restored.state('moon-fox')).toBe('taken'); expect(restored.stats('moon-fox').best).toBe(4);
});

test('packed collection geometry is borrowed by id, copied and retired with its owner', async () => {
  const writer = new GeometryPackWriter('fixture-moon-mount'); writer.add(geometry(3));
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(Uint8Array.from(zlibSync(writer.bytes()))));
  const scope = new Scope('fixture-gallery');
  try {
    registerPackedGeometrySource(scope, 'moon-mounts', { url: '/moon.pack', rows: writer.rows(), label: 'moon mounts' });
    const first = await readGeometrySource(scope, 'moon-mounts', [0, 0]);
    expect(first[0]?.getAttribute('position').array).toEqual(first[1]?.getAttribute('position').array);
    expect(first[0]?.getAttribute('position').array).not.toBe(first[1]?.getAttribute('position').array);
    expect(fetcher).toHaveBeenCalledWith('/moon.pack');
    scope.dispose();
    expect(() => readGeometrySource(scope, 'moon-mounts', [0])).toThrow('Missing geometry source');
  } finally { scope.dispose(); fetcher.mockRestore(); }
});
