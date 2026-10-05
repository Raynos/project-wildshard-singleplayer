import { CROSSBOW_PROFILE } from '../../src/shards/pine-hollow/weapons/crossbow/profiles';
import { AR15 } from '../../src/shards/nalati-grasslands/data/firearmProfile';
import { LEVER_PROFILE, LeverRifle } from '../../src/shards/pine-hollow/runtime/weapons/LeverRifle';
import { Thrown } from '../../src/kit/weapons/thrown/Thrown';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { damageFor } from '../../src/engine/entities/AnimalView';
import { speciesDef } from '../../src/engine/entities/species/registry';
import { balbalCombat } from '../../src/shards/nalati-grasslands/species/balbal';
import { Projectiles } from '../../src/engine/combat/view/projectile';
import { Crossbow } from '../../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';
import type { TargetHit } from '../../src/engine/combat/types';
import { Bow } from '../../src/kit/weapons/bow/family';
import { Rifle } from '../../src/shards/nalati-grasslands/runtime/weapons/Rifle';

import { Spear, JAVELIN, SPEAR_PROFILE } from '../../src/shards/nalati-grasslands/weapons/Spear';
import { GoldenBowPower } from '../../src/shards/nalati-grasslands/weapons/GoldenBow';
import { boltDamage } from '../../src/shards/pine-hollow/loadout/ammo';
import { app } from '../../src/engine/app/runtime';
import { setSetting } from '../../src/engine/ui/Settings';
import { setActivePhysics } from '../../src/engine/physics/active';
import { fakeWorld } from '../fake/world';
import { damageTarget, invokeLegacy, legacyActor } from '../fake/legacyActor';

type Source = 'bow' | 'longbow' | 'golden' | 'sun' | 'iron' | 'broadhead' | 'javelin' | 'pierce' | 'rifle' | 'lever';
type Rule = 'plain' | 'ironhide' | 'crab-front' | 'balbal-ranged' | 'balbal-open' | 'balbal-buried';
const sources: readonly Source[] = ['bow', 'longbow', 'golden', 'sun', 'iron', 'broadhead', 'javelin', 'pierce', 'rifle', 'lever'];
const rules: readonly Rule[] = ['plain', 'ironhide', 'crab-front', 'balbal-ranged', 'balbal-open', 'balbal-buried'];
const noop = (): void => undefined;
function dealt(source: Source, rule: Rule, headshot: boolean, distance: number, sneak: boolean): number {
  app.rng.seed(357); setActivePhysics(null); setSetting('tracers', false);
  const f = fakeWorld(), target = damageTarget({ kind: rule.startsWith('balbal') ? 'balbal' : rule === 'crab-front' ? 'crab' : 'boar', bodyMul: rule === 'ironhide' ? 0.6 : 1 });
  target.animal.position.z = -distance; target.head.z = target.body.z = -distance;
  target.animal.damageFor = damageFor;
  Reflect.set(target.animal, 'mem', { field: rule === 'balbal-buried' ? 1 : 0, rise: 0.5, open: rule === 'balbal-open' ? 1 : 0 });
  const model: object = Reflect.get(target.animal, 'model') as object;
  const sp: object = Reflect.get(model, 'species') as object;
  const species = rule.startsWith('balbal') ? speciesDef('balbal') : rule === 'crab-front' ? speciesDef('crab') : null;
  if (species !== null) Reflect.set(sp, 'damageMul', species.damageMul);
  const point = headshot ? target.head : target.body;
  const hit: TargetHit = { animal: target.animal, point, distance, headshot };
  const raycast = () => hit;
  if (source === 'bow' || source === 'longbow' || source === 'golden' || source === 'sun') {
    const bow = legacyActor(Bow.prototype, { row: { id: 'weapon.bow', ui: { name: 'Bow' }, meta: { name: 'Bow' } },
      drawSpeedScale: 1, onLoose: undefined, damageMultiplier: () => sneak ? 2 : 1 });
    if (source === 'golden' || source === 'sun') {
      const upgrade = legacyActor(GoldenBowPower.prototype, { bow: null, recolour: noop, sunShot: source === 'sun' }); upgrade.apply(bow);
    }
    const pool = legacyActor(Projectiles.prototype, { kind: {}, onTargetHit: undefined, targets: { raycast }, onHit: undefined, stop: noop });
    invokeLegacy(pool, 'testHit', { pos: new THREE.Vector3(0, 1, -1), origin: new THREE.Vector3(),
      scale: source === 'longbow' ? 1.35 : 1.2, hitScale: bow.damageMultiplier }, new THREE.Vector3(0, 1, 0));
  } else if (source === 'iron' || source === 'broadhead') {
    const bolt = legacyActor(Crossbow.prototype, { onBoltHit: () => undefined, profile: CROSSBOW_PROFILE, player: f.player, targets: { raycast }, game: f.game.asGame(), onHit: undefined, stopBolt: noop });
    invokeLegacy(bolt, 'testHit', { pos: new THREE.Vector3(0, 1, -1), mod: { damage: (kind: string) => boltDamage(source, kind) } }, new THREE.Vector3(0, 1, 0));
  } else if (source === 'javelin') {
    const jav = { state: 1, age: 0, pos: new THREE.Vector3(0, 1, -1), vel: new THREE.Vector3(0, 0, -55) };
    const spear = legacyActor(Spear.prototype, { profile: SPEAR_PROFILE, thrown: new Thrown(JAVELIN), player: f.player, targets: { raycast }, javs: [jav], damageMultiplier: () => sneak ? 2 : 1,
      onHit: undefined, onImpact: undefined, drop: (): void => { jav.state = 0; }, world: { count: 0 }, });
    // Visual-only stagger is explicitly suppressed; damage still executes real Animal.applyDamage.
    Reflect.set(target.animal, 'stagger', noop); invokeLegacy(spear, 'flyJavelins', 1 / 60);
  } else if (source === 'pierce') {
    const golden = legacyActor(GoldenBowPower.prototype, { streakT: 0, pending: [{ t: 0, target: target.animal, point, dir: new THREE.Vector3(0, 0, -1), dmg: 37 }] });
    golden.update(1 / 60);
  } else {
    const weapon = legacyActor(source === 'rifle' ? Rifle.prototype : LeverRifle.prototype, { profile: source === 'rifle' ? AR15 : LEVER_PROFILE, game: f.game.asGame(), player: f.player,
      adsBlend: 0, bloom: 0, targets: { raycast }, onHit: undefined, onImpact: undefined, puffs: { emit: noop } });
    invokeLegacy(weapon, 'hitscan');
  }
  if (target.dealt.length !== 1) throw new Error(`${source}/${rule}: expected one damage application`);
  return target.dealt[0] ?? 0;
}
describe('frozen actual damage across source × head/body × multipliers × species/variant × distance', () => {
  it.each(sources)('%s retains exact amounts and rounding', (source) => {
    const oldMelee = balbalCombat.melee; balbalCombat.melee = 'sabre';
    try {
      const table: Record<string, number> = {};
      for (const rule of rules) for (const head of [false, true]) for (const distance of [20, 60, 100]) {
        const multiplies = ['bow', 'longbow', 'golden', 'sun', 'javelin'].includes(source);
        for (const sneak of multiplies ? [false, true] : [false]) table[`${rule}/${head ? 'head' : 'body'}/${distance}m/${sneak ? 'sneak' : 'plain'}`] = dealt(source, rule, head, distance, sneak);
      }
      expect(table).toMatchSnapshot();
    } finally { balbalCombat.melee = oldMelee; }
  });
});
