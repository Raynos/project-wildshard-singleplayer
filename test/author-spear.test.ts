// oxlint-disable-next-line import/no-nodejs-modules -- Load the actual native collision binary for the equipped-contact proof.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { Group, Mesh, Vector3 } from 'three';
import { starterSpearModel, starterSpearPack, spearLoadout } from '../scripts/docs/author-project/generators/spear';
import { createCatalogue } from '@wildshard/commons/catalogue';
import { spearExample } from '../scripts/docs/authoring/spear';
import { assetCost } from '../src/sdk/assets';
import { contentHash, validateProject } from '../src/sdk/project';
import { Scope } from '../src/engine/app/scope';
import { ContentCache } from '../src/engine/boot/contentCache';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { leaseClientLibrary } from '../src/game/shardfile/clientLibrary';
import { loadItemModels } from '../src/game/shardfile/itemModels';
import { admitProduct, type ProductCache, type CachedProduct } from '../src/game/shardfile/product';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { installDeclaredItems } from '../src/game/shardfile/items';
import { declaredKitItemFamilies } from '../src/game/plugin/weaponFamily';
import { InputService } from '../src/engine/input/InputService';
import { EquipmentService } from '../src/engine/combat/EquipmentService';

const provenance = { credit: 'Fixture', licence: 'First-party' };
let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { rapier = await loadRapier(new Uint8Array(readFileSync('public/assets/physics/rapier.wasm')).buffer); });

it('generates a stable spear catalogue with byte-derived asset and contact costs and an exact model/profile closure', () => {
  const built = createCatalogue([starterSpearPack(provenance)]);
  expect(createCatalogue([starterSpearPack(provenance)])).toEqual(built);
  expect(built.catalogue.entries.map(row => [row.id, row.kind, row.packVersion])).toEqual([
    ['starter-spear/contacts', 'binary', '1.0.0'], ['starter-spear/model', 'glb', '1.0.0'],
  ]);
  expect(spearLoadout(built).rows[0]?.view.asset).toBe(`commons:${contentHash(starterSpearModel())}`);
  for (const entry of built.catalogue.entries) {
    const bytes = built.assets.get(entry.hash); if (bytes === undefined) throw new Error('Missing catalogue bytes');
    expect(entry.hash).toBe(contentHash(bytes)); expect(entry.wire).toBe(bytes.length);
    expect(entry.cost).toEqual(assetCost(entry.kind, bytes));
  }
  const authored = spearExample();
  const assets = new Map([...authored.built.assets].map(([hash, bytes]) => [`commons:${hash}`, bytes]));
  expect(validateProject(authored.source, assets).items).toEqual(spearLoadout(authored.built));
  const altered = new Map(built.assets); const model = built.catalogue.entries.find(row => row.kind === 'glb');
  if (model === undefined) throw new Error('Missing model');
  altered.delete(model.hash); expect(() => spearLoadout({ ...built, assets: altered })).toThrow('identity');
  expect(() => spearLoadout(createCatalogue([]))).toThrow('closure');
});

it('SF26: downloads each spear asset once for two products and shares model residency until the last owner leaves', async () => {
  const downloads = new Map<string, number>(), stored = new Map<string, Response>(), visited = new Map<string, CachedProduct>();
  const address = (request: RequestInfo | URL) => typeof request === 'string' ? request : request instanceof URL ? request.href : request.url;
  const content = new ContentCache({ origin: 'https://platform.test/', hash: bytes => Promise.resolve(contentHash(bytes)), now: () => 1,
    storage: { open: () => Promise.resolve({ match: request => Promise.resolve(stored.get(address(request))?.clone()),
      put: (request, response) => { stored.set(address(request), response.clone()); return Promise.resolve(); },
      delete: request => Promise.resolve(stored.delete(address(request))), keys: () => Promise.resolve([...stored.keys()].map(url => new Request(url))) }) } });
  const cache: ProductCache = { product: base => Promise.resolve(visited.get(base) ?? null),
    putProduct: (base, product) => { visited.set(base, product); return Promise.resolve(); },
    asset: (_base, hash) => content.get(hash), putAsset: (_base, hash, bytes) => content.put(hash, bytes) };
  const allocator = new ResidencyAllocator(), scopes: Scope[] = [], models: Group[] = [];
  try {
    for (const slug of ['first-outpost', 'second-outpost']) {
      const authored = spearExample(slug);
      const product = await admitProduct(authored.source, { base: `https://platform.test/${slug}/`, offline: false, firstParty: false, cache,
        hash: bytes => Promise.resolve(contentHash(bytes)), fetch: request => {
          const hash = new URL(request).pathname.split('/').at(-1); if (hash === undefined) throw new Error('Missing asset URL');
          const bytes = authored.built.assets.get(hash); if (bytes === undefined) throw new Error('Unexpected asset download');
          downloads.set(hash, (downloads.get(hash) ?? 0) + 1); return Promise.resolve(new Response(Uint8Array.from(bytes)));
        } });
      const scope = new Scope(slug); scopes.push(scope);
      leaseClientLibrary(product.source, product.assets, { allocator, scope, owner: slug });
      const views = await loadItemModels(product.source.items, product.assets, scope);
      const model = views.get(authored.model.ref); if (model === undefined) throw new Error('Spear model did not load'); models.push(model);
    }
    expect(downloads.size).toBe(2); expect([...downloads.values()]).toEqual([1, 1]);
    expect(models[0]).toBe(models[1]);
    expect(allocator.entries()).toHaveLength(2); expect(allocator.entries().every(row => row.refs === 2)).toBe(true);
    const built = spearExample().built;
    const resident = built.catalogue.entries.reduce((sum, row) => sum + row.cost.decoded + row.cost.gpu, 0);
    expect(allocator.cost().input.commons).toBe(resident);
    expect(await content.stats()).toEqual({ bytes: [...built.assets.values()].reduce((sum, bytes) => sum + bytes.length, 0), entries: 2 });
    scopes[0]?.dispose(); expect(allocator.entries().every(row => row.refs === 1)).toBe(true);
    scopes[1]?.dispose(); expect(allocator.entries()).toEqual([]);
  } finally { for (const scope of scopes) scope.dispose(); }
});

