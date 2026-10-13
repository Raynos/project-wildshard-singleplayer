// oxlint-disable-next-line import/no-nodejs-modules -- The template's own admitted terrain files are read from its folder.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Mesh, MeshStandardMaterial, PlaneGeometry, Vector3, type Material, type Object3D } from 'three';
import { emptyShardfile } from '../src/sdk/author';
import { bakeTerrain } from '../src/sdk/bake/terrain';
import { contentHash } from '../src/sdk/project';
import { parseShardfile, type Shardfile } from '@wildshard/format/shardSchema';
import { materialCurveRules } from '@wildshard/format/materials';
import { validateShardfileAssets } from '@wildshard/format/assetAdmission';
import { App } from '../src/engine/app/app';
import { createLevelInstallation } from '../src/engine/level/installation';
import { Game } from '../src/engine/core/Game';
import { shardContext, type ShardContext } from '../src/game/plugin/context';
import { ShardPlugin, sourceManifest } from '../src/game/plugin/shardPlugin';
import type { ShardRuntime } from '../src/game/shard/runtime';
import type { ShardWorld } from '../src/game/shard/world';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { ShardfileClient } from '../src/game/shardfile/client';
import { clientGround } from '../src/game/shardfile/clientGround';
import { HybridShardPlugin } from '../src/game/shardfile/hybrid';
import { runtimePresentation } from '../src/game/shardfile/runtimeProduct';
import template from '../src/shards/_template/shard.config';
import { fakeWorld } from './fake/world';

const entry = 'runtime/index.ts';
const noop = (): undefined => undefined;
const dusk = { id: 1, name: 'dusk', type: 'f64' as const, privacy: 'host' as const, default: 0.25, min: 0, max: 1 };
const curve = (state: string) => ({ pbr: [{ param: 'roughness', state, curve: { mix: [0.2, 0.9] as [number, number] } }] });

/** A fixture hybrid: a baked terrain, one PBR look material whose roughness follows a runtime-bound host field, nothing else. */
function fixture(): { source: Shardfile; bytes: ReadonlyMap<string, Uint8Array> } {
  const baked = bakeTerrain({ heightAt: (x, z) => Math.max(0, 6 - Math.hypot(x - 40, z + 30) / 10), colourAt: () => [0.6, 0.5, 0.4], family: 'pbr' });
  const data = emptyShardfile({ slug: 'presentation-fixture', name: 'Presentation fixture', author: 'Fixture', seed: 1, revision: 1 });
  Object.assign(data, { terrain: baked.terrain, tiles: baked.tiles, files: baked.files, critical: baked.critical, edge: baked.edge,
    runtime: { entry, binds: ['state'] }, state: { ...data.state, shared: [dusk] } });
  Object.assign(data, { look: { ...data.look, families: ['pbr'], materials: { pbr: { family: 'pbr', vertexColours: true, metalness: 0, roughness: 0.5 } }, curves: curve('shared.dusk') } });
  data.budgets.sim = { resident: 16_000_000, compressed: 2_000_000 };
  return { source: validateShardfileAssets(data, baked.assets, contentHash), bytes: baked.assets };
}

/** The template data shard's own terrain and look materials as a hybrid's data (its runtime would own everything else). */
function templateHybrid(): { source: Shardfile; bytes: ReadonlyMap<string, Uint8Array> } {
  const terrain = template.terrain; if (terrain === null) throw new Error('The template declares terrain');
  const files = new Set([terrain.collider, ...terrain.tiles.map((tile) => tile.file)]), keep = (ref: string): boolean => files.has(ref);
  const base = emptyShardfile({ slug: 'template', name: 'Template shard', author: 'Wildshard', seed: 357, revision: 2 });
  const source: Shardfile = { ...base, identity: template.identity, spawn: template.spawn, edge: template.edge, budgets: template.budgets, runtime: { entry },
    terrain, files: template.files.filter((file) => keep(file.hash)), critical: template.critical.filter(keep),
    tiles: template.tiles.flatMap((tile) => { const kept = tile.files.filter(keep); return kept.length === 0 ? [] : [{ ...tile, files: kept }]; }),
    look: { ...base.look, families: template.look.families, materials: template.look.materials, familyLooks: template.look.familyLooks } };
  return { source, bytes: new Map([...files].map((hash) => [hash, new Uint8Array(readFileSync(`src/shards/_template/assets/${hash}`))])) };
}

