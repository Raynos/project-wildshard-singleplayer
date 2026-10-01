// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene, Texture } from 'three';
import { App, Scope, AssetService } from '#engine';
import { SceneOwnership } from '#engine/app/sceneOwnership';
import { ShardScope, enterScope, installScopes, withScopeOwner } from '#engine/core/shardScope';
import { Physics } from '#engine/physics/Physics';
import { loadRapier } from '#engine/physics/rapier';
import wasmInline from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?inline';

describe('level unload keeps the engine usable', () => {
  it('removes real Rapier handles and scene ownership, releases acquired textures, and runs another engine frame', async () => {
    const R = await loadRapier(await (await fetch(wasmInline)).arrayBuffer());
    const legacy = new ShardScope('test'), level = legacy.resources, app = new App();
    enterScope(legacy); legacy.owner = app.engineScope;
    const physics = new Physics(R), player = physics.world.createRigidBody(R.RigidBodyDesc.dynamic());
    physics.world.createCollider(R.ColliderDesc.ball(0.2), player);
    const scene = new Scene(), rig = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); scene.add(rig);
    const assets = new AssetService(), ownership = new SceneOwnership(scene, level, assets);
    ownership.retain(scene);
    const geometry = new BoxGeometry(), shared = new Texture(), dispose = vi.fn<() => void>();
    shared.addEventListener('dispose', dispose); assets.register(`scene:${shared.uuid}`, shared, { retain: true });
    const root = new Group(), mesh = new Mesh(geometry, new MeshBasicMaterial({ map: shared })); root.add(mesh); scene.add(root);
    const freed = vi.fn<() => void>(); geometry.addEventListener('dispose', freed);
    const body = withScopeOwner(level, () => {
      const b = physics.world.createRigidBody(R.RigidBodyDesc.fixed());
      physics.world.createCollider(R.ColliderDesc.cuboid(1, 1, 1), b);
      return b;
    });
    const render = vi.fn<() => void>(), levelFrame = vi.fn<() => void>();
    app.addSystem({ id: 'engine.frame', phase: 'update', run: () => { physics.step(); render(); } }, app.engineScope);
    app.addSystem({ id: 'level.frame', phase: 'update', run: levelFrame }, level);
    ownership.capture();
    expect(level.census).toMatchObject({ bodies: 1, colliders: 1, geometries: 1, materials: 1, systems: 1 });
    level.dispose(); level.dispose();
    expect(body.isValid()).toBe(false); expect(player.isValid()).toBe(true);
    expect(physics.world.bodies.len()).toBe(1); expect(physics.world.colliders.len()).toBe(1);
    expect(scene.children).toEqual([rig]); expect(freed).toHaveBeenCalledOnce(); expect(dispose).not.toHaveBeenCalled();
    for (const system of app.systemsByPhase().update) system.run(1 / 60, 0);
    expect(render).toHaveBeenCalledOnce(); expect(levelFrame).not.toHaveBeenCalled();
    const next = new Scope('next'); app.addSystem({ id: 'level.frame', phase: 'update', run: levelFrame }, next);
    for (const system of app.systemsByPhase().update) system.run(1 / 60, 0);
    expect(levelFrame).toHaveBeenCalledOnce();
    next.dispose(); app.engineScope.dispose(); enterScope(null); physics.dispose();
  });

  it('captures legacy listeners, pending and completed timers, and body nodes without removing engine listeners', async () => {
    installScopes();
    const legacy = new ShardScope('test'), engine = new Scope('engine'), level = legacy.resources;
    enterScope(legacy);
    const retained = vi.fn<() => void>(), removed = vi.fn<() => void>();
    withScopeOwner(engine, () => { window.addEventListener('ownership-test', retained); });
    document.addEventListener('ownership-test', removed);
    const button = document.createElement('button'); document.body.append(button); button.addEventListener('click', removed);
    window.setTimeout(removed, 100_000); window.setInterval(removed, 100_000);
    await new Promise<void>((resolve) => { window.setTimeout(resolve, 0); });
    withScopeOwner(engine, () => { /* Flush the body's mutations before inspecting ownership. */ });
    expect(level.census).toMatchObject({ listeners: 2, timers: 2, nodes: 1 });
    button.click(); expect(removed).toHaveBeenCalledOnce();
    level.dispose();
    document.dispatchEvent(new Event('ownership-test')); button.click(); window.dispatchEvent(new Event('ownership-test'));
    expect(removed).toHaveBeenCalledOnce(); expect(retained).toHaveBeenCalledOnce(); expect(button.isConnected).toBe(false);
    expect(Object.values(level.census).every((n) => n === 0)).toBe(true);
    engine.dispose(); enterScope(null);
  });
});
