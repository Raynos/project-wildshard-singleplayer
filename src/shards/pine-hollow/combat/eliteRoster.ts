import type { EliteDef } from '@wildshard/game/Elite';
import type { ItemId } from '@wildshard/game/Inventory';
import { DEN } from '../layout';

/**
 * Pine Hollow's four named elites as data (PH-C3): their lairs, encounter rows, species identities and the boot swap that
 * keeps one of each. View-free (SF72): the browser's scripts (elites.ts) and the renderer-free runtime read this one module.
 */

// the lairs (x = WEST, z = NORTH: pineHollowLayout.ts's axis note). Chosen on open ground off the trails, one per zone.
export const IRONHIDE_LAIR = { x: -44, z: -76, r: 16 };
export const GHOST_LAIR = { x: 62, z: -100, r: 22 };   // > 110 m from the King's clearing: its bar must never ride into his fight
export const IMPERIAL_LAIR = { x: -40, z: 78, r: 20 };
export const BLACKPAW_LAIR = { x: DEN.x + 2, z: DEN.z + 2, r: 20 };

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

/** A herd body as the boot swap reads it: the browser's Animal and a renderer-free host's body both satisfy it. */
export interface SwapBody { readonly kind: string; readonly variant: string; herd: number; readonly position: { readonly x: number; readonly z: number }; readonly yaw: number }
/** The creature manager the swap works through: its bodies and herds, its retire and its spawn (the shared stream's draws). */
export interface SwapPorts<A extends SwapBody> {
  readonly bodies: readonly A[];
  readonly herds: readonly { readonly members: A[] }[];
  retire: (a: A) => void;
  spawn: (kind: string, x: number, z: number, yaw: number, variants: string[]) => A;
}

/** one of the elites' identities (kind + variant) */
export function isEliteVariant(kind: string, variant: string): boolean {
  return Object.values(PINE_ELITE_ANIMALS).some((e) => e.kind === kind && e.variant === variant);
}

/** every herd animal that rolled an elite's variant is replaced by an ordinary one of its kind, in its herd, where it stood */
export function swapRolledElites<A extends SwapBody>(ports: SwapPorts<A>): number {
  let n = 0;
  const rolled = ports.bodies.filter((a) => isEliteVariant(a.kind, a.variant));
  for (const a of rolled) {
    const herd = a.herd, x = a.position.x, z = a.position.z, yaw = a.yaw;
    ports.retire(a);
    const b = ports.spawn(a.kind, x, z, yaw, ORDINARY[a.kind] ?? []);
    b.herd = herd;
    const h = herd >= 0 ? ports.herds[herd] : undefined;
    if (h) { const i = h.members.indexOf(a); if (i !== -1) h.members[i] = b; else h.members.push(b); }
    n++;
  }
  return n;
}