function reader(source: Shardfile, bytes: ReadonlyMap<string, Uint8Array>): ClientAssets {
  const critical = new Map([...bytes].filter(([hash]) => source.critical.includes(hash)));
  return new ClientAssets(source, critical, { base: 'https://fixture.test/', firstParty: true, offline: true,
    fetch: () => Promise.reject(new Error('No network')), hash: (wire) => Promise.resolve(contentHash(wire)),
    cache: { product: () => Promise.resolve(null), asset: (_base, hash) => Promise.resolve(bytes.get(hash) ?? null), putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() } });
}

function client(source: Shardfile, bytes: ReadonlyMap<string, Uint8Array>, announced: { count: number }): ShardfileClient {
  return new ShardfileClient(source, reader(source, bytes), { trustedRuntime: true, instance: source.identity.slug, allocator: new ResidencyAllocator(), catalogue: [], items: new Map(), recipes: new Map(),
    icon: () => 'glyph', voices: () => new Map(), onSimulationExpected: () => { announced.count++; } });
}

/** A level context over a fake world whose runtime is the platform's normal host. */
function level(source: Shardfile): { app: App; ctx: ShardContext; runtime: ShardRuntime } {
  const app = new App(), scope = app.engineScope.child('presentation');
  const installation = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  // the stage reads the game only through its renderer (no texture or graph here) and its sky clock (no graph reads it)
  const game: unknown = Object.create(Game.prototype); if (!(game instanceof Game)) throw new Error('Missing Game prototype');
  const manifest = sourceManifest(source), { player, sky, forest, registry } = fakeWorld();
  const world = { game, player, sky, forest, registry, chunk: manifest } as ShardWorld;
  const runtime: ShardRuntime = { world, play: null, step: null, hooks: {}, objects: {}, interactables: [], overhead: [], viewer: () => new Vector3(), horizonVeil: null };
  return { app, runtime, ctx: shardContext(installation.context, manifest, { shard: manifest, runtime, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } }) };
}

function meshesWith(root: Object3D, material: Material): number {
  let count = 0; root.traverse((node) => { if (node instanceof Mesh && node.material === material) count++; }); return count;
}

