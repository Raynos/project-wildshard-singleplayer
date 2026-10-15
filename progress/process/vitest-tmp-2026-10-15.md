# Vitest temp dirs out of $TMPDIR (2026-10-15)

Finding 1 of `project/disk-audit-2026-10-15.md`. Fix: `scripts/vitest-tmp.ts`, a plugin in `vitest.config.ts`.

- Vitest 5 resolves the config before `new Vitest(harness, config)` (`cli-api` `createVitest`), so setting `TMPDIR` in
  the config does reach both class-field `tmpdir()` calls. The plugin points it at `./tmp/vitest/<pid>` and restores it
  in `configureVitest`, after the projects exist, so tests see the real temp dir. It also points the workers'
  `NODE_COMPILE_CACHE` there: workers import each run's module copies by their per-run path, so every run added
  ~2,700 compile-cache entries. `process.on('exit')` removes the whole `<pid>` dir; `boot-temp-warn.sh --count`
  sweeps the dirs of dead runs after an hour.
- Checked: a focused run wrote a nanoid dir and a compile cache under `./tmp/vitest/<pid>`, removed both on exit, and
  added nothing to `$TMPDIR`.
- Cleanup: 29 orphan nanoid dirs older than an hour, 24,217 files, deleted from `$TMPDIR`.
- `$TMPDIR/node-compile-cache` (284k files, all written within the hour) comes from the herdr server's environment:
  it was started with `NODE_COMPILE_CACHE=$TMPDIR/node-compile-cache`, and every agent shell inherits that without
  re-reading `.bash_profile`. It lasts until herdr restarts.

## Upstream issue (vitest 5.0.1)

`Vitest._tmpDir = join(tmpdir(), nanoid())` (`dist/chunks/index.*.js`) is passed to `createFetchModuleFunction` as
the root module cache, but nothing removes it: `close()` only calls `TestProject.clearTmpDir()` for each project's
own `tmpDir`. Every run leaves the top-level dir behind, and a killed run leaves the project dir too. Suggested fix:
remove `_tmpDir` in `Vitest.close()`, and create both dirs lazily or under one per-run root that `close()` removes.
