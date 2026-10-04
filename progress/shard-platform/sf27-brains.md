# SF27 — Driftwood native family slice

SF27 remains open. This receipt covers Driftwood's three ordinary custom decisions and the native-family loader boundary, not every shard's creatures or Pine Hollow's Antler King.

## Landed source

- `ae256f8ab`: the existing default-off Driftwood hybrid selects skirmisher (crab), guardian (sailor), and perch-hunter (monkey) from `data/brains.ts`. The ordinary runtime uses the shipping policies. No additional Debug row.
- `15e6861ba`: the shipping monkey's no-palm fallback now initializes `perch = -1`. Previously, finishing a ground bite could steer toward an uninitialized perch and publish NaN motion. Both native and declared policies use the finite ground fallback.
- `8c57eb51e`: the GAME installer preflights identities, declaration contracts and native ports, constructs every policy before registering callbacks, and rolls back registrations on a collision. Native decision cadence defaults to six fixed ticks; one body callback runs per live actor per fixed step. Restore installs fences without thinking or executing body recipes.
- `550120703` (sp-x5): the full format/factory admits and dispatches the three native families plus pursuit. Missing native ports and custom script kinds remain refused before installation.

## Same-engine evidence

`pnpm exec vitest run test/engine/skirmisher.test.ts test/engine/guardian.test.ts test/engine/perch-hunter.test.ts test/ai/monkey-ground.test.ts test/shards/driftwood-isle/brain-binding.test.ts test/ai/strike-table.test.ts`: **60/60**, six files. Ten real shipping-oracle traces of 10,000 body frames each compare complete actor snapshots, native strike contacts, cues and RNG continuation exactly. The oracle is the production decision function and production body/strike recipe, not a second policy written inside a test.

`pnpm exec vitest run test/shardfile-brain-runtime.test.ts test/shardfile-brains.test.ts test/engine/platform-brain.test.ts`: **25/25**, three files. A mixed pursuit/skirmisher/guardian/perch host restores into a fresh physics world and matches a 10,000-tick suffix exactly. Missing ports, malformed data and callback collisions leave no partial registration. Root TypeScript and scoped typed lint passed at the native dispatcher commit.

## Native G51 recipes retained

Decisions and their tuning moved to platform policies. Driftwood's native rigs and hit recipes, authoritative attack-token claims, sailor rise/sink completion and wreck floor, monkey palm selection/drop/climb/projectile recipe, and shared attack RNG remain injected native ports. The captain remains a unique native boss. These are explicit transition boundaries, not author-selected runtime imports.

## Remaining row work

- The standalone custom AS helper is admitted and tested, but a live level must not combine its independent host with the numeric script lane. The approved one-host role composition is under sp-x2 review; custom brains remain refused by the full format until that composition and loader admission land.
- Driftwood parent/current parity with the hybrid OFF and ON on both surfaces awaits the coordinator's pushed pin. Earlier SF24/SF30 floors do not prove the new SF27 policies.
- Nalati's herd/pack/flock, balbal and ghost decisions; Far Reach's ordinary creatures; Signal Dunes' ordinary creatures; remaining shared archetype bindings; and Pine Hollow's Antler King phase data still need conversion/proof. A native `CreatureBrain` subclass alone is not an admitted data/AS policy.
