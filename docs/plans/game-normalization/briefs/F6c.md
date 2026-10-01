# E357 job F6c — the F6 codemod (04-move-map.md §7; 02 F6 steps 1–2), built and dry-run only

Read `docs/plans/game-normalization/brief-common.md` first: its rules bind you.

## The job
- Read `docs/plans/game-normalization/04-move-map.md` §0–§1 and §5–§7 in full, and `02-foundations.md` § F6 (steps 1–5, done-when). The input is the committed, reviewed `docs/plans/game-normalization/move-map.json`.
- Write `scripts/normalize/classify.mjs` (`--check <map>`: recompute rules I, G, N, M on today's tree; exit 1 listing files with no row, rows whose file is gone, rule disagreements) and `scripts/normalize/move.mjs <map> [--row F6|<row>] [--dry-run]` doing steps 1–8 of §7.2 exactly, idempotent, with §7.4's dry-run report (stdout + `scripts/normalize/out/dry-run.json`; add `/scripts/normalize/out/` to... no: you may not edit `.gitignore` (F2b owns it now) — write the JSON under `/private/tmp/e357-f6c/` instead and say so in the report).
- Unit-test the pure parts (the import rewrite: same layer → relative, across → alias; path-string matching longest-first on boundaries; template literals; query suffixes) in `test/normalize-move.test.ts` with fixtures in `test/fixtures/normalize/`.
- **Run only `--dry-run`** (and `classify.mjs --check`) on the real tree. **Never run the real move.** The tree has drifted since the map was measured (`0b6aa045`) and other builders are adding files right now (e.g. `src/core/probe.ts`, `src/core/harnessTap.ts`): report every drift `classify --check` finds and propose the map row for each new file (rule + destination) in your report; don't edit `move-map.json`.
- Done when: both scripts exist, the test passes, `tsc -p .` and oxlint are clean on your files, and the dry run completes; the report gives §7.4's items 1, 4, 5, 6, 7 summarised (counts; every unresolved import; shard → shard edges must be 0).
- Owns: `scripts/normalize/**`, `test/normalize-move.test.ts`, `test/fixtures/normalize/**`.

## Who else is building right now
F1a, F1b, F2a, F2b, F5, F3g, F3n (see the other briefs in this folder). They edit files under `src/`, `scripts/`, `test/`, `lint/`, `.github/`. Your dry run reads the tree; it must write nothing inside the repo except your own files.
