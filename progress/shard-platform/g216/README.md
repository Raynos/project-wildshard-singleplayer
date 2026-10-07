# G216 · Developer may exceed the memory envelope with the full charge

E435 / E452. Source proof `1d498c25e40f21642b77154927b58850512d9781`; the exact build is in `results.json`. Initial integration pin `dc6065869` is retained in `dc606-results.json`. Each variant used a fresh iPhone 16 Pro portrait context in one muted Metal browser. Entry was the actual title's SHARD SELECT or INFINITE WILDSHARD tap. No URL variant, substituted product or reduced claim was used. The browser and preview were closed.

| Case | Result |
| --- | --- |
| Pine, Developer OFF | Refuses before a world exists; the existing fatal card gives a title escape; no page error. |
| Pine, Developer ON | Loads; visible warning: **1,273.195441 MB playing / 1,000 MB**, **1,353.195441 MB loading / 1,800 MB**. Exact home claim **804,680,577 bytes**; native and GL provenance and category totals remain visible. |
| Driftwood, Developer OFF | Loads normally without a warning or page error. |
| Infinite, Developer ON | Real grid settles: **907.44 MB playing**, **475,169,262 accounted bytes**, zero ring refusals, zero pending regional admits and zero issues; template-4/6 own their regional hosts. No page error. |

`summary.json` is the compact receipt; `results.json` has full readouts; the four portrait JPEGs show the visible paths. This is a functional admission proof, not a new frame-floor or physical-memory measurement. Pine's old default/images-first metadata is intentionally conservative here: the separate accepted 8e82 cuts-1–3 measurement has `pineMemoryTrim=on`; G216 does not silently substitute that variant for the default claim. Four entry cases passed, all with zero uncaught page errors on the final pin.

Only the trusted total-memory envelope is overridable. The original public refusal, two-phase eviction rollback, exact claims/refcounts, fractional custom caps, parser/hash checks, authored cost honesty and script ceilings remain checked. Runtime, declared, actual and resident warnings share one page policy. The Developer-only HUD warns about a shard that was admitted; G217 separately draws screens for cells that cannot be entered. Caps did not rise.

## Verification

```sh
# First build the committed source from the caller's scratchpad:
scripts/serve-build.sh --rev 1d498c25e --hours 1 --name g216
scripts/browser-lane.sh --max 15 node progress/shard-platform/g216/browser.mjs <preview> <scratch-output> 1d498c25e
pnpm exec vitest run test/memory-admission.test.ts test/grid-developer-admission.test.ts test/memory-warning.test.ts test/shardfile-developer-admission.test.ts test/grid-page-boot.test.ts
pnpm exec vitest run test/entry-rescue.test.ts test/grid-page-boot.test.ts test/grid-recovery.test.ts
pnpm exec tsc --noEmit
```

Focused result: **16/16**, entry/page/recovery **17/17**, root strict passed. The urgent strict-path regression was also checked in a **clean git export**, with `node scripts/link-node-modules.mjs`, `pnpm gen`, and the seven suites below: **20/20 passed in 7.51 s** (`strict-clean-tests.log`). The clean candidate was the fix landed in `b4f883c04`; no stale ignored product or pack was needed.

```sh
pnpm exec vitest run test/shardfile-home-tiles.test.ts test/grid-road-bytes.test.ts test/live-grid-admission.test.ts test/live-grid-waiting.test.ts test/live-grid.test.ts test/proof/_template/grid-ready.test.ts test/memory-admission.test.ts
```

## Failure found by the proof

Pre-bootstrap admission can throw before `startSession` installs its load-error boundary. `main.ts` launches `start()` asynchronously; the original root catch rethrew, leaving the first-paint loader behind an unhandled rejection. `1d498c25e` paints the existing fatal card for this path; validated grid recovery still returns to the title. The final public Pine context verifies that fix without allocating a world or overriding the cap. Initial harness setup errors were corrected (use the real title tap and the normal service-worker path) and are not counted as game passes.

Source commits: `b3908f562`, `136213d4d`, `8f743c101`, `97dfa7e6c`, `3dec7e134`, `3509d42fd`, `b4f883c04`, `e70e485a2`, `dc6065869`, `1d498c25e`. The coordinator owns the serialized gate/push and generated outputs; this receipt makes no claim that its local commits are already on origin.
