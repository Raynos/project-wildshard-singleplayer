// SHARD-PLATFORM W2 C2 (look-family rows): the island's creatures (crabs, monkeys, boars, bears, the drowned sailors) as
// graph toon looks (`look.materials`, compiled by the runtime with its other looks, runtime/hybrid.ts; worn through their
// species looks' `material`, runtime/looks/creatureLooks.ts). The Drowned Captain wears its own: its painted coat.
// G466 C2: the graphs are authored graph JSON (data/lookGraphs.json).

/** the look.materials ids: a creature's body, the body whose eye faces glow (`aGlow`, the drowned sailor's) and the
 *  Drowned Captain's painted body */
export const CREATURE_LOOKS = { body: 'driftwood-creature', glowing: 'driftwood-creature-glowing', captain: 'driftwood-creature-captain' } as const;
