// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3, type Object3D } from 'three';
import { Explore, type ExploreMode } from '../../src/engine/explore/Explore';
import { app } from '../../src/engine/app/runtime';
import { Scope } from '../../src/engine/app/scope';
import type { Game } from '../../src/engine/core/Game';
import type { World } from '../../src/engine/core/bootstrap';
import { FakeGame, legacyDouble } from '../fake/FakeGame';


const previousScope = app.levelScope;
afterEach(() => { app.levelScope?.dispose(); app.levelScope = previousScope; document.body.replaceChildren(); });

function fixture(): { explore: Explore; game: FakeGame; onExit: ReturnType<typeof vi.fn<() => void>> } {
  app.levelScope = new Scope('explore-viewmodel-test');
  const game = new FakeGame(), canvas = document.createElement('canvas');
  game.camera.add(game.viewmodel); game.scene.add(game.camera);
  const hostGame = legacyDouble<Game>({ app, camera: game.camera, viewmodel: game.viewmodel, canvas, scene: game.scene,
    level: legacyDouble<Game['level']>({ id: 'test', spawn: { x: 0, z: 0, yaw: 0 }, pois: [], explore: { world: '', models: '', sets: '', practice: '' }, creatureStyle: 'pbr' }),
    onUpdate: vi.fn<Game['onUpdate']>(),
  });
  const world = legacyDouble<World>({ game: hostGame, freeCamera: false,
    player: legacyDouble<World['player']>({ position: new Vector3(1, 2, 3), keys: new Set() }),
    forest: legacyDouble<World['forest']>({ trees: [] }), sky: legacyDouble<World['sky']>({}),
  });
  const onExit = vi.fn<() => void>();
  const explore = new Explore({ world, title: { name: 'Test', landscape: '', thumb: '' }, onExit, onPractice: vi.fn<() => void>(), openFeedback: vi.fn<() => void>() });
  return { explore, game, onExit };
}

it('hides kit and custom viewmodels throughout every Explore mode, then restores them on exit', () => {
  const { explore, game, onExit } = fixture();
  const kit = new Mesh(new BoxGeometry(), new MeshBasicMaterial({ transparent: true }));
  const custom = new Group(); custom.add(new Mesh(new BoxGeometry(), new MeshBasicMaterial()));
  game.viewmodel.add(kit, custom);
  const modes: ExploreMode[] = ['hub', 'world', 'model', 'sets', 'world'];
  for (const mode of modes) {
    explore.open(mode);
    // Reproduce a custom weapon update overriding EquipmentService.visible, plus a late mount.
    kit.visible = true; custom.visible = true;
    const late = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); game.viewmodel.add(late);
    game.scene.updateMatrixWorld(true);
    const drawn: Object3D[] = []; game.scene.traverseVisible((part) => { if (part instanceof Mesh) drawn.push(part); });
    expect(game.viewmodel.visible, mode).toBe(false); expect(drawn, mode).toEqual([]);
  }
  explore.close();
  expect(onExit).toHaveBeenCalledOnce(); expect(game.viewmodel.visible).toBe(true);
  expect(kit.visible).toBe(true); expect(custom.visible).toBe(true);
  explore.open('world'); expect(game.viewmodel.visible).toBe(false);
  explore.close(); expect(game.viewmodel.visible).toBe(true);
});

it('preserves an already hidden viewmodel root across Explore and an inactive close', () => {
  const { explore, game, onExit } = fixture();
  game.viewmodel.visible = false;
  explore.open('world'); explore.open('model'); explore.close(); explore.close();
  expect(game.viewmodel.visible).toBe(false); expect(onExit).toHaveBeenCalledOnce();
});
