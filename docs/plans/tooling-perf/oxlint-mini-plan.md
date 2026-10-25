# oxlint speed: mini plan (TOOLING-PERF, G634/G636)

**State:** `in flight` 2026-10-24 (sp-x9, G709) — R1 verified below; R2–R5 next in order; D2/D4 build on the recommended option until Jake picks. Benchmark done (plan-agent subagent, mirror slot at 6f6add1, 5,799 lint files, 18-core Mac
shared with lanes, ±30 % noise); decisions D1–D4 wait for Jake. Rows R1–R3 match decisions he already made (G634: fast
lint always, pre-commit fast only; G636: pre-commit cheap parallel set).

## Measurements

**Without type-aware rules** (wall / peak):

| | no JS plugin | 29 cheap JS rules | full JS plugin |
|---|---|---|---|
| full repo | 0.7–1.0 s / 0.75 GB | 6.4–10.1 s / 2.4–2.7 GB | 51.6 s / 6.1 GB |
| 1 file | 0.06 s / 0.2 GB | 0.21–0.25 s / 0.2 GB | 0.43 s / 0.18 GB |
| 5 files | 0.16 s / 0.23 GB | 0.26 s / 0.36 GB | 0.26–0.38 s / 0.36 GB |
| 20 files | 0.15 s / 0.24 GB | 0.8 s / 0.64 GB | 13.8–17.9 s / 3.2 GB |
| 60 files | 0.20 s / 0.33 GB | 0.5 s / 0.5 GB | 7.4–13.0 s / 2.2 GB |

**With type-aware rules** (no JS plugin): with generated files present (after a 312 s `gen`): full repo 47 s / 12.7 GB
(`--type-check` 62 s / 15.7 GB); 1 file 4.1 s / 3.1 GB, 5 files 5.1 s, 20–60 files 13 s / ~5 GB. Without the generated
JSON: full 10.3 s / 8 GB. Full typed + full JS plugin in one run: 180 s / 12.7 GB (≈ CI's 4 × 2 m 10 s Lint step).

## Why it is slow

1. **106 MB of generated JSON** (229 `*.generated.json`, biggest `castHook` 28 MB, `floorLayout` 10.7 MB, `layout` 6.5 MB)
   imported statically by `.ts` files, so the type program reads and types each one: 10 s → 47 s, 8 → 12.7 GB. tsc pays the
   same (TS 7 too).
2. **Two custom JS rules build their own TypeScript program:** `wildshard/no-authored-html` (7.9 s / 2 GB on 20 files) and
   `wildshard/no-shard-host-callback` (4.4 s) — ~41 of the 52 s of full untyped lint.
3. **CI batching:** `scripts/lint-all.mjs` starts a fresh oxlint per 256 files, rebuilding the type program each batch.
4. **Pre-commit:** `--type-check --type-aware` builds the whole type program even for one file (4.1 s / 3.1 GB); under load
   nearly every commit misses the 5 s cap and defers (759 files deferred).
5. `--type-check` adds 15 s / 3 GB and finds 5 TS errors CI's tsc does not (per-file tsconfig choice), so it cannot replace tsc.

## Rows

| Row | What | Done when |
|---|---|---|
| R1 | **done (2026-10-24, sp-x9):** `lint:fast`: today's config with `typeAware: false`, unused-directive reporting off, the 2 heavy JS rules removed (reuse `scripts/push-lint-config.mjs` `untypedLintConfig()`) | Actual full fast lint 7.72 s; 20 engine files 0.44 s, both green. Fast config imports no TypeScript library; CLI-only JSONC parsing remains unchanged. |
| R2 | Pre-commit runs `lint:fast` on staged files as a hard gate (inside G636's parallel set) | no type program in the hook; typed attempt kept per G636 |
| R3 | `lint:typed` (type-aware + the 2 heavy JS rules): push gate on changed files + importers; CI one full-repo job (+ one `lint:fast` job) instead of 4 `lint-all` shards | push-gate typed lint ≤ 15 s |
| R4 | **G643:** TypeScript never reads generated JSON — imports resolve to one ambient `unknown` module, importers parse with their valibot schema — shared with the TypeScript plan | full typed lint ≤ 15 s / ≤ 8 GB |
| R5 | Fix the real error at HEAD: `src/game/riding/client.ts:26` duplicate import of `./taming` | lint clean |

### Current-source boundary (2026-10-24)

R1 already shares the staged fast config, excludes generated outputs and disables
only the two approved whole-program rules. The import refusal fixture now also
prevents an eager TypeScript-library load on that path. Seven alternating
source-hashed pairs reduce config-module import median 86.71→29.69 ms; this
is startup overhead, not a full-lint speed claim. No rule is weakened.

Before R3, retain the five-way CI partition introduced by `7a507f252e` after
three full-program runner shutdowns. One current complete typed invocation is
still 58.36 s / 11,112,628,224 B maximum RSS on this Mac (6,338 files, green),
so replacing it with one CI job is not yet justified. G675 also supersedes
R3's local push typed-lint requirement: typed lint remains a full CI gate.
R4's generated-input dependency must be resolved before consolidating CI.

## Decisions for Jake

1. **The 2 heavy JS rules: DECIDED (G642)** — rewrite them to use only oxlint's AST (no TypeScript program); until then they run only in `lint:typed`. Also: all generated files excluded from lint (G642).
2. **Push-gate `lint:fast` scope: DECIDED (G655)** — the whole repo, 6–10 s.
3. **Generated JSON: DECIDED (G643)** — excluded from the type program entirely (`unknown` + schema parse), no companion declarations.
4. **`--type-check` in `lint:typed`: DECIDED (G657)** — left out; tsc stays the type check.
