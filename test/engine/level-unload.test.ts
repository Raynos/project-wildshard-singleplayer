// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Vitest runs in Node; DOM globals do not change the binary's filesystem source.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the real dependency outside the symlinked clean-export tree in this Node test.
import { createRequire } from 'node:module';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene, Texture, DirectionalLight, WebGLRenderTarget, Bone, Skeleton, SkinnedMesh } from 'three';
import { App, Scope, AssetService } from '#engine';
import { SceneOwnership } from '#engine/app/sceneOwnership';
import { ShardScope, enterScope, installScopes, withScopeOwner } from '#engine/core/shardScope';
import { Physics } from '#engine/physics/Physics';
import { loadRapier } from '#engine/physics/rapier';

describe('level unload keeps the engine usable', () => {
  it('removes real Rapier handles and scene ownership, releases acquired textures, and runs another engine frame', async () => {
    // happy-dom uses Vite's client asset resolver: a symlinked dependency outside a clean export is denied.
    // Resolve the package with Node, as this is a Node test with DOM globals, and pass the actual binary unchanged.
    const R = await loadRapier(readFileSync(createRequire(import.meta.url).resolve('@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm')));
    const legacy = new ShardScope('test'), level = legacy.resources, app = new App();
    enterScope(legacy); legacy.owner = app.engineScope;
    const physics = new Physics(R), player = physics.world.createRigidBody(R.RigidBodyDesc.dynamic());
    physics.world.createCollider(R.ColliderDesc.ball(0.2), player);
    const scene = new Scene(), rig = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); scene.add(rig);
    const assets = new AssetService(), ownership = new SceneOwnership(scene, level, assets);
    ownership.retain(scene);
    const quadGeometry = new BoxGeometry(), quadMaterial = new MeshBasicMaterial(), quad = new Mesh(quadGeometry, quadMaterial);
    const quadDispose = vi.fn<() => void>(); quadGeometry.addEventListener('dispose', quadDispose);
    ownership.retainContainer({ screen: quad, scene });
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
    expect(quadDispose).not.toHaveBeenCalled(); expect(assets.isAcquired(quadGeometry)).toBe(true);
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
    const another = document.createElement('button'); another.addEventListener('click', removed);
    another.addEventListener('click', removed);
    expect(level.census.listeners).toBe(3);
    const abort = new AbortController(); document.addEventListener('aborted', removed, { signal: abort.signal });
    abort.abort(); expect(level.census.listeners).toBe(3);
    another.removeEventListener('click', removed); expect(level.census.listeners).toBe(2);
    // Removing a non-last registration must not silently discard its neighbor's disposal record.
    document.removeEventListener('ownership-test', removed); expect(level.census.listeners).toBe(1);
    document.addEventListener('ownership-test', removed); expect(level.census.listeners).toBe(2);
    button.click(); expect(removed).toHaveBeenCalledOnce();
    level.dispose();
    document.dispatchEvent(new Event('ownership-test')); button.click(); window.dispatchEvent(new Event('ownership-test'));
    expect(removed).toHaveBeenCalledOnce(); expect(retained).toHaveBeenCalledOnce(); expect(button.isConnected).toBe(false);
    expect(Object.values(level.census).every((n) => n === 0)).toBe(true);
    document.addEventListener('ownership-test', removed);
    expect(window.setTimeout(removed, 1)).toBe(0); expect(window.setInterval(removed, 1)).toBe(0);
    document.dispatchEvent(new Event('ownership-test')); expect(removed).toHaveBeenCalledOnce();
    engine.dispose(); enterScope(null);
  });

  it('retains shadow targets allocated after engine bootstrap and frees level skeleton textures', () => {
    const scene = new Scene(), light = new DirectionalLight(), level = new Scope('level'), assets = new AssetService();
    scene.add(light);
    const ownership = new SceneOwnership(scene, level, assets);
    ownership.retain(scene);
    light.shadow.map = new WebGLRenderTarget();
    const engineDispose = vi.fn<() => void>(); light.shadow.map.addEventListener('dispose', engineDispose);
    const skeleton = new Skeleton([new Bone()]); skeleton.computeBoneTexture();
    const boneDispose = vi.fn<() => void>(); skeleton.boneTexture?.addEventListener('dispose', boneDispose);
    const mesh = new SkinnedMesh(new BoxGeometry(), new MeshBasicMaterial()); mesh.skeleton = skeleton; scene.add(mesh);
    ownership.retainContainer(null); ownership.capture(); level.dispose();
    expect(assets.isAcquired(light.shadow.map)).toBe(true); expect(engineDispose).not.toHaveBeenCalled();
    expect(boneDispose).toHaveBeenCalledOnce(); expect(scene.children).toEqual([light]);
  });
});
