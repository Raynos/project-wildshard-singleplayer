import type { EliteDef } from '@wildshard/game/Elite';
import type { ItemId } from '@wildshard/game/Inventory';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { GHOST_LAIR } from '../data/eliteHomes';

/**
 * Pine Hollow's four named elites as data (PH-C3): their lairs, encounter rows, species identities and the boot swap that
 * keeps one of each. View-free (SF72): the browser's scripts (elites.ts) and the renderer-free runtime read this one module.
 */

// the lairs (x = WEST, z = NORTH: pineHollowLayout.ts's axis note). Chosen on open ground off the trails, one per zone.
export const IRONHIDE_LAIR = { x: -44, z: -76, r: 16 };
export const IMPERIAL_LAIR = { x: -40, z: 78, r: 20 };
export const BLACKPAW_LAIR = { x: LAYOUT.DEN.x + 2, z: LAYOUT.DEN.z + 2, r: 20 };

export const PINE_ELITE_DEFS: Record<string, EliteDef> = {
  ironhide: {
    id: 'ironhide', name: 'Old Ironhide', epithet: 'Terror of the Hollow', lair: IRONHIDE_LAIR,
    awareR: 55, engageR: 32, leashR: 85, rule: 'always', respawnMin: 20, signature: 'GORE CHARGE', phase2: 'BOTH TUSKS NOW',
    drop: { skin: 'ironhide', skinName: 'IRONHIDE', weapon: 'rifle', blurb: 'scarred iron plates, a boar-tusk grip, still warm from the forge', trophyName: "Ironhide's broken tusk" },
  },
  'ghost-stag': {
    id: 'ghost-stag', name: 'The Ghost Stag', epithet: 'The Pale One', lair: GHOST_LAIR,
    awareR: 70, engageR: 40, leashR: 110, rule: 'always', respawnMin: 20, signature: 'FADE', phase2: "NOW YOU DON'T",
    drop: { skin: 'ghost-stag', skinName: 'GHOST STAG', weapon: 'crossbow', blurb: "bone-white ash, the stag's own antlers for a prod", trophyName: 'A pale antler that weighs nothing' },
  },
  blackpaw: {
    id: 'blackpaw', name: 'Old Blackpaw', epithet: "The Den's Landlord", lair: BLACKPAW_LAIR,
    awareR: 30, engageR: 22, leashR: 60, rule: 'always', respawnMin: 20, signature: 'ROAR', phase2: 'WOKEN UP PROPERLY',
    drop: { skin: 'blackpaw', skinName: 'BLACKPAW', weapon: 'crossbow', blurb: 'bear-black stock, claw-hook nocks, the rent in arrears', trophyName: "Old Blackpaw's claw" },
  },
  'imperial-bull': {
    id: 'imperial-bull', name: 'The Imperial Bull', epithet: 'Seven by Seven', lair: IMPERIAL_LAIR,
    awareR: 75, engageR: 45, leashR: 110, rule: 'always', respawnMin: 20, signature: 'BUGLE', phase2: 'FULL VOLUME',
    drop: { skin: 'imperial', skinName: 'IMPERIAL', weapon: 'crossbow', blurb: 'antler-ivory stock, gold fittings, seven tines on the prod', trophyName: 'The seven-tine crown' },
  },
};

/** each elite's species variant (its identity) and its trophy */
export const PINE_ELITE_ANIMALS: Record<string, { kind: string; variant: string; trophy: ItemId }> = {
  ironhide: { kind: 'boar', variant: 'ironhide', trophy: 'ironhide-tusk' },
  'ghost-stag': { kind: 'deer', variant: 'ghost', trophy: 'ghost-antler' },
  blackpaw: { kind: 'bear', variant: 'black-old', trophy: 'blackpaw-claw' },
  'imperial-bull': { kind: 'elk', variant: 'imperial', trophy: 'imperial-crown' },
};

/** an ordinary variant of the same kind, for a herd animal that rolled an elite's variant at boot */
export const ORDINARY: Record<string, string[]> = { boar: ['boar', 'sow', 'black'], deer: ['hind', 'stag'], bear: ['black', 'black-blaze'], elk: ['cow', 'bull'] };

