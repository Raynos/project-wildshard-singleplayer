# E357 job F7b — delete the dead, part 2: scripts liveness, the probe port, scripts/README.md (02 F7 steps 4–6)

Read `docs/plans/game-normalization/brief-common.md` first: its rules bind you.

## The job
- Read `02-foundations.md` § F7 in full. Steps 1–3 are done (a83e63f7: src/dev, dev/, the dead files); you do 4, 5 and 6.
- Step 4: `scripts/normalize/liveness.mjs` (+ `test/liveness.test.ts` on a fixture tree). Run `--dry-run`, put the list
  and its count in your report and in your handoff, then delete every entry it reports not live (git rm of those script
  files only; each listed in the commit message). Before deleting, sanity-check the list: a script named by a skill,
  hook, workflow, package.json or a living doc must never be on it (if it is, the classifier is wrong: fix it).
  `scripts/normalize/` also holds sol-f6c's codemod files (`move.mjs`, `classify.mjs`): don't touch them.
- Step 5 (only once F2a's probe commit is in `git log` — `git log --oneline | grep 'E357 F2'`; if it hasn't landed by the
  time 4 and 6 are done, commit them, report "step 5 waits on F2a" and end): `scripts/normalize/port-probe.mjs`, the
  `__world` port across scripts + the living docs listed, then delete the alias lines (`debug.__world = handle` in
  `src/main.ts`, `window.__world = world` in `installProbe`, `__world` in `scripts/types/wildshard-probe.d.ts`). Ported
  scripts in `scripts/tsconfig.json`'s include must pass `tsc -p scripts`.
- Step 6: `scripts/README.md` via `liveness.mjs --readme`; `--readme --check` must pass. The lead adds it to `pnpm test`
  (say the exact command in your report; don't edit package.json).
- Done when: F7's done-when items for steps 4–6 hold; your test passes; tsc (`-p .` and `-p scripts`) and whole-tree
  oxlint are clean on your files.
- Owns: `scripts/normalize/liveness.mjs`, `scripts/normalize/port-probe.mjs`, `scripts/README.md`, the scripts you delete
  or port, `test/liveness.test.ts`, `test/fixtures/liveness/**`, the living docs step 5 names, and (step 5 only) the
  three alias lines.

## Who else is building right now
F1b (bakers), F2a (probe — its files are its own until it commits), F2b (`scripts/parity*`: don't port or delete those;
they are being written against `__wildshard` already), F3n, F4 (`lint/**`), F6c (`scripts/normalize/move.mjs`,
`classify.mjs`), S15g (`scripts/music/gen/**`: live, don't delete), F8a. Nobody edits `package.json` but the lead.
