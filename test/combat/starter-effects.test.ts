import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../../src/engine/app/scope';
import { EffectService } from '../../src/engine/combat/effects/EffectService';
import { PlayerHealth } from '../../src/engine/combat/health';
import { CombatPipeline, type Actor } from '../../src/engine/combat/pipeline';
import { Events } from '../../src/engine/events/events';
import { STARTER_EFFECTS } from '../../src/kit/effects/starter';
import { bindStarterEffects } from '../../src/kit/effects/bindings';

function setup() {
  const scope = new Scope('starter-test'), events = new Events(), combat = new CombatPipeline(events, scope);
  let dodging = false;
  const target = new PlayerHealth(events, { now: () => 0, position: () => new Vector3(), dodging: () => dodging, dodgeGuard: () => true });
  const effects = new EffectService(STARTER_EFFECTS, scope, events), movement = { effectMoveLocked: false, effectMoveScale: 1 };
  const source: Actor = { id: 'test.hostile', tags: ['elite.blackpaw'], state: [], attributes: { health: 100, maxHealth: 100 }, alive: true, applyDamage: () => false };
  combat.playerRules(scope, { target });
  bindStarterEffects({ effects, target, movement, combat, position: () => new Vector3(), scope });
  return { scope, target, effects, movement, source, dodge: (on: boolean) => { dodging = on; } };
}

describe('S2.5 starter rows and live bindings', () => {
  it('the proposed durations, periods, damage, stacks, cues and icons match 09 §2.4', () => {
    expect(STARTER_EFFECTS.map((row) => [row.id, row.duration, row.period, row.tickDamage, row.stacking, row.cue, row.icon])).toEqual([
      ['effect.stun', 1.3, undefined, undefined, 'refresh', 'cue.status.stun', 'status-stun'],
      ['effect.burn', 3, 0.5, 4, 'refresh', 'cue.status.burn', 'status-burn'],
      ['effect.poison', 6, 1, 3, 'refresh', 'cue.status.poison', 'status-poison'],
      ['effect.bleed', 4, 0.5, 2, { max: 3 }, 'cue.status.bleed', 'status-bleed'],
      ['effect.slow', 3, undefined, undefined, 'refresh', 'cue.status.slow', 'status-slow'],
    ]);
  });
  it.each([['effect.burn', 24], ['effect.poison', 18], ['effect.bleed', 16]] as const)('%s deals all ticks even with fractional frame steps', (id, damage) => {
    const { target, effects } = setup(); effects.apply(target, id);
    for (let i = 0; i < 700; i++) effects.update(0.016);
    expect(target.attributes.health).toBe(100 - damage); expect(effects.active(target)).toHaveLength(0);
  });
  it('bleed stacks to three and timed wardrobe sync never clears it', () => {
    const { target, effects } = setup();
    for (let i = 0; i < 5; i++) effects.apply(target, 'effect.bleed');
    effects.sync(target, []); expect(effects.active(target)[0]?.stacks).toBe(3);
    effects.update(4); expect(target.attributes.health).toBe(52);
  });
  it('source tags make periodic damage use the same dodge guard and hit cap', () => {
    const { target, effects, source, dodge } = setup();
    target.effectTags = ['guard.dodge'];
    effects.apply(target, 'effect.poison', source, { sourceTags: ['status.poison'] });
    dodge(true); effects.update(1); expect(target.attributes.health).toBe(100);
    dodge(false); target.attributes.incomingCap = 2; effects.update(1); expect(target.attributes.health).toBe(98);
  });
  it('stun refresh has the original length; slow preserves separate movement channels and both reset on scope disposal', () => {
    const { target, effects, movement, scope } = setup();
    effects.apply(target, 'effect.stun'); expect(movement.effectMoveLocked).toBe(true);
    effects.update(1); effects.apply(target, 'effect.stun'); effects.update(1.299);
    expect(movement.effectMoveLocked).toBe(true); effects.update(0.001); expect(movement.effectMoveLocked).toBe(false);
    effects.apply(target, 'effect.slow'); expect(movement.effectMoveScale).toBe(0.6);
    effects.apply(target, 'effect.stun'); scope.dispose();
    expect(movement).toEqual({ effectMoveLocked: false, effectMoveScale: 1 }); expect(effects.active(target)).toHaveLength(0);
  });
});