it('equips the actual commons model through the normal family/input service and lands cooldown-governed native thrusts', async () => {
  const authored = spearExample(), first = SIM_LEVEL.entities[0]; if (first === undefined) throw new Error('Missing target');
  const sim = createSimHost({ ...SIM_LEVEL, entities: [{ ...first, strike: undefined }].map(({ strike: _strike, ...row }) => row), quests: [] }, { rapier });
  try {
    const target = sim.entities.get(first.id); if (target === undefined) throw new Error('Missing target body');
    target.place(0, 1.6, Math.PI);
    const assets = new Map([...authored.built.assets].map(([hash, bytes]) => [`commons:${hash}`, bytes]));
    const models = await loadItemModels(authored.source.items, assets, sim.scope);
    const input = new InputService(() => sim.state.tick * 1000 / 60);
    input.register({ id: 'weapon.melee', actions: ['attack', 'heavy', 'lock'], keys: { attack: ['Mouse0'], heavy: ['Mouse2'] } }, sim.scope);
    const aim = { origin: { x: 0, y: target.position.y + target.dims.bodyY, z: 0 }, direction: { x: 0, y: 0, z: 1 } };
    const items = installDeclaredItems(authored.source.items, { scope: sim.scope, actorId: sim.player.id, input, aim: () => aim,
      families: declaredKitItemFamilies(), models, icon: () => 'sword', runtime: () => ({ actor: sim.player.health, combat: sim.combat,
        targets: () => [{ ...sim.combat.targetPort(target.combatActor(), target), aimPoint: new Vector3(0, aim.origin.y, target.position.z) }],
        effect: () => { throw new Error('Spear declares no effect'); }, hook: null }) });
    const primary = items.primary; if (primary === null) throw new Error('Commons spear not equipped');
    const service = new EquipmentService(primary, { scope: sim.scope, events: sim.events, input }); items.install(service);
    expect(service.current.row.id).toBe('weapon.spear'); expect(primary.model instanceof Group).toBe(true);
    if (!(primary.model instanceof Group)) throw new Error('Spear model is not a scene group');
    expect(primary.model.children.filter(node => node instanceof Mesh)).toHaveLength(3);
    expect(primary.model).not.toBe(models.get(authored.model.ref));
    const step = (ticks = 1) => { for (let i = 0; i < ticks; i++) { sim.step(); items.step(sim.state.tick, 1 / 60); } };
    input.press('attack'); expect(target.hp).toBe(100); step(); expect(target.hp).toBe(70);
    input.press('attack'); step(); expect(target.hp).toBe(70);
    step(24); input.press('heavy'); step(); expect(target.hp).toBe(25);
    const saved = items.runtimes.get('weapon.spear')?.snapshot(); if (saved === undefined) throw new Error('Missing fixed-step item continuation');
    items.runtimes.get('weapon.spear')?.restore(saved); expect(items.runtimes.get('weapon.spear')?.snapshot()).toEqual(saved);
    expect(() => installDeclaredItems(authored.source.items, { scope: sim.scope, actorId: sim.player.id, input, aim: () => aim,
      families: declaredKitItemFamilies(), icon: () => 'sword', runtime: () => { throw new Error('Asset preflight must happen before runtime allocation'); } })).toThrow('Unresolved item model');
  } finally { sim.dispose(); }
});
