# SF54 swept contact family

The independent kit `Sword` and the parallel engine `SweptMelee` match across 600 frames in each of 14 cases:
portrait and landscape; wooden and iron blades; shell, timber and general creature reactions; and supplied custom
move objects whose identities differ from the starter moves. The SDK facade exposes the exact engine constructor.

The trace records every scene object transform and visibility, every dynamic geometry attribute (trail and hit
particles), camera FOV, charge/combo state, damage arguments and tick, hit-stop durations, event hooks and debris
arguments. The original snapshots were captured before kit delegation and remain fixed afterwards.

`body-hashes.json` records the unchanged particle/glint classes and all 36 methods/accessors. Differences are limited
to explicit event/default ports, the supplied creature-debris classifier and a generic missing-rig diagnostic.
Constructor options receive the profile and input context. The kit retains starter move/profile constants and the
original shell/timber/sand classifier; the engine owns no model builder or creature-kind policy.

Validation: `pnpm exec vitest run test/combat/sdk-swept-family.test.ts` (5 tests, 14 cases, 8,400 frames per family),
root strict TypeScript and scoped typed oxlint. The `sword-nohit` parity fault moves to the executing engine family
when the kit delegates, preserving its coverage.

After delegation, the broader combat suite and existing sword combo, bow draw, longbow charge and row-data checks
pass 400/400 tests across 35 files. The fixed original snapshots are unchanged. The replacement fixture now checks
the defining engine Melee ancestry. `git apply --check test/parity/plants/sword-nohit.patch` passes against the new
executing-family path.

This is a family extraction receipt, not completion of the entire SF54 kit dissolution row. Browser parity and the
frame floor remain assigned to the coordinator's later window.
