// SF57 leak5 (E435): the owner reads that counted as strays during owned async builds — a region world's bodies made
// after an `await`, a module cache's registration and a retained home's hook registration — take their own owner, or
// none, without an ambient read.
// oxlint-disable-next-line import/no-nodejs-modules -- The lifetime witness uses the production native engine.
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { enterOwner, ownerCensus, ownerTask, withOwner } from '../../src/engine/app/ownership';
import { AssetService, type AssetResidencyPort } from '../../src/engine/app/assets';
import { Physics } from '../../src/engine/physics/Physics';
import { loadRapier } from '../../src/engine/physics/rapier';
import { BufferGeometry } from 'three';
import { App } from '../../src/engine/app/app';
import { createLevelInstallation } from '../../src/engine/level/installation';
import { WorldRegistry } from '../../src/engine/world/registry';
import { shardContext } from '../../src/game/shard/context';
import { RetainedRuntimeHooks } from '../../src/game/shard/retainedHooks';
import { emptyShardfileSource } from '../../src/game/shardfile/loader';
import { emptyShardfile } from '../../src/sdk/author';

const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });
afterEach(() => { enterOwner(null); });

it('a region world owns a body made after an await: it ends with the world scope, not the page, with no stray read', async () => {
  const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const page = new Scope('page-level'), region = page.child('sim:region'), build = page.child('resident');
  enterOwner(page);
  const physics = new Physics(R, undefined, region), before = ownerCensus().strayReads;
  await ownerTask(build, async () => {
    await tick();
    const body = physics.world.createRigidBody(R.RigidBodyDesc.fixed());
    physics.world.createCollider(R.ColliderDesc.ball(1), body);
  });
  expect(ownerCensus().strayReads).toBe(before);
  expect(region.census.bodies).toBe(1); expect(region.census.colliders).toBe(1);
  expect(page.census.bodies - region.census.bodies).toBe(0); // the page holds none of it
  // an enclosing withOwner section still wins over the world's own scope
  const piece = region.child('piece');
  withOwner(piece, () => { physics.world.createCollider(R.ColliderDesc.ball(1)); });
  expect(piece.census.colliders).toBe(1);
  // a withOwner(null) section (asShell, createSimHost) still means no owner: the world's own dispose frees that one
  withOwner(null, () => { physics.world.createCollider(R.ColliderDesc.ball(1)); });
  expect(region.census.colliders).toBe(2);
  region.dispose();
  expect(physics.world.bodies.len()).toBe(0); expect(physics.world.colliders.len()).toBe(1);
  physics.dispose(); build.dispose(); page.dispose();
});

it('the page world keeps the ambient owner', async () => {
  const R = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')).buffer);
  const page = new Scope('page-level');
  enterOwner(page);
  const physics = new Physics(R);
  physics.world.createRigidBody(R.RigidBodyDesc.fixed());
  expect(page.census.bodies).toBe(1);
  page.dispose();
  expect(physics.world.bodies.len()).toBe(0);
  physics.dispose();
});

it('a cached registration after an await is attributed without an owner read; inside withOwner it names that scope', async () => {
  const page = new Scope('page-level'), build = page.child('resident');
  enterOwner(page);
  const seen: (Scope | null)[] = [];
  const port: AssetResidencyPort<BufferGeometry> = { register: (_key, _resource, owner) => { seen.push(owner); return { observe: () => undefined, release: () => undefined }; } };
  const assets = new AssetService<BufferGeometry>(); assets.bindResidency(port);
  const before = ownerCensus().strayReads;
  await ownerTask(build, async () => {
    await tick();
    assets.register('cached:a', new BufferGeometry(), { retain: true, cache: true });
    withOwner(build, () => { assets.register('cached:b', new BufferGeometry(), { retain: true, cache: true }); });
  });
  expect(ownerCensus().strayReads).toBe(before);
  expect(seen).toEqual([null, build]); // null: the port's own reader decides, as it did for the ambient owner
  build.dispose(); page.dispose();
});

it('a retained home registers its entered hooks after an await without an owner read', async () => {
  const app = new App(); app.registryValue = new WorldRegistry();
  const scope = app.engineScope.child('home'), source = emptyShardfile({ slug: 'home', name: 'Home', author: 'Fixture', seed: 1, revision: 1 });
  const manifest = emptyShardfileSource(source), base = createLevelInstallation(app, scope, {}, () => ({ set: () => undefined, detail: () => undefined }));
  const context = shardContext(base.context, manifest, { shard: manifest, rows: new Map(), bag: { tab: () => () => undefined, fragment: () => () => undefined } });
  const hooks = new RetainedRuntimeHooks(context), before = ownerCensus().strayReads;
  enterOwner(app.engineScope);
  try {
    await ownerTask(scope, async () => {
      await tick();
      hooks.context.system({ id: 'home.after-await', phase: 'update', run: () => undefined });
    });
    expect(ownerCensus().strayReads).toBe(before);
    expect(app.systemsByPhase().update.map((system) => system.id)).toContain('home.after-await');
    hooks.deactivate();
    expect(app.systemsByPhase().update.map((system) => system.id)).not.toContain('home.after-await');
  } finally { app.engineScope.dispose(); }
});
