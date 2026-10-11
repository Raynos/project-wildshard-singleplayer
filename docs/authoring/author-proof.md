# Native author proofs

Run `wildshard prove <project|shard.json> <proof.json>` after building your product. The equivalent author API is
`proveAuthorSimulation(shard, assets, plan)` from `@wildshard/sdk/headless`. Authors import no game or engine module.

A version 1 plan contains `tape` (1–4096 ordered tick command arrays), `checkpointTick` (1-based, inside the tape),
and distinct `requiredFacts`. Commands use the same player/script/event grammar and aggregate per-tick allowance as
`HeadlessSimulation.step`. `authorProofExample` in `scripts/docs/authoring/readers.ts` is executed by the native tests.
Replace its empty commands with the real player route and beacon event your quest needs; listing a fact never creates it.

The fixed worker runs the actual platform grid with nine placements of your own package. It checks that residency is
reserved before native physics construction, that physics alone does not bypass runtime admission, and that a refused
save cannot checkpoint. It saves, leaves the region frozen for five highway ticks, unloads its physics lease, restores
its regional continuation and traveler pose, then compares the complete regional suffix and emitted quest facts with
an uninterrupted run of the same tape. Disposal must release every allocation. This is a native lifecycle/continuation
proof, not a browser crossing or an opaque Rapier-byte comparison. `validate` separately walks every declared entry.

Facts come only from the installed quest completion owner, with matching quest id, completion tick and
`quest:<id>` provenance. The actual platform Ledger files those facts through a serialized SaveStore port, reloads
that document in a fresh Ledger, and verifies duplicate filing leaves the profile unchanged. This proves the atomic
storage contract; it does not claim browser disk quota or permission. Author plans cannot inject facts or a reward
catalogue. This first workflow supports quest-owned achievement grants; catalogue rewards require the platform's
admitted catalogue and refuse here rather than inventing one. Script-owned ledger facts also need their real owner
and refuse in this workflow. Trusted-runtime products use their existing native witness.

The worker has the same independent 30-second request watchdog as other offline native proofs. The report is returned
only after every assertion succeeds; missing facts, trapped scripts, nonfinite poses, malformed commands, unadmitted
rewards and restore divergence fail the command.
