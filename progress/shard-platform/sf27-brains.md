# SF27 — Driftwood families, composed custom scripts and Antler King phase data

SF27 remains open. This receipt covers Driftwood's three ordinary custom decisions, the full native/custom loader boundary and Pine Hollow's Antler King phase table. Other shards' ordinary creatures and browser parity remain open.

## Landed source

- `ae256f8ab`: the existing default-off Driftwood hybrid selects skirmisher (crab), guardian (sailor), and perch-hunter (monkey) from `data/brains.ts`. The ordinary runtime uses the shipping policies. No additional Debug row.
- `15e6861ba`: the shipping monkey's no-palm fallback now initializes `perch = -1`. Previously, finishing a ground bite could steer toward an uninitialized perch and publish NaN motion. Both native and declared policies use the finite ground fallback.
- `8c57eb51e`: the GAME installer preflights identities, declaration contracts and native ports, constructs every policy before registering callbacks, and rolls back registrations on a collision. Native decision cadence defaults to six fixed ticks; one body callback runs per live actor per fixed step. Restore installs fences without thinking or executing body recipes.
- `550120703` (sp-x5): the full format/factory admits and dispatches the three native families plus pursuit. Missing native ports refuse installation.
- `28a3aeb7d` + `b6b97d53e`: one engine host owns the admitted module union, global 60Hz resets and aggregate fuel/effect/event/query/spawn/memory allowances. Trusted disjoint actor roles separate brain fields 1–4 from numeric declared fields; sleeping event reservations persist. sp-x2 reviewed candidate `52ff55279e1befdef102abf9d95b5a8c8bc5bf6a` before landing.
- `aec002e65`: logical migrations still read old contract/world saves and also exactly one explicit `numeric` role. Ambiguous roles refuse; executable memory and brain intentions never become logical fields.
- `1594dcdff` + `ce663a97a`: the GAME helper returns the existing numeric lane facade while scheduling custom brain decisions at each binding's cadence through the same host.
- `7a3a8b777` + `2352f05b4` (sp-x5): full format/factory/client custom brain wiring, host-owned alias handles, module/strike reference validation and trusted recipe injection. No independent brain host multiplies allowances.
- `b6b30d3a1` + `1bc7757c8`: shipping Antler King phase names/thresholds and 4.2/1.4-second intro data feed the existing boss machine. Unique native boss implementation moved from `combat/` to `runtime/`, with unchanged implementation bodies apart from defining-module imports.

## Same-engine evidence

`pnpm exec vitest run test/engine/skirmisher.test.ts test/engine/guardian.test.ts test/engine/perch-hunter.test.ts test/ai/monkey-ground.test.ts test/shards/driftwood-isle/brain-binding.test.ts test/ai/strike-table.test.ts`: **60/60**, six files. Ten real shipping-oracle traces of 10,000 body frames each compare complete actor snapshots, native strike contacts, cues and RNG continuation exactly. The oracle is the production decision function and production body/strike recipe, not a second policy written inside a test.

`pnpm exec vitest run test/shardfile-brain-runtime.test.ts test/shardfile-brains.test.ts test/engine/platform-brain.test.ts`: **25/25**, three files. A mixed pursuit/skirmisher/guardian/perch host restores into a fresh physics world and matches a 10,000-tick suffix exactly. Missing ports, malformed data and callback collisions leave no partial registration. Root TypeScript and scoped typed lint passed at the native dispatcher commit.

## Native G51 recipes retained

Decisions and their tuning moved to platform policies. Driftwood's native rigs and hit recipes, authoritative attack-token claims, sailor rise/sink completion and wreck floor, monkey palm selection/drop/climb/projectile recipe, and shared attack RNG remain injected native ports. The captain remains a unique native boss. These are explicit transition boundaries, not author-selected runtime imports.

Pine's unique Antler King fight and move policy live in `runtime/antlerKing.ts` and `runtime/KingGoals.ts`. Arena hazards, native contact/tell/rig recipes, camera and reward ports remain native; phase metadata and intro lengths are plain data. The move changed imports only; the normalized implementation bodies match the pre-move files byte for byte.

## Custom and phase evidence

`pnpm exec vitest run test/script/composition.test.ts test/script/host.test.ts test/script/lane.test.ts test/script/conformance.test.ts test/engine/script-brain.test.ts`: **46/46**, including one host across 4/6/10-tick schedules, aggregate admission/execution ceilings, retained sleepers, native enqueue after tick start, trusted parameter self, cross-role refusal, atomic restore and an exact 10,000-tick real-motor suffix. This is Node conformance; WebKit remains the serialized gate's check.

`pnpm exec vitest run test/shardfile-script-composition.test.ts test/shardfile-logical-state.test.ts test/script/lane.test.ts`: **12/12**, including the GAME facade's exact 10,000-tick actor/physics/script continuation and legacy/composed logical-field migration. sp-x5 reports **104/104** full format/factory fixtures plus **14/14** client/factory checks.

`pnpm exec vitest run test/shards/pine-hollow/antler-phase-data.test.ts test/shards/pine-hollow/pine-combat.test.ts test/ai/boss-phases.test.ts test/ai/boss-strikes.test.ts test/combat/wall-characterization.test.ts test/combat/vulnerability-rules.test.ts`: **121/121** after the native move. The phase fixture records the actual pre-change production table with its source SHA; two 10,000-tick real `BossBrain` runs prove phase clamping, deaths/checkpoints, victory, reward-once and restoration without replaying native actions. Root TypeScript passed at the phase extraction; scoped typed lint passed for the complete move and callers.

## Remaining row work

- Driftwood and Pine browser parity receipts below are green. SF27 frame floors and the remaining shard bindings stay open; earlier SF24/SF30 floors do not prove the new SF27 policies.
- Nalati's herd/pack/flock, balbal and ghost decisions; Far Reach's ordinary creatures; Signal Dunes' ordinary creatures; remaining shared archetype bindings still need conversion/proof. A native `CreatureBrain` subclass alone is not an admitted data/AS policy.

Driftwood parent `a8d705c3c` → `026e11aaf`: OFF/ON × phone/desktop **4/4 green**; 12 images, min SSIM 0.9900959657 (all desktop images 1), walk 0 stuck, unload no errors. Device hybrid keys and mover-system absence/presence witnessed. Full receipt: `sf27-driftwood-026e11aaf.json`. Phone tier here is emulated Chromium on Metal; this is not a Safari frame-floor receipt.

Pine phase/move parent `e22054602` → `557881a29`: **4/4 green**, 12 images, min SSIM 0.9995779459, walk 0 stuck, boot/unload no errors. Pine has no hybrid brain variant: OFF/ON fixtures here set the Driftwood-only device key and repeat the same ungated Pine code path. Full receipt: `sf27-pine-557881a29.json`. This complements the real boss-table replay; Chromium phone emulation is not a Safari floor.
