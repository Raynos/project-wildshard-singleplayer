import { WEAPON_FINISHES } from './weaponFinishes';

/** Authored GEAR order and source wording; the shared locker supplies live locked/worn state. */
export const FINISH_CARDS: readonly [{ readonly id: "hollow-ash"; readonly name: "Hollow Ash"; readonly blurb: "Crossbow"; readonly lockedBlurb: "Crossbow · Mott's stall"; readonly icon: "crossbow"; }, { readonly id: "ghost-stag"; readonly name: "Ghost Stag"; readonly blurb: "Crossbow"; readonly lockedBlurb: "Crossbow · The Ghost Stag"; readonly icon: "crossbow"; }, { readonly id: "blackpaw"; readonly name: "Blackpaw"; readonly blurb: "Crossbow"; readonly lockedBlurb: "Crossbow · Old Blackpaw"; readonly icon: "crossbow"; }, { readonly id: "imperial"; readonly name: "Imperial"; readonly blurb: "Crossbow"; readonly lockedBlurb: "Crossbow · The Imperial Bull"; readonly icon: "crossbow"; }, { readonly id: "warden"; readonly name: "Warden"; readonly blurb: "Crossbow"; readonly lockedBlurb: "Crossbow · The Antler King"; readonly icon: "crossbow"; }, { readonly id: "ironhide"; readonly name: "Ironhide"; readonly blurb: "Lever-action"; readonly lockedBlurb: "Lever-action · Old Ironhide"; readonly icon: "lever"; }, { readonly id: "scarback-furnace"; readonly name: "Scarback Furnace"; readonly blurb: "Lever-action"; readonly lockedBlurb: "Lever-action · Mott's stall"; readonly icon: "lever"; }] = [
  { id: 'hollow-ash', name: WEAPON_FINISHES['hollow-ash'].name, blurb: 'Crossbow', lockedBlurb: "Crossbow · Mott's stall", icon: 'crossbow' },
  { id: 'ghost-stag', name: WEAPON_FINISHES['ghost-stag'].name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Ghost Stag', icon: 'crossbow' },
  { id: 'blackpaw', name: WEAPON_FINISHES.blackpaw.name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · Old Blackpaw', icon: 'crossbow' },
  { id: 'imperial', name: WEAPON_FINISHES.imperial.name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Imperial Bull', icon: 'crossbow' },
  { id: 'warden', name: WEAPON_FINISHES.warden.name, blurb: 'Crossbow', lockedBlurb: 'Crossbow · The Antler King', icon: 'crossbow' },
  { id: 'ironhide', name: WEAPON_FINISHES.ironhide.name, blurb: 'Lever-action', lockedBlurb: 'Lever-action · Old Ironhide', icon: 'lever' },
  { id: 'scarback-furnace', name: WEAPON_FINISHES['scarback-furnace'].name, blurb: 'Lever-action', lockedBlurb: "Lever-action · Mott's stall", icon: 'lever' },
] as const;
