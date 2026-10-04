import { AnimalManager } from '#engine-internal/entities/AnimalManager';
import { fakeWorld } from './world';
import { TickScheduler, type TickActor } from '#engine-internal/app/scheduler';
import type { Animal } from '#engine-internal/entities/Animal';

/** Frozen pre-S2.6 clock for the existing approach goldens; new band tests use the real scheduler. */
class LegacyClock extends TickScheduler {
  private accumulator = 0;
  private dt = 0;
  ready = false;
  override beginFrame(dt: number): void {
    this.dt = dt; this.accumulator += dt; this.ready = this.accumulator >= 0.1;
    if (this.ready) this.accumulator -= 0.1;
  }
  override takeBrainDt(_id: string, _actor: TickActor): number { return this.ready ? 0.1 : 0; }
  override bodyDt(_id: string, _actor: TickActor): number { return this.dt; }
}

/** Real manager without the canvas-only blood presentation. The caller owns active-shard/physics cleanup. */
export function manager({ legacyClock = false } = {}): ReturnType<typeof fakeWorld> & { manager: AnimalManager; advance: (n: number) => void } {
  const f = fakeWorld(), m = new AnimalManager(f.game.scene, f.sky, f.forest, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0.3, oneMaterial: true } });
  Reflect.set(m, 'blood', { update: (): void => undefined, burst: (): void => undefined });
  if (legacyClock) {
    const scheduler = new LegacyClock(), prev = f.player.position.clone();
    let initialized = false, speed = 0;
    const think: unknown = Reflect.get(m, 'think'), charge: unknown = Reflect.get(m, 'advanceCharge');
    if (typeof think !== 'function' || typeof charge !== 'function') throw new Error('Manager decision/body hooks moved');
    Reflect.set(m, 'scheduler', scheduler);
    Reflect.set(m, 'advanceCharge', () => undefined);
    Reflect.set(m, 'interrupt', () => undefined);
    Reflect.set(m, 'think', (a: Animal, dt: number, player: typeof prev, sprinting: boolean) => {
      if (!initialized) { prev.copy(player); initialized = true; }
      const moved = Math.hypot(player.x - prev.x, player.z - prev.z); prev.copy(player);
      speed += (Math.min(moved / 0.1, 9) - speed) * 0.5; Reflect.set(m, 'playerSpeed', speed);
      const charging = a.state === 'charge';
      Reflect.apply(think, m, [a, dt, player, sprinting]);
      if (charging && a.state === 'charge') Reflect.apply(charge, m, [a, dt, player]);
    });
  }
  f.game.onUpdate((dt, t) => { m.update(dt, t, f.player.position); }, 'manager', true);
  return { ...f, manager: m, advance(n): void { for (let i = 0; i < n; i++) f.game.advance(1 / 60); if (f.game.dead) throw new Error('manager fixture faulted'); } };
}
