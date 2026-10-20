import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import { Scope } from '../src/engine/app/scope';
import { Events } from '../src/engine/events/events';
import { CombatPipeline } from '../src/engine/combat/pipeline';

// Actual event owner characterization. FIFO contacts are available; entry-pose
// witnesses cannot be reconstructed by reading live actors at delayed dispatch.
test('queued real combat retains contact order and cloned points but borrows the current actor', () => {
  const scope = new Scope('event-boundary'), events = new Events(), combat = new CombatPipeline(events, scope);
  const actor = new AnimalSim({ kind: 'probe', label: 'Probe', variant: 'common', rarity: 'common', hp: 3,
    aggressive: true, dims: { bodyY: 1, bodyHalfLen: 1, bodyRadius: .4, headRadius: .3, legLen: 1, feet: [], halfWidth: .4 },
    mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 20, relentless: false },
  }, 1, 1, 'practice.probe', { heightAt: () => 0, now: () => 1000, random: () => .5 });
  const observed: { killed: boolean; alive: boolean; x: number }[] = [];
  let deaths = 0;
  events.on('damage.dealt', hit => { observed.push({ killed: hit.killed, alive: hit.req.target.alive, x: hit.req.point.x }); }, scope);
  events.on('actor.died', () => { deaths++; }, scope);
  const point = new Vector3(1, 0, 0), dir = new Vector3(1, 0, 0);
  const hit = () => combat.hit({ source: 'env', sourceTags: [], target: actor.combatActor(), amount: 2, point, dir });
  hit(); point.x = 2; hit(); point.x = 999;
  expect(actor.alive).toBe(false); expect(observed).toEqual([]);
  events.flush('update');
  expect(observed).toEqual([{ killed: false, alive: false, x: 1 }, { killed: true, alive: false, x: 2 }]);
  expect(deaths).toBe(1);
  events.flush('update'); expect(observed).toHaveLength(2); expect(deaths).toBe(1);
  scope.dispose(); expect(events.census()).toEqual({ listeners: 0, answerers: 0 });
});
