import { AnimalManager } from '#engine/entities/AnimalManager';
import { fakeWorld } from './world';

/** Real manager without the canvas-only blood presentation. The caller owns active-shard/physics cleanup. */
export function manager(): ReturnType<typeof fakeWorld> & { manager: AnimalManager; advance: (n: number) => void } {
  const f = fakeWorld(), m = new AnimalManager(f.game.scene, f.sky, f.forest, { style: 'toon' });
  Reflect.set(m, 'blood', { update: (): void => undefined, burst: (): void => undefined });
  f.game.onUpdate((dt, t) => { m.update(dt, t, f.player.position); }, 'manager', true);
  return { ...f, manager: m, advance(n): void { for (let i = 0; i < n; i++) f.game.advance(1 / 60); if (f.game.dead) throw new Error('manager fixture faulted'); } };
}
