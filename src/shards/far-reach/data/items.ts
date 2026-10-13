import { SKY_MELEE_HOST } from './nativeMelee';
import type { ConeWeaponProfile } from '@wildshard/format/weaponProfiles';
import { STRINGS } from './strings';
import { FAN_CONTACTS } from './fanContacts';
import { FAN_GUST_MODULE } from './fanGustModule';

/** The declared fan row's id: every contact names it as its weapon. */
export const FAN_ID = 'weapon.far-reach.fan';
/** The war fan's shipping numbers: the SWING / HEAVY arc (its contact cone reaches a metre past `reach`) and the GUST cone. */
export const FAN_SWING = { reach: 3.4, halfAngle: 0.9, light: 16, heavy: 30, cooldown: 0.45, heavyCooldown: 0.85 };
export const FAN_GUST = { reach: 9, halfAngle: 0.6, push: 15, lift: 4, damage: 4, cooldown: 1.6 };
/** The war fan's strikes on the platform's cone fan (SHARD-PLATFORM M3): the browser fan and the renderer-free host run them. */
export const FAN_STRIKES = { weaponId: FAN_ID,
  slash: { ...FAN_SWING, reach: FAN_SWING.reach + 1, tags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], moves: { light: 'far.fan.light', heavy: 'far.fan.heavy' } },
  gust: { ...FAN_GUST, tags: ['actor.player', 'weapon.far-fan', 'dmg.wind'], move: 'far.fan.gust' } } as const;
/** Admitted cone numbers consumed by the existing page and native fan owners. */
export const FAN_PROFILE = { family: 'cone', slash: { reachAllowance: 1 },
  gust: { ...FAN_STRIKES.gust, tags: [...FAN_STRIKES.gust.tags] } } satisfies ConeWeaponProfile;
export const SKY_ITEMS = { version: 1, rows: [{
  id: 'weapon.far-reach.fan', kind: 'weapon', family: 'far-reach.fan', slot: 'declared.weapon.far-reach.fan', context: 'far.fan',
  ui: { name: STRINGS.fan, icon: 'sword', swapIcon: '◠', blurb: STRINGS.fanBlurb },
  profile: FAN_PROFILE, native: SKY_MELEE_HOST, view: { recipe: 'far-reach.fan', colour: '#dfece6', position: [0, 0, 0], rotation: [0, 0, 0] }, contacts: FAN_CONTACTS, secondary: { action: 'far.gust', code: 3, move: 2 },
  hook: { module: FAN_GUST_MODULE.hash, entity: 6001, event: 301 },
  light: { id: 'far.fan.light', damage: FAN_SWING.light, cooldown: FAN_SWING.cooldown, range: FAN_SWING.reach, width: FAN_SWING.halfAngle,
    tags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], effect: null },
  heavy: { id: 'far.fan.heavy', damage: FAN_SWING.heavy, cooldown: FAN_SWING.heavyCooldown, range: FAN_SWING.reach, width: FAN_SWING.halfAngle,
    tags: ['actor.player', 'weapon.far-fan', 'dmg.melee'], effect: null }, charge: 0.6,
}], contexts: [], runtimeContexts: ['far.fan'], loadout: { primary: 'weapon.far-reach.fan', secondary: null, tools: [] } } as const;
