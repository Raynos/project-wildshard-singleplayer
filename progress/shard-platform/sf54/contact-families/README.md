# SF54 contact-family graduation — E435

Source commits: `423512790` (parallel engine/SDK families and fixed legacy traces), `0243be4a8`
(kit delegation), `fdda55dcf` (row-data scanner follows relocated defining profiles).

- Engine `combat/Melee` owns contact envelopes, damage arithmetic and the native/practice target cache.
  Its combat pipeline is an explicit constructor dependency, so it adds no app/runtime simulation dependency.
  The kit's compatibility constructor supplies the existing `app.combat`; existing subclasses keep their constructors.
- Engine `combat/Thrown` owns the original flight integration and decrement-before-release hook.
  Both SDK and kit expose that exact constructor. SDK Melee exposes the exact engine constructor.
- Numeric profile declarations are defined in engine `combat/{meleeProfile,thrownProfile}` and exposed through
  defining SDK type modules. Six moved declarations are byte-identical; hashes are in `body-hashes.json`.
- The independent kit implementation was still present when the snapshots in
  `test/combat/__snapshots__/sdk-contact-families.test.ts.snap` were captured in `423512790`.
  Delegation compares against those fixed traces; they were not regenerated after kit delegation.

Validation:

| Check | Result |
| --- | --- |
| Parallel contact, replacement and damage fixtures | 21/21 passed |
| `pnpm exec vitest run test/combat test/actor/sword-combo.test.ts` after delegation | 373/373, 30 files |
| Scoped typed oxlint for all new source and modified fixtures | Passed |
| `node scripts/shard-coupling.mjs --check` | Passed; no allowance growth |
| `node scripts/check-row-data.mjs --check` | Exactly 83 legacy function fields, none new or stale |
| `pnpm exec vitest run test/row-data.test.ts` | 7/7 passed |
| Private-index / pathspec source hooks | Passed |

SDK → engine +4 defining imports were approved by wildshard-new. Geometry is untouched by these commits.
Shared-tree root typecheck at verification time was blocked only by the unrelated
`test/shardfile-graph-runtime.test.ts` missing `GraphCompiler.attachOutline`, reported to its owner.
The coordinator owns generated outputs, the clean gate and serialized push. Browser parity and floors,
full SweptMelee/Bow family graduation and the remaining kit dissolution stay open in SF54.
