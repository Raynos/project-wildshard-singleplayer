# SF68 committed admin data (E462)

This is the non-graphical pipeline for `wildshard-admin`. No game code, live game connection, browser or deployment.

```sh
node scripts/admin-data.mjs --root=. --rev=HEAD --out=/tmp/admin-data-NEW
```

The output directory must be new. `bundle.json`, `schema.json`, `loading.schema.json` and content-hashed `media/` files are written as one complete directory. The UI can fetch `bundle.json` and resolve each `media[].url` relative to that directory. Nothing is copied to the game `public/`. A failed build exits nonzero; it never publishes a partial bundle. The coordinator owns the Vercel project and deployment wiring.

`--rev` resolves to one full commit before collection. Only regular blobs from that tree participate: shared-index changes, working-tree edits and untracked captures do not. Source records carry path, SHA-256 and byte length. Stable key order, sorted source paths, content-addressed media and no build timestamp make the same revision byte-identical. Text sources are bounded to 32 MB, media to 64 MB each / 512 MB unique total. An arbitrary old revision containing incompatible report data fails rather than being silently upgraded.

For a deployment host without `.git`, explicitly supply an immutable clean export and its full commit pin:

```sh
node scripts/admin-data.mjs --snapshot-root=/tmp/export --rev=FULL_40_CHAR_SHA --out=/tmp/admin-data-NEW
```

The export producer is responsible for `git archive` provenance; the pipeline cannot prove that arbitrary filesystem bytes belong to a Git commit. This mode refuses a root containing `.git`, never silently reads the working tree, and rejects symlinks. The admin deployment must retain committed `progress/memory`, `progress/loading/sf67`, `art/playtest` and the plan; the game deployment's progress exclusion is not an admin input policy. No game ignore/config files are changed here.

## UI contract

The TypeScript contract is [types.d.mts](types.d.mts); the portable draft-2020-12 schema is [schema.json](schema.json). `readAdminBundle(unknown)` in `validate.mjs` validates that shape **and** its semantic fences. The bundled validator implements only the keywords used by these two authored schemas; use an ordinary JSON Schema validator if extending the schemas with other keywords. Memory additionally goes through SF64's existing validator.

- `schema: "wildshard-admin/1"`, `revision`: the collection commit, **not** the historical measurement pin.
- `memory`: all `progress/memory/**/itemized.json` and `report.json` with `memory-report/1`. Each entry has `format: "itemized" | "sf64"`, its original report, source and measured pins. These reports overlap: they are alternative views, never additive. Unknown memory-report versions refuse.
- Legacy itemized `M/E/U` confidence, native WC/GL, overlapping vmmap categories, build ids and fractional historical estimates remain verbatim. SF64 native WC+GL, allocator accounted bytes, storage capacities, nulls and missing-pose reasons stay separate. No resident RAM is invented from a heap capacity or WC difference.
- `loading`: `unavailable` with a reason until a committed SF67 report exists; never zero timings. The first benchmark uses the contract below.
- `playtests`: every committed `art/playtest/round-*/README.md`, its Markdown, build/version identifiers from setup, ranked Top 10 bodies, status tables and media paths. Human statuses such as “not reproduced” stay text. Included-fix commit ids are not extra playtest builds. Findings reference exact filenames or unambiguous `clip-NN` shorthand; all round media remain available in the gallery. Source line numbers are one-based. Historical prose table rows with extra cells remain intact.
- `plan`: State verbatim, its reported effort percentages, the dated agent-day table separately, §6 milestone requirements, canonical SF/G table rows and conservative `waitingForJake` matches. Waiting matches require a direct “needs pick / waiting for Jake / after Jake's yes” status or the explicit public-opening gate, **not** a future conditional or a feature describing the dashboard. This is an index into the original cells, not an inferred completion grade. State/checklist prose remains available for other human gates. Historical Handoff tables are excluded. No line-count or stale table percentage replaces State.
- `media`: original path → hashed relative URL, SHA-256, bytes and image/video kind. The UI renders Markdown safely as text/components and resolves media via this manifest; it must not inject raw report HTML.

## SF67 producer contract

Write `progress/loading/sf67/<run>/report.json` with [loading.schema.json](loading.schema.json), validated by `readLoadingReport(unknown)`. [fixtures/loading-benchmark.json](fixtures/loading-benchmark.json) is **synthetic**, not a benchmark and never collected as evidence.

```ts
{
  schema: "loading-benchmark/1",
  pin: string, device: string,
  runs: [{
    shard: string, cache: "cold" | "warm", timeToPlayableMs: number,
    phases: [{name: string, startMs: number, endMs: number, owner: string}],
    longTasks: [{startMs: number, durationMs: number, owner: string}]
  }],
  missing: string[]
}
```

Times are milliseconds on one run's monotonic clock, relative to its navigation start. Durations are finite and nonnegative; every long task is **strictly >50 ms**. Phase ends cannot precede starts. Build/device are required. Unsupported long-task instrumentation goes into `missing`, never a claim of zero pauses. Cold/warm runs are separate entries; all share the report pin/device. The producer records failures/missing stages honestly; an empty report needs a missing reason. Nested run folders are accepted. Extra fields / unknown schema versions fail so changes are reviewed before consumption.

Focused check: `pnpm exec vitest run test/admin-data.test.ts`. Fixtures use a temporary Git repository and synthetic reports; tests never depend on `progress/` surviving a Vercel game export.