describe('presentation-only data for a hybrid whose runtime keeps the simulation (G345)', () => {
  it('admits a runtime-bound host field as a curve source only when the runtime binds state', () => {
    const { source } = fixture();
    expect(materialCurveRules(source)).toEqual([]);
    const unbound = { ...source, runtime: { entry } };
    expect(materialCurveRules(unbound)).toEqual(['curves pbr: shared.dusk is not a declared public numeric state field (or a host one its runtime binds)']);
    // the template (a data shard, no runtime) may not drive a curve from a host field
    const hostTemplate = { ...template, state: { ...template.state, shared: [...template.state.shared, { ...dusk, id: 900 }] }, look: { ...template.look, curves: curve('shared.dusk') } };
    expect(() => parseShardfile(hostTemplate)).toThrow('shardfile semantic rules');
  });

  it('draws only the terrain in the look material, lends it to the runtime and moves the curve with the runtime\'s host state', async () => {
    const { source, bytes } = fixture(), announced = { count: 0 }, data = client(source, bytes, announced);
    expect(announced.count).toBe(0);
    const { app, ctx, runtime } = level(source), seen: string[] = [];
    let unbind = noop as () => void, value: number | undefined;
    class Runtime extends ShardPlugin {
      // the runtime's world runs after the data client's: its skirt draws in the data client's built material
      override world(context: ShardContext): void {
        const lent = runtimePresentation(source); if (lent === null) throw new Error('No lent presentation');
        const skirt = new Mesh(context.scope.own(new PlaneGeometry(1, 1)), lent.material('pbr'));
        context.root.add(skirt); context.scope.onDispose(() => { skirt.removeFromParent(); });
        unbind = lent.bindState((scope, name) => scope === 'shared' && name === 'dusk' ? value : undefined);
        seen.push('world');
      }
      override kit(): void { seen.push('kit'); }
      override play(): void { seen.push('play'); }
    }
    const plugin = new HybridShardPlugin(data, Runtime);
    try {
      await plugin.world(ctx); await plugin.kit(ctx); await plugin.play(ctx);
      expect(seen).toEqual(['world', 'kit', 'play']);
      const lent = runtimePresentation(source); if (lent === null) throw new Error('No lent presentation');
      const sand = lent.material('pbr');
      if (!(sand instanceof MeshStandardMaterial)) throw new Error('The PBR family material is a MeshStandardMaterial');
      // 16 coarse tiles plus the fine ring, and the runtime's skirt, all in one material
      expect(meshesWith(ctx.root, sand)).toBeGreaterThan(17);
      expect(() => lent.material('missing')).toThrow('no material missing');
      // the drawn terrain's queries are the admitted collider's
      const ground = lent.ground; if (ground === null) throw new Error('No lent ground');
      const reference = clientGround(source, bytes);
      for (const [x, z] of [[40, -30], [45.5, -21], [-200, 210]] as const) expect(ground.heightAt(x, z)).toBe(reference.heightAt(x, z));
      // no kit, play stage or simulation: only the residency and the materials' tick, and no hook taken
      expect(app.systemIds(ctx.scope).sort()).toEqual(['game.shardfile.presentation', 'game.shardfile.residency']);
      expect(runtime.hooks).toEqual({}); expect(runtime.buildEquipment).toBeUndefined();
      // the curve: the field's default until the runtime answers, then its live value
      const tick = (): void => { const system = app.systemsByPhase().update.find((row) => row.id === 'game.shardfile.presentation'); if (system === undefined) throw new Error('No material tick'); system.run(1 / 60, 0); };
      tick(); expect(sand.roughness).toBeCloseTo(0.375, 12);
      value = 1; tick(); expect(sand.roughness).toBeCloseTo(0.9, 12);
      value = 0; tick(); expect(sand.roughness).toBeCloseTo(0.2, 12);
      unbind(); tick(); expect(sand.roughness).toBeCloseTo(0.375, 12);
    } finally { app.engineScope.dispose(); }
    expect(runtimePresentation(source)).toBeNull();
  });

  it('keeps every other hybrid as it was: an unbound behaviour row still installs the whole data client', () => {
    const { source, bytes } = fixture(), announced = { count: 0 };
    client({ ...source, ui: [{ kind: 'marker', id: 'marker', label: 'Marker', at: [0, 0, 0] }] }, bytes, announced);
    client({ ...source, look: { ...source.look, keys: template.look.keys } }, bytes, announced);
    expect(announced.count).toBe(2);
    // a trusted hybrid with neither terrain nor materials stays empty; a data shard always installs the full client
    client({ ...source, terrain: null, tiles: [], files: [], critical: [], look: { ...source.look, families: [], materials: {}, curves: {} } }, bytes, announced);
    expect(announced.count).toBe(2);
    new ShardfileClient(template, reader(template, new Map()), { instance: 'template', catalogue: [], items: new Map(), recipes: new Map(), icon: () => 'glyph', voices: () => new Map(), onSimulationExpected: () => { announced.count++; } });
    expect(announced.count).toBe(3);
  });

  it('draws the template data shard\'s own terrain and material the same way, its ground the template\'s', async () => {
    const { source, bytes } = templateHybrid(), announced = { count: 0 }, data = client(source, bytes, announced);
    expect(announced.count).toBe(0);
    const { app, ctx } = level(source);
    try {
      await data.world(ctx); data.kit(ctx); await data.play(ctx);
      const lent = runtimePresentation(source), ground = lent?.ground; if (lent === null || ground === null || ground === undefined) throw new Error('No lent presentation');
      expect(meshesWith(ctx.root, lent.material('pbr'))).toBeGreaterThan(16);
      const reference = clientGround(template, bytes);
      for (const [x, z] of [[0, 0], [60, -15], [-180, 140]] as const) expect(ground.heightAt(x, z)).toBe(reference.heightAt(x, z));
      expect(app.systemIds(ctx.scope).sort()).toEqual(['game.shardfile.presentation', 'game.shardfile.residency']);
    } finally { app.engineScope.dispose(); }
  });
});
