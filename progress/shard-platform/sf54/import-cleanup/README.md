# SF54 — defining look and Nalati bow imports

Plan-State: unchanged. Import-only cleanup; no look, control or tuning change.

Nalati and Pine world hooks lazily import `game/systems/looks/{particles,trample,grassField}` directly;
`kit/lookApi` and its package export are deleted. Nalati's initial trample import remains before grass configuration.
Nalati's non-runtime bow consumers use defining game Bow/profile/glyph modules (the SDK runtime surface is restricted
to runtime files). Its arrow roster reads the same starter profile's quiver count, 24. No duplicate constructor,
profile or glyph recipe was introduced. `check-row-data` now inventories BowProfile at its defining game package:
the same 83 legacy function fields remain, with no allowance change.

Approved import delta: Nalati→game +13, Pine→game +2; Nalati→kit −10, Pine→kit −1, kit→game −6.
No new raw reaches. Runtime-commons debt falls Nalati index/state 1→0 each, Pine index 3→2;
serialized regeneration owns graph/debt/API output updates.

Validation: clean-export full rerun **961 files / 5,456 tests passed, 14 skipped** on source candidate
`8d4e5f2e38bbab9e3ff29eac6fca8e41585a1d78` (base `eb1c07e5a`, ask receipts fixed).
Generated outputs were regenerated inside that export; they are excluded from the source commit.
The existing bow/recipe/row fixtures pass 14 tests, including the pinned
10,000-tick draw trace, portrait/landscape bow behaviour and constructor/recipe identities. Strict, root oxlint,
row-data guard and source hooks pass; the regenerated ratchet passes with no rise. The first full run passed
5,452 tests and found only the approved graph increase plus missing E441/E442 receipts; coordinator `eb1c07e5a`
fixed the latter, then the complete suite was rerun. No assertion was weakened. `validation.json` and the compressed
full-run log preserve the proof.

`models/gear.ts` is a map-hash input, so Nalati was mechanically rebaked against unreferenced build
`56cbc9618b9aecebea7dc234a752d5c1bd46879c` (parent `e966fc3b509af59139cb4e08d2c2ee15f25e9b64`).
The 1000px map is 134,446 bytes, mean absolute old/new RGB difference 0.990452/255, with no visible placement change.
The stamp records input hash `b378e59c7279ee1d1b190fe946fa882a3c8ad93ed8553bbf526a5a7989b2024c`.
The first bake attempted navigation before preview readiness and refused connection; it produced no result.
The version-verified retry succeeded. Browser and preview closed. No new native performance claim.

The separate Pine STARTER_EFFECTS edit and all other lanes' dirty/staged hunks are excluded from this change.
