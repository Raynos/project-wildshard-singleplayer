import { WEAPON_FINISHES } from './weaponFinishes';

/** Authored GEAR order and source wording; the shared locker supplies live locked/worn state. */
export const FINISH_CARDS = [
  { id: 'hollow-ash', name: WEAPON_FINISHES['hollow-ash'].name, blurb: 'Crossbow', lockedBlurb: "Crossbow · Mott's stall", icon: 'crossbow' },
  { id: 'ghost-stag', name: WEAPON_FINISHES['ghost-stag'].name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Ghost Stag', icon: 'crossbow' },
  { id: 'blackpaw', name: WEAPON_FINISHES.blackpaw.name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · Old Blackpaw', icon: 'crossbow' },
  { id: 'imperial', name: WEAPON_FINISHES.imperial.name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Imperial Bull', icon: 'crossbow' },
  { id: 'warden', name: WEAPON_FINISHES.warden.name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Antler King', icon: 'crossbow' },
  { id: 'ironhide', name: WEAPON_FINISHES.ironhide.name, blurb: 'Lever-action', lockedBlurb: 'Lever-action · Old Ironhide', icon: 'lever' },
  { id: 'scarback-furnace', name: WEAPON_FINISHES['scarback-furnace'].name, blurb: 'Lever-action', lockedBlurb: "Lever-action · Mott's stall", icon: 'lever' },
] as const;
