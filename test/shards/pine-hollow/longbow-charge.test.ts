import { describe, expect, it } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { CombatCues } from '../../../src/engine/combat/cues';
import { Events } from '../../../src/engine/events/events';
import { LONGBOW } from '../../../src/shards/pine-hollow/weapons/equipment';
import { bindLongbowCharge } from '../../../src/shards/pine-hollow/loadout/events';
import { pineCombatCues } from '../../../src/shards/pine-hollow/runtime/audio/combatCues';

describe('longbow charge audio', () => {
  it('plays one creak per draw, keeps recover feedback and stops on scope disposal', () => {
    const events = new Events(), scope = new Scope('longbow-audio'), shots: string[] = [], recovered: boolean[] = [];
    const cues = new CombatCues(pineCombatCues({ shot: (id) => { shots.push(id); return true; }, later: () => undefined, stony: () => false, echoDelay: 0.42, echoGain: 0.55 }));
    bindLongbowCharge(events, scope, LONGBOW, cues, (ok) => { recovered.push(ok); });
    for (let i = 0; i < 3; i++) {
      events.emit('weapon.charge', { id: LONGBOW.id, phase: 'draw' });
      events.emit('weapon.charge', { id: LONGBOW.id, phase: 'draw', value: 1 });
      events.emit('weapon.charge', { id: LONGBOW.id, phase: 'loose', value: 1 });
    }
    events.emit('weapon.charge', { id: 'weapon.crossbow', phase: 'draw' });
    events.emit('weapon.charge', { id: LONGBOW.id, phase: 'recover', value: 1 });
    events.emit('weapon.charge', { id: LONGBOW.id, phase: 'recover', value: 0 });
    events.flush('update');
    expect(shots).toEqual(['longbowDraw', 'longbowDraw', 'longbowDraw']);
    expect(recovered).toEqual([true, false]);
    scope.dispose(); events.emit('weapon.charge', { id: LONGBOW.id, phase: 'draw' }); events.flush('update');
    expect(shots).toHaveLength(3);
  });
});
