import type { ConeStrikeSpec } from '@wildshard/sdk/items/coneStrikes';
import { STRINGS } from './strings';

/** The declared fan row's id: every contact names it as its weapon. */
export const FAN_ID = 'weapon.far-reach.fan';
/** The war fan's shipping numbers: the SWING / HEAVY arc (its contact cone reaches a metre past `reach`) and the GUST cone. */
export const FAN_SWING = { reach: 3.4, halfAngle: 0.9, light: 16, heavy: 30, cooldown: 0.45, heavyCooldown: 0.85 };
export const FAN_GUST = { reach: 9, halfAngle: 0.6, push: 15, lift: 4, damage: 4, cooldown: 1.6 };
/** The war fan's strikes on the platform's cone fan (SHARD-PLATFORM M3): the browser fan and the renderer-free host run them. */
export const FAN_STRIKES: ConeStrikeSpec = { weaponId: FAN_ID,
  slash: { ...FAN_SWING, reach: FAN_SWING.reach + 1, tags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], moves: { light: 'far.fan.light', heavy: 'far.fan.heavy' } },
  gust: { ...FAN_GUST, tags: ['actor.player', 'weapon.far-fan', 'dmg.wind'], move: 'far.fan.gust' } };
export const SKY_ITEMS = { version: 1, rows: [{
  id: 'weapon.far-reach.fan', kind: 'weapon', family: 'far-reach.fan', slot: 'declared.weapon.far-reach.fan', context: 'far.fan',
  ui: { name: STRINGS.fan, icon: 'sword', swapIcon: '◠', blurb: STRINGS.fanBlurb },
  view: { recipe: 'far-reach.fan', colour: '#dfece6', position: [0, 0, 0], rotation: [0, 0, 0] }, hook: null,
  light: { id: 'far.fan.light', damage: FAN_SWING.light, cooldown: FAN_SWING.cooldown, range: FAN_SWING.reach, width: FAN_SWING.halfAngle,
    tags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], effect: null },
  heavy: { id: 'far.fan.heavy', damage: FAN_SWING.heavy, cooldown: FAN_SWING.heavyCooldown, range: FAN_SWING.reach, width: FAN_SWING.halfAngle,
    tags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], effect: null }, charge: 0.6,
}], contexts: [], runtimeContexts: ['far.fan'], loadout: { primary: 'weapon.far-reach.fan', secondary: null, tools: [] } };
