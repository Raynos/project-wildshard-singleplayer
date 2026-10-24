# D1: modern runtime entry removal

2026-10-24, sp-x6. Wave 1 only; frozen legacy source is unchanged.

Modern manifest intake refuses `runtimeEntry`. The current-manifest trusted
lookup/registration and `declaredRuntimeEntry` / `nativePlan` phase selection
are gone. Regional and standalone modern pages use their compiled phases.

Source landings: `8f2bfe7dd4`, `22a21f4b0c`, `b4e97c9dd4`, `a93d18458b`,
`7ea4f38e35`, `b6a52eb0cc`, `5c356a3c6d`, `17dddf9b3e`; manual note
`85f80d8f7a`. Source contracts retain compiled home/owner authority and held
phase/refusal behavior. Focused batches, layer/root types and named typed lint
passed; bounded CF1 related attempts that exhausted 60 seconds explicitly
handed remaining suites to CI.

## Held for LD, wave 3

`prepareHybridShard`, `TrustedRuntimeEntry`, `prepareTrustedRuntime`, the
legacy-supplied trusted loaders/composite and shared client hooks remain.
The LEGACY entry, buttons, schemas and all frozen imports remain. A grep for
these shared helpers is intentionally nonempty. No legacy deletion is claimed.

## Compatibility repairs found by the required LEGACY smoke

The old compatibility adapter broke at `7719bbb5c4` (2026-10-18). Repairs keep
the modern material schema and defining shader math unchanged:

- `205c46fdd7`: accept a finite nonnegative adapter shade, compile its bounded
  base and restore the exact uniform. Legacy Nalati's bow retains shade 2.4.
- `5a9829d545`: restore the fragment `uPSunDir` alias to the original live
  painterly uniform handle.
- `e636720cc9`: restore the vertex `uPTime` alias to the original live clock.
- `6e04eccd4a`: restore original deer/elk definitions and procedural bodies
  from `efafc96c68^` in `game/systems/species/legacy`, held for LD. Only the
  explicit legacy boot registers these; modern Pine retains its hull rows.
- `32120d2ac7`: isolate a registered legacy source's explicitly passed primary
  instance in its own copy namespace. Pine's original boss binding requested
  `pine-hollow`, whose modern document already had 20 fields; frozen Pine
  declares only five. The strict guard from `93052e3168` correctly refused
  that narrowing. The adapter selects `pine-hollow-legacy`, leaving the modern
  document byte-identical. No migration, drop or reset; placement ids and
  unregistered/ordinary sources remain unchanged. Helper held for LD.

Regression coverage includes original shade bounds, exact uniform handles,
real procedural species bodies, modern registration isolation, the observed
20-to-five refusal, isolated state writes, disposal/re-entry and non-legacy
refusal. The final state adapter has three focused cases, layer/root types,
scoped typed lint and 39 commit guards green. CF1 related reached its
60-second wall cap without an executed red and explicitly deferred to CI.

## Entry routing repair

`97532bcbe0` makes travel use the same registered entry inventory as the
deck. Far Reach and Signal primaries correctly declare `legacy:false`, while
their registered frozen copies supply LEGACY. Travel previously rejected the
saved choice against the primary metadata and entered the primary again.
Four regressions cover those two copies, absent/unflagged copies, unchanged
shardfile requests, Developer off and frozen identities. Layers/root types,
named typed lint and commit guards passed; CF1 related reached its 60-second
cap without an executed red and explicitly deferred to CI. No frozen/UI edit.

The initial button-only smoke reached six playable pages but certified only
four frozen identities. The final smoke requires the exact `*-legacy` slug
before accepting gameplay; a persisted choice alone is insufficient.

## Final browser evidence

Both final cohorts use exact app `c34c7ec0a2` (includes state adapter
`32120d2ac7` and travel repair `97532bcbe0`), one preview, 280 seconds combined:

- All six original LEGACY buttons enter their actual frozen copies: Driftwood,
  Far Reach, Nalati, Nine, Pine and Signal. Each choice persists, gameplay
  advances at least ten frames, the original nonblack-frame check passes and
  fatal/page/console/HTTP errors remain zero. Fresh muted Chromium contexts,
  iPhone portrait 402 × 874 at 2×. [Legacy witnesses](d1-legacy-boot.json).
- Official `scripts/parity/boot-smoke.mjs` passes all twelve modern cases with
  zero faults, including public Nine admission policy, Developer standalone
  cases, original Template entry/durable return and Signal road entry.
  [Modern witnesses](d1-modern-boot.json). Public-policy and Developer Nine
  share a raw filename; twelve independent PASS lines establish the count.

All owned browsers and the preview closed. No Simulator, frame-floor, phone
performance or visual-parity claim is made by these boot checks.

The observed pre-fix synthetic save documents are in
[d1-legacy-state-collision.json](d1-legacy-state-collision.json). They are a
namespace collision witness, not permission to migrate the modern document.

D1 wave 1 is complete. Legacy QA/deletion remains wave 2/3 under Jake's word.
