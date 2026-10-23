# oxlint speed: mini plan (TOOLING-PERF, G634/G636)

**State:** `draft` 2026-10-23 — benchmark done (plan-agent subagent, mirror slot at 6f6add1, 5,799 lint files, 18-core Mac
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
| R1 | `lint:fast`: today's config with `typeAware: false`, unused-directive reporting off, the 2 heavy JS rules removed (reuse `scripts/push-lint-config.mjs` `untypedLintConfig()`) | full repo ≤ 10 s; 20 files ≤ 1 s |
| R2 | Pre-commit runs `lint:fast` on staged files as a hard gate (inside G636's parallel set) | no type program in the hook; typed attempt kept per G636 |
| R3 | `lint:typed` (type-aware + the 2 heavy JS rules): push gate on changed files + importers; CI one full-repo job (+ one `lint:fast` job) instead of 4 `lint-all` shards | push-gate typed lint ≤ 15 s |
| R4 | Typed declarations for the generated JSON (`allowArbitraryExtensions`, `x.generated.d.json.ts`) — shared with the TypeScript plan | full typed lint ≤ 15 s / ≤ 8 GB |
| R5 | Fix the real error at HEAD: `src/game/riding/client.ts:26` duplicate import of `./taming` | lint clean |

## Decisions for Jake

1. **The 2 heavy JS rules:** move them to `lint:typed` (recommended) / rewrite them without a TS program / drop them.
2. **Push-gate `lint:fast` scope:** full repo, 6–10 s (recommended) / changed files only, < 1 s.
3. **Generated JSON:** typed declaration files (recommended) / load big tables at runtime with a valibot parse.
4. **`--type-check` in `lint:typed`:** leave out, keep tsc as the type check (recommended).
