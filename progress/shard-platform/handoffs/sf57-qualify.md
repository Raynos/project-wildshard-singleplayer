# Handoff (sf57-qualify) — 2026-10-08

Lane stopped at its 90 min cap. Nothing landed yet. The fix waits on one graph-rise approval.

## Done: leak attribution
Public soak `public-c47de2d8c` grew +0.612 MB GL per circuit. A settled-census diff (c0 to c4) puts all of it on one cause:
Driftwood's hybrid does not retain its home runtime. Every home re-entry re-runs `play`, and each install of the old
entry stays on the page. Per entry, that leaves a new zipline group + trolley (plus its registry piece and deck colliders),
the sea-glass chime, the trophy plaques, the interact-lit/glow BatchedMeshes and Wendell (his smoke Points). Copies: 1 at
c0, 3 at c1, +1 per circuit. The WASM rows that grow are GC'd zero-byte telemetry, not memory.

## Built, not landed: fix B (the coordinator's go-B)
Files: `src/shards/driftwood-isle/quest/{adventure,Spine,interactLifetime}.ts`, `loot/keepsakes.ts`,
`test/shards/driftwood-isle/interact-lifetime.test.ts`. Each install now runs under the entered `ctx.scope`
(`scope.run`), so its registry piece, colliders and body leave with the entry. Its scene subtree is owned with
`ownSceneTree` through `ownEnteredTree` in Spine.ts. Copies of the files are in the working tree (no foreign hunks) and in
`/private/tmp/claude-501/sp-builders/sf57-qualify/export/`. To stage them on HEAD:
`bash /private/tmp/claude-501/sp-builders/sf57-qualify/stage.sh <HEAD> <the five paths>`.

Proof so far:
- Re-entry witness (Chromium, iPhone 16 Pro, muted, candidate `84d020e3a`, which predates the last Spine type-only
  tweak): after each of 2 road-and-back visits, zipline, Wendell, interact-lit/glow, smoke, the zipline / chime / plaques /
  castaway pieces and the zipline and Wendell prompts each appear exactly once. No page errors.
- `physics-baseline --mode=walk --shard=driftwood-isle`: 8 legs, 0 stuck.
- Clean export full suite: 997/998 files, 5552/5553 tests. The one failure is AG7: **shards/driftwood-isle → engine
  549 → 550** (Spine.ts imports `ownSceneTree`). This needs the coordinator's approval. Typecheck, layers, oxlint,
  coupling (scope 19 → 18) and ratchet are all green.

## Left
- Approval of the AG7 +1 rise, then land.
- Boot smoke and the Driftwood parity poses on the landed SHA.
- Colliders after home re-entry read 2301, then 2303. A 2-collider residue may still remain per entry; find its owner.
- `place()` keeps `life.records` and `registry.picks` per registry, not per owner. These are small JS refs to old
  objects; their GL is freed now.
- bootstrap's `moving` list keeps each Wendell `sync` closure.
- Calibration: the model over-states. M-E = 0.88 A, with A = 536 MB, of which the home claim is 342 MB. Not yet
  attributed. Next step: compare the Driftwood home's declared 342 MB with its measured WC + GL in both texture modes.
- Qualifying witness, KTX2 warm-up, road-only leg and the 30 min soak are untouched.
