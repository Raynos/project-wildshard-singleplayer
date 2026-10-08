import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Scene } from 'three';
import { Scope } from '../../../src/engine/app/scope';
import { Game } from '../../../src/engine/core/Game';
import { adventureGame } from '../../../src/shards/driftwood-isle/quest/adventure';

/** The real Game scene binding (prototype getter + bindScene) on an instance without a WebGL context. */
function pageGame(scope: Scope): Game {
  const game: unknown = Object.create(Game.prototype);
  if (!(game instanceof Game)) throw new Error('Game prototype');
  for (const [key, value] of Object.entries({ rootScene: new Scene(), sceneFrames: [], camera: new PerspectiveCamera(), levelScope: scope })) {
    Reflect.defineProperty(game, key, { value, writable: true, enumerable: true });
  }
  return game;
}

// dw-crash (E435): SF47 made Game.scene a prototype getter; installAdventure spread the Game, the spread dropped `scene`,
// and Interactables.build threw "Cannot read properties of undefined (reading 'add')" at level.play, grid and standalone.
describe('Driftwood adventure game view', () => {
  it('a copied Game loses its scene getter (the crash), the adventure view keeps it', () => {
    const scope = new Scope('test'), game = pageGame(scope);
    // what `{ ...game }` copies: own enumerable properties only, so the prototype getter is gone
    const copied = Object.fromEntries(Object.entries(game));
    expect(copied).toHaveProperty('rootScene');
    expect(copied).not.toHaveProperty('scene');
    expect(game.scene).toBe(game.rootScene);
    const view = adventureGame(game, () => undefined);
    expect(view.scene).toBe(game.rootScene);
    expect(view.camera).toBe(game.camera);
  });

  it('follows the regional bindScene frame while entered and the root after leaving', () => {
    const scope = new Scope('test'), game = pageGame(scope), view = adventureGame(game, () => undefined);
    const frame = new Scene(), entered = scope.child('entered');
    game.rootScene.add(frame);
    game.bindScene(frame, entered);
    expect(view.scene).toBe(frame);
    entered.dispose();
    expect(view.scene).toBe(game.rootScene);
  });

  it('routes onUpdate to the adventure registration', () => {
    const scope = new Scope('test'), calls: string[] = [];
    const view = adventureGame(pageGame(scope), (_run, label) => { calls.push(label ?? 'none'); });
    view.onUpdate(() => undefined, 'shard.driftwood.adventure');
    expect(calls).toEqual(['shard.driftwood.adventure']);
  });
});
