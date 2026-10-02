# E357 job F6m — make the move map current and the dry run warning-free (04 §7.1, §7.4; 02 F6 step 1)

Read `docs/plans/game-normalization/brief-common.md` first: its rules bind you.

## The job
sol-f6c built the codemod (`scripts/normalize/classify.mjs`, `move.mjs`; commit 29638876) and dry-ran it: 874 moves,
0 unresolved, 0 collisions, 0 shard→shard, **59 classifier findings** (15 new files with no row + 44 rule
disagreements) and **727 unmatched `src/`-looking literal warnings**. Its handoff in `docs/tasks/asks/E357.md` and the
evidence files `/private/tmp/e357-f6c-classify.json` and `/private/tmp/e357-f6c/dry-run.json` list them all.
- Read `04-move-map.md` §0–§1 (the rules and principles, the layer boundary: mechanism vs content, the rule of two) and
  §7 in full, and `GAME-NORMALIZATION.md` §2.1.
- **The 15 new files**: add a row each (`rule` per §1.2; files already at their final engine path are identity rows).
  `src/engine/debug/probe.ts` → `src/engine/debug/probe.ts`, `src/engine/core/harnessTap.ts` → `src/engine/core/harnessTap.ts` as
  proposed. Re-run `classify.mjs --check` at the end: newer files may appear meanwhile (F7b, F3n): add them too.
- **The 44 disagreements**: decide each one against the principles. The reviewed map wins unless its row is wrong
  against today's code (a file that moved, an importer added since 0b6aa045, a shard that started using it). When the
  map is right, make the classifier agree (an explicit override list in `classify.mjs` with the row's `why`); when the
  map is wrong, fix the row. Every changed row gets a one-line reason in its `why` ("E357 F6m: …").
- **The 727 warnings** (§7.4 item 5): sort them into (a) real paths the codemod must rewrite (→ fix the map / the
  codemod's scan), (b) comments and docs mentioning a path (→ the codemod's step 6 rewrites them: confirm), (c)
  deliberate non-paths (→ `scripts/check-paths.allow.json` entries with a `why`). Report the counts per bucket.
- Edit the map with **targeted line edits only** (the file has one JSON object per line; never re-serialise the whole
  file). Keep `JSON.parse` valid.
- Done when: `node scripts/normalize/classify.mjs --check docs/plans/game-normalization/move-map.json` exits 0 and
  `node scripts/normalize/move.mjs docs/plans/game-normalization/move-map.json --row F6 --dry-run` reports 0
  unresolved, 0 collisions, 0 shard→shard, and only bucket-(b) warnings. **Never run the real move.**
- Owns: `docs/plans/game-normalization/move-map.json`, `scripts/normalize/classify.mjs`, `scripts/normalize/move.mjs`
  (bug fixes only), `scripts/check-paths.allow.json` (new entries only; F2b may also be adding entries: `git diff`
  first).

## Who else is building right now
F1b (bakers), F2b (parity), F3n (nightly), F4 (`lint/**`), F7b (`scripts/normalize/liveness.mjs`, `port-probe.mjs`,
deleting dead scripts: a script it deletes needs no row in §5 of the map), S15g (`scripts/music/gen/**`).
