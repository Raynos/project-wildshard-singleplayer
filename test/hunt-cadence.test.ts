import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { StalkerBrain, type StalkerObservation } from '../src/engine/ai/stalker';

class ObservedBrain extends StalkerBrain<AnimalSim> {
  readonly events: string[] = [];
  constructor() {
    super({ pattern: 'skirmish', spec: { awareRadius: 8, shyRadius: 4, disengageRadius: 12, holdRadius: 3, attackRadius: 2,
      attackDuration: 1, attackCooldown: 1, alertCooldown: 1, fleeSpeed: 4,
      subordinateVariant: 'small', leaderVariant: 'large', noticeCue: 'notice' } });
  }
  override think(_actor: AnimalSim, observation: StalkerObservation<AnimalSim> | number, _player?: Vector3, _sprinting?: boolean, _speed?: number): void {
    this.events.push(typeof observation === 'number' && observation === 0 ? 'interrupt' : 'think');
  }
  override hurt(): void { this.events.push('hurt'); }
  override died(): void { this.events.push('died'); }
}

function actor(): AnimalSim {
  const body = new AnimalSim({ kind: 'hunter', label: 'Hunter', variant: 'common', rarity: 'common', hp: 30, aggressive: true,
    dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: 0.4, headRadius: 0.3, legLen: 1, feet: [], halfWidth: 0.4 },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 20, relentless: false } },
  1, 1, 'hunter', { heightAt: () => 0, random: () => 0.5 });
  body.state = 'stalk'; return body;
}

test('hunt cadence preserves combined and interrupt ordering with borrowed restored noise and sight', () => {
  for (const order of ['combined', 'interrupt'] as const) {
    const brain = new ObservedBrain(), body = actor(), player = new Vector3();
    const noise = { seen: false, prev: new Vector3(), speed: 0 }, sight: (boolean | null)[] = [true];
    let alreadyDecided = false;
    const ports = { limit: 2, order, at: (i: number) => i === 0 ? body : null, actor: (a: AnimalSim) => a, id: (a: AnimalSim) => a.entityId,
      player, noise, sight, reach: () => false,
      brainDt: (_id: string, urgent?: boolean) => {
        brain.events.push(urgent === true ? 'urgent' : 'normal');
        if (alreadyDecided) return 0;
        alreadyDecided = true; return 0.05;
      } };
    const cadence = brain.bindRoster(ports);
    cadence.observe(0.05); player.x = 0.2; cadence.observe(0.05);
    expect(noise.speed).toBeGreaterThan(0); expect(noise.speed).toBeLessThan(9);
    cadence.decide();
    expect(brain.events).toEqual(order === 'combined' ? ['urgent', 'think'] : ['urgent', 'think', 'normal']);
    expect(sight[0]).toBe(false);
    // Restoration writes the caller's existing records: there is no hidden driver state to reset.
    noise.prev.copy(player); noise.speed = 2; noise.seen = true; sight[0] = true;
    cadence.observe(0.05); expect(noise.speed).toBeGreaterThan(0); expect(noise.speed).toBeLessThan(2);
    brain.events.length = 0; cadence.decide();
    expect(brain.events).toEqual(order === 'combined' ? ['urgent'] : ['urgent', 'interrupt', 'normal']);
    brain.events.length = 0; cadence.damaged(body.combatActor(), false);
    expect(brain.events[0]).toBe('hurt'); expect(brain.events).toContain('urgent');
    brain.events.length = 0; cadence.damaged(body.combatActor(), true); expect(brain.events).toEqual(['died']);
    expect(() => cadence.observe(0)).toThrow();
    expect(() => brain.bindRoster({ ...ports, limit: Infinity })).toThrow();
  }
});

test('owned enemy policy retains stagger hold and ignores fauna damage wake', () => {
  const brain = new ObservedBrain(), body = actor(); let decided = false;
  const cadence = brain.bindRoster({ limit: 1, order: 'interrupt', at: () => body, actor: a => a, id: a => a.entityId,
    player: new Vector3(0, 0, 2), noise: { seen: true, prev: new Vector3(), speed: 0 }, sight: [],
    reach: () => true, brainDt: () => 0.05, policy: () => ({ decide: () => { decided = true; } }) });
  cadence.wake(body); expect(decided).toBe(true);
  decided = false; body.stagger(new Vector3(1, 0, 0), 1); cadence.wake(body);
  expect(decided).toBe(false); expect(body.lookWeight).toBe(1);
  cadence.damaged(body.combatActor(), false); expect(brain.events).toEqual([]);
});
