// SHARD-PLATFORM W2 C2 (look-family rows): the island's creatures (crabs, monkeys, boars, bears, the drowned sailors) as
// graph toon looks (`look.materials`, compiled by the runtime with its other looks, runtime/hybrid.ts; worn through their
// species looks' `material`, runtime/looks/creatureLooks.ts). The Drowned Captain wears its own: its painted coat.
// SHARD-PLATFORM W2c: the graphs are built only at build time (generators/creatureGraphs.ts → data/lookMaterials.generated.json).

/** the look.materials ids: a creature's body, the body whose eye faces glow (`aGlow`, the drowned sailor's) and the
 *  Drowned Captain's painted body */
export const CREATURE_LOOKS = { body: 'driftwood-creature', glowing: 'driftwood-creature-glowing', captain: 'driftwood-creature-captain' } as const;
