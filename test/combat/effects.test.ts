import { describe, expect, it } from 'vitest';
import { EffectService } from '#engine/combat/effects/EffectService';
import { sourceMultiplier, type EffectTarget, type EffectDef } from '#engine/combat/effects/types';
import { DRIFTWOOD_EFFECTS, driftwoodAttributes } from '#shards/driftwood-isle/loot/effects';
import { SNEAK_SHOT, NALATI_SOURCE_MULTIPLIERS, nalatiSkinEffect } from '#shards/nalati-grasslands/weapons/effects';
import { AMMO_ROWS, PINE_AMMO_EFFECTS, PINE_SOURCE_MULTIPLIERS, pineFinishEffect } from '#shards/pine-hollow/loadout/effects';
import { Scope } from '#engine/app/scope';
import { Events } from '#engine/events/events';
import type { OwnedId } from '#game/loot/Owned';

const owns = (...ids: OwnedId[]): { has: (id: OwnedId) => boolean } => ({ has: (id) => ids.includes(id) });
describe('E357 effect core, current E1–E14 rows', () => {
  it('E1–E8 keep the exact current heart, charm, whetstone and claw arithmetic', () => {
    expect(driftwoodAttributes(owns()).attributes).toMatchObject({ maxHealth: 100, dodgeCooldownMul: 1, damage: 1, heavyDamageMul: 1 });
    const all = driftwoodAttributes(owns('heart-1', 'heart-2', 'charm-1', 'charm-2', 'charm-3', 'whetstone-1', 'whetstone-2', 'bear-claw', 'boar-tusk'));
    expect(all.attributes).toMatchObject({ maxHealth: 150, dodgeCooldownMul: 0.7, damage: 1.5, heavyDamageMul: 1.2 });
    expect(all.tags).toContain('guard.dodge'); expect(all.tags).toContain('cosmetic.seaglass-glow');
    for (const [base, sharp1, sharp2] of [[12, 15, 18], [28, 35, 42]]) {
      const effects = new EffectService(DRIFTWOOD_EFFECTS), target: EffectTarget = { attributes: { damage: base } };
      effects.apply(target, 'effect.whetstone.1'); expect(Math.round(target.attributes['damage'] ?? 0)).toBe(sharp1);
      effects.apply(target, 'effect.whetstone.2'); expect(Math.round(target.attributes['damage'] ?? 0)).toBe(sharp2);
      expect(effects.active(target).map((effect) => effect.def.id)).toEqual(['effect.whetstone.2']);
    }
    expect(Math.round(24 * (all.attributes['heavyDamageMul'] ?? 0))).toBe(29);
    expect(Math.round(56 * (all.attributes['heavyDamageMul'] ?? 0))).toBe(67);
  });
  it('permanent loadout sync is idempotent, and removes restore original bases and tags', () => {
    const effects = new EffectService(DRIFTWOOD_EFFECTS), target: EffectTarget = { attributes: { maxHealth: 100, dodgeCooldownMul: 1 }, effectTags: ['state.mounted'] };
    const grants = [{ id: 'effect.sturdy-heart' as const, stacks: 2 }, { id: 'effect.charm.1' as const }];
    effects.sync(target, grants); effects.sync(target, grants); expect(target.attributes['maxHealth']).toBe(150);
    effects.sync(target, []); expect(target.attributes['maxHealth']).toBe(100); expect(target.effectTags).toEqual(['state.mounted']);
  });
  it('E9 has the current20 cap, and E11 wardrobe grants have no numbers', () => {
    const effects = new EffectService(DRIFTWOOD_EFFECTS), target: EffectTarget = { attributes: { incomingCap: Infinity } };
    effects.apply(target, 'effect.hit-cap'); expect(target.attributes['incomingCap']).toBe(20);
    effects.apply(target, 'effect.captain-hat'); effects.apply(target, 'effect.cape');
    expect(effects.has(target, 'cosmetic.hat.captain')).toBe(true); expect(effects.has(target, 'cosmetic.cape')).toBe(true);
    effects.remove(target, 'effect.hit-cap'); expect(target.attributes['incomingCap']).toBe(Infinity);
  });
  it('E10 refreshes the4-second window and source formulas retain their rounding point', () => {
    const effects = new EffectService([SNEAK_SHOT]), target: EffectTarget = { attributes: {} };
    effects.apply(target, SNEAK_SHOT.id); effects.update(3.9); expect(effects.has(target, 'state.sneak-shot')).toBe(true);
    effects.apply(target, SNEAK_SHOT.id); effects.update(3.9); expect(effects.has(target, 'state.sneak-shot')).toBe(true);
    effects.update(0.1); expect(effects.has(target, 'state.sneak-shot')).toBe(false);
    expect(sourceMultiplier(NALATI_SOURCE_MULTIPLIERS, { sourceTags: ['state.sneak-shot', 'arrow.sun'], weaponTags: ['weapon.golden-bow'], targetTags: ['creature.balbal'] })).toBe(6);
    expect(sourceMultiplier(NALATI_SOURCE_MULTIPLIERS, { weaponTags: ['weapon.golden-bow'], targetTags: ['creature.boar'] })).toBe(1);
    const mul = sourceMultiplier(PINE_SOURCE_MULTIPLIERS, { sourceTags: ['ammo.broadhead'], targetTags: ['size.deer'] });
    expect(33 * mul).toBe(46.199999999999996); // the bolt product is deliberately unrounded
  });
  it('E12/E13 replace one finish per slot and grant cosmetic tags without modifiers', () => {
    const defs = [pineFinishEffect('hollow-ash', 'crossbow'), pineFinishEffect('ghost-stag', 'crossbow'), pineFinishEffect('ironhide', 'rifle'), nalatiSkinEffect('irbis-sabre', 'sabre')];
    const effects = new EffectService(defs), target: EffectTarget = { attributes: { damage: 12 } };
    for (const def of defs) effects.apply(target, def.id);
    expect(effects.has(target, 'cosmetic.finish.hollow-ash')).toBe(false);
    expect(effects.has(target, 'cosmetic.finish.ghost-stag')).toBe(true); expect(effects.has(target, 'cosmetic.finish.ironhide')).toBe(true);
    expect(effects.has(target, 'cosmetic.skin.irbis-sabre')).toBe(true); expect(target.attributes['damage']).toBe(12);
  });
  it('E14 uses the exact iron, pitch, broadhead flight/wet/pouch rows', () => {
    expect(AMMO_ROWS.map((row) => [row.id, row.flight, row.wet, row.pouchMax])).toEqual([
      ['ammo.iron', { gravity: 1, drag: 1 }, { gravity: 1.2, drag: 1.9 }, 30],
      ['ammo.pitch', { gravity: 0.8, drag: 0.7 }, undefined, 30],
      ['ammo.broadhead', { gravity: 1.08, drag: 1.1 }, { gravity: 1.2, drag: 1.9 }, 30],
    ]);
    expect(PINE_AMMO_EFFECTS.map((def) => def.id)).toEqual(['effect.ammo.iron', 'effect.ammo.pitch', 'effect.ammo.broadhead']);
  });
  it('blocked grants, base changes, expiry, event boundaries and scope cleanup use one core', () => {
    const def: EffectDef = { id: 'effect.test', kind: 'timed', duration: 1, period: 0.5, tags: [], grants: ['status.test'], modifiers: [{ attr: 'speed', op: 'mul', value: 0.6 }], stacking: 'refresh', blockedBy: ['guard.dodge'] };
    const scope = new Scope('effects'), events = new Events(), ticks: number[] = [], log: string[] = [];
    events.on('effect.applied', ({ id }) => { log.push(id); }, scope); events.on('effect.removed', ({ id }) => { log.push(`removed:${id}`); }, scope);
    const effects = new EffectService([def, ...DRIFTWOOD_EFFECTS], scope, events, () => { ticks.push(1); });
    const target: EffectTarget = { attributes: { speed: 10 } };
    effects.apply(target, 'effect.boar-tusk'); effects.apply(target, def.id); expect(effects.has(target, 'status.test')).toBe(false);
    effects.remove(target, 'effect.boar-tusk'); effects.apply(target, def.id); expect(target.attributes['speed']).toBe(6);
    effects.setBase(target, 'speed', 20); expect(target.attributes['speed']).toBe(12);
    effects.update(3); expect(ticks).toHaveLength(2); expect(target.attributes['speed']).toBe(20);
    events.flush('update'); expect(log).toContain('removed:effect.test');
    effects.apply(target, def.id); scope.dispose(); expect(target.attributes['speed']).toBe(20); expect(target.effectTags).toEqual([]);
    effects.apply(target, def.id); expect(effects.active(target)).toEqual([]);
  });
});
