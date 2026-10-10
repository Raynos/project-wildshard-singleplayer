// Pine Hollow's baked log buildings, how they dress and band (SHARD-PLATFORM M3, the props system's baked buildings:
// @wildshard/sdk/props/bakedBuilding; world/cabinBake.ts assembles every building of the bake with it).
import type { BakedBuildingLook } from '@wildshard/sdk/props/bakedBuilding';

/**
 * The log buildings' look: the small kit parts drawn only within the tier's detail distance (strap iron, cloth, char,
 * chinking) and the merged ones within twice it (log ends, woodpile bark, the door frame); the plank door (leaf, strap
 * hinges, battens; its prompt within 2.4 m); the mill wheel's beams; the porch lantern (the glTF lantern copy hung 0.46 m
 * under its pivot at 1.35×, its iron ring 3 cm down, its glass warm amber lit by the clock, its frame brass); every
 * hearth particle cloud's bounds; each deck counted 0.3 m below and 4.5 m above in a building's box.
 */
export const CABIN_BUILD = {
  detail: ['iron', 'cloth', 'char', 'chink'],
  far: ['endGrain', 'bark', 'door'],
  door: { leaf: 'door', hinges: 'iron', battens: 'beam', reach: 2.4, open: 'Open door', close: 'Close door' },
  wheel: 'beam',
  lantern: {
    ring: 'iron', ringY: -0.03, drop: -0.46, scale: 1.35, glassName: 'glass',
    glass: { color: 0xffd9a0, emissive: [1.0, 0.72, 0.4], emissiveIntensity: 3.0, roughness: 0.2, metalness: 0, opacity: 0.85 },
    frame: { metalness: 0.9, roughness: 1, color: 0xd8b070 },
  },
  particles: { center: [0, 5, 0], radius: 18 },
  deck: [0.3, 4.5],
} as const satisfies BakedBuildingLook;
