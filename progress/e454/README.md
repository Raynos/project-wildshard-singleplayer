# E454: fast pre-commit, pre-push and CI (wall clock)

Jake: *"Git push must be fast. Like max 2 minutes the pre push. … All pre push and GitHub actions CI must be fast also
pre commit."* Targets: pre-push ≤ 2 min wall, pre-commit ≈ ≤ 20 s, CI ≤ 5 min to green.

Measured on the shared M5 Max (18 cores) with other agents running (load 7–13), so single numbers carry ±10 %.

## 1. The custom lint rules (commit 1)

Profiling the ratchet's oxlint pass (`node --cpu-prof`) showed 70 % of it in `checkerFor` (`lint/authored-html.mjs`):
the program was built from the files that contain a sink word, but the rule also sends every file with a call named
`write` / `writeln` / `assign` (all of `Object.assign`); such a file was missing from the cached program, so each one
rebuilt the whole TypeScript program. The program now holds every candidate file up front (and a rebuild reparses only
changed files). The next 14 % was `lint/commons-closure.mjs` rereading each file and `package.json` on every import
walk; the caches now validate by size + mtime. Same 426 diagnostics, byte for byte.

| step (wall, s)                                  | before | after |
| ----------------------------------------------- | -----: | ----: |
| ratchet oxlint pass (`lint/ratchet.mjs`)         |   50.7 |   7.9 |
| full type-aware `oxlint`                         |   54   |  15.9 |
| post-commit hook (ratchet on the commit's tree)  |   54   |  (§2) |
| regeneration (`ratchet.mjs --measure` inside)    |   57   |  (§2) |
