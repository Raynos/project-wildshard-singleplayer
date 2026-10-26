# TypeScript quick wins: mini plan (TOOLING-PERF, G646)

**State:** `open` 2026-10-23 — sent to the builder for **free lanes** (G639: after the live reds, Nalati to zero and grid
readiness). Each row is a ~5–30 minute change. Jake, 2026-10-23: *"any quick wins … if the quick wins can be built in like
5 minutes … send those over to the builder."* The bigger rows (generated JSON out of the program, src checked once,
isolatedDeclarations) live in [typescript-mini-plan.md](typescript-mini-plan.md).

Numbers: the plan agent's TypeScript benchmark, 2026-10-23, at 4356c6f8f0 in a mirror slot (load ~30, ±30 %). TS 7.0.2
(Go) is already in use. Full root check: 62.6 s / 10.2 GB.

| Row | What | Expected | Done when |
|---|---|---|---|
| QW1 | oxlint `ignorePatterns` gains `**/*.generated.*` (G642: no lint of generated files) | typed lint reads no generated file directly | `.oxlintrc.json` lists it; `lint-all` green |
| QW2 | `scripts/lint-all.mjs`: one oxlint process per CI shard instead of one per 256 files (`batchSize`), so the type program is built once per shard, not ~7 times | CI Lint step (4 × ~2 m 10 s) drops sharply | CI Lint step time in the commit message; no OOM (revert if the runner runs out) |
| QW3 | Local root check incremental: `tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/ws-root.tsbuildinfo` in `pnpm typecheck` and the lanes' focused checks (not CI) | warm no-change **75.7 s → 7.5 s, 10.2 → 3.3 GB** (cold 108 s, so CI keeps the plain check) | warm rerun ≤ 10 s in a mirror slot |
| QW4 | `test/pine-floor-product.test.ts` reads its 11 MB JSON with `readFileSync` + its valibot schema instead of a static import (G643) | −8.4 s of check time (the single worst file) | the file has no `*.generated.json` import |
| QW5 | Same change for the other tests importing the biggest generated JSON (`castHook` 28 MB, `floorLayout` 10.7 MB, `layout` 6.5 MB): `nine-world-scenes`, `pine-crag-scenes`, `nine-world-install`, `sky-signal-fixed-layouts`, `fixed-boot-layout-data`, `declared-ground-mask`, `specimen-catalogue`, `nine-facade-shell`, `scripts/nine-casts`, `nalati-boss-fights`, `nalati-layout-bake`, and the fixtures `species-oracle/*`, `nalati-kokpar-oracle`, `proof/pine-hollow/witness` — one commit per file or two | each removes a big JSON type from the program (tests import JSON = ~49 % of check time overall) | no test imports a `*.generated.json` over 1 MB |
| QW6 | Pre-commit runs `lint:fast` on staged files as the hard gate: `untypedLintConfig()` from `scripts/push-lint-config.mjs` already builds the config (oxlint R1/R2, G634/G636) | pre-commit lint 4.1 s / 3.1 GB → ~0.2 s / 0.2 GB | no type program in the hook; the deferred typed attempt stays per G636 |
| QW7 | **done (2026-10-26, sp-x9): folded into T4 annotations** `bf10517256`, `b28dcc33ec` and their continuations; no duplicate schema edit. The conditional TS2589 blocker is absent. | Three original declaration families: 1,561,005 → 51,429 B (audio profiles 28,949; voice patches 2,368; client plan 20,112). | TS 7.0.2: layered build exits 0 in 3.06 s on the shared mixed working tree, not an exact-HEAD certification. Clean committed format/config inputs force-build in 0.97 s; both original declaration regressions pass in 5.15 s, including emitted consumer types and hostile tuple rejection. Broader T4 work remains open in its own plan. |

Not quick (in the TypeScript mini plan): generated JSON out of the program (−4 GB, −15–30 s), check src once in CI (−60 s), explicit types / isolatedDeclarations (G644), tests next to their source (G645), pre-push full check with a persistent tsbuildinfo (warm 1–5 s).
