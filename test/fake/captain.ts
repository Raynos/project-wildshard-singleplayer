import { vi } from 'vitest';
import { Vector3 } from 'three';
import { Events, Scope, type BossPresentation } from '#engine';
import { DrownedCaptain } from '#shards/driftwood-isle/combat/captain';

export function captainFixture(): {
  boss: DrownedCaptain; actor: { position: Vector3; mem: Record<string, number>; alive: boolean; hp: number; maxHp: number };
  player: { position: Vector3 }; ui: BossPresentation; flags: Set<string>; events: Events; scope: Scope;
} {
  const actor = { position: new Vector3(), mem: { rise: 0, phase: 1 } as Record<string, number>, alive: true, hp: 320, maxHp: 320 };
  const player = { position: new Vector3(0, 0, 3) }, flags = new Set<string>(), events = new Events(), scope = new Scope('captain-test');
  let shown = false;
  const noop = (): void => undefined;
  const ui: BossPresentation = {
    update: vi.fn(noop), get barShown() { return shown; }, hideBar: vi.fn(() => { shown = false; }),
    hideNameCard: vi.fn(noop), hideReward: vi.fn(noop), showRetry: vi.fn(noop), showNameCard: vi.fn(noop),
    setSkip: vi.fn(noop), showBar: vi.fn(() => { shown = true; }), setHp: vi.fn(noop), setShield: vi.fn(noop), setPhase: vi.fn(noop),
  };
  const boss = new DrownedCaptain({ player, pool: { x: 0, z: 0 }, flags: { has: (flag) => flags.has(flag) }, animal: () => actor, events, ui });
  return { boss, actor, player, flags, events, ui, scope };
}
