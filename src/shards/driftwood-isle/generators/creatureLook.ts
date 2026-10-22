// SHARD-PLATFORM W2 C2 (look-family rows): the island's creatures (crabs, monkeys, boars, bears, the drowned sailors) as
// graph toon looks (`look.materials`, compiled by the runtime with its other looks, runtime/hybrid.ts; worn through their
// species looks' `material`, `actors/creature-install.json` below). The Drowned Captain wears its own: its painted coat.
// G466 C2: the graphs are authored graph JSON (data/lookGraphs.json).

/** the look.materials ids: a creature's body, the body whose eye faces glow (`aGlow`, the drowned sailor's) and the
 *  Drowned Captain's painted body */
export const CREATURE_LOOKS = { body: 'driftwood-creature', glowing: 'driftwood-creature-glowing', captain: 'driftwood-creature-captain' } as const;

/** `actors/creature-install.json` (@wildshard/game/population/productCreatures): the monkey's perch poses, the practice
 *  spawn, the packed look kinds then the hull-book boar and bear, each on its lent body (the captain on his own). */
export const CREATURE_INSTALL = { perch: 'poses/monkey.json', practice: 'spawn.driftwood.practice', projection: 'actors/projection.json',
  packed: { file: 'look/creature-looks.json', kinds: ['crab', 'monkey', 'sailor', 'captain'] }, hulls: ['boar', 'bear'],
  lent: { body: CREATURE_LOOKS.body, glowing: CREATURE_LOOKS.glowing, kinds: { captain: CREATURE_LOOKS.captain } } };
