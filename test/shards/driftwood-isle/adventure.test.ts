import { describe, expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import type { Actor, DamageRequest } from '../../../src/engine/combat/pipeline';
import { Events } from '../../../src/engine/events/events';
import type { LevelContext } from '../../../src/engine/level/context';
import { Vector3 } from 'three';
import { DEATH_ORDER, onCreatureDeath } from '../../../src/game/loot/deaths';

const actor = (): Actor => ({ id: 'creature.crab', tags: ['actor.creature', 'creature.crab'], state: [],
  attributes: { health: 0, maxHealth: 25 }, alive: false, applyDamage: () => false });

describe('Driftwood adventure death ordering', () => {
  it('runs Spine, Ecology, keepsakes, then loot for the exact killed body and releases all on eviction', () => {
    const events = new Events(), scope = new Scope('driftwood'), killed = actor(), other = actor();
    const bodies = [{ combatActor: () => other }, { combatActor: () => killed }];
    const context: Pick<LevelContext, 'on'> = { on: (name, fn, options) => { events.on(name, fn, scope, options); } };
    const order: string[] = [];
    for (const [name, priority] of Object.entries(DEATH_ORDER).reverse()) {
      onCreatureDeath(context, () => bodies, (body) => { expect(body).toBe(bodies[1]); order.push(name); }, priority);
    }
    const req: DamageRequest = { source: 'env', sourceTags: ['cover.checked'], target: killed, amount: 25, point: new Vector3(), dir: new Vector3() };
    events.emit('actor.died', { actor: killed, req }); events.flush('update');
    expect(order).toEqual(['spine', 'ecology', 'keepsakes', 'loot']);
    events.emit('actor.died', { actor: actor(), req }); events.flush('update');
    expect(order).toHaveLength(4);
    scope.dispose();
    expect(events.census().listeners).toBe(0);
    events.emit('actor.died', { actor: killed, req }); events.flush('update');
    expect(order).toHaveLength(4);
  });
});
