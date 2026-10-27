# Full ratchet count audit, 2026-10-27

In flight (sp-x6): D53/D94 remain open. No allowance was increased.

The audit pins `d1308217c1e0e94a4cd638d91e2da53689266794`.
The [row inventory](ratchet-counts-2026-10-27.csv) contains every raw rise,
its current owner route, historical source-boundary candidate and rename
credit evidence. Owner routes identify today's repair lane; they do not
attribute an old commit to that lane.

## Three measurements, three scopes

1. `lint/ratchet.mjs` compares the complete native oxlint diagnostic census
   with recorded limits. A missing row means zero.
2. The push gate's `committedFastChecks(..., 'ratchet', paths)` examines only
   changed paths. Since `97e8dcaeb8`, an absent non-hard row uses the
   predecessor's measured count. An unchanged unrecorded violation therefore
   passes that scoped comparison. Existing excess on untouched files is
   outside its scope. This is different policy, not proof that full debt is
   clean.
3. The Git-object `ratchet-counts` phase calls each JS rule directly on
   pinned source. It counts `context.report` calls before native inline
   suppression. For example, it reports `retry.ts`'s one-shot timer even
   though its exact justified inline suppression hides that native
   diagnostic. Its raw counts are not an actual full-CLI verdict.

CI duty ran the actual full CLI in its existing pooled snapshot at the
same pin: exit 1, zero positive `was/now` lines, 531 clean-entry failures
and ten zero-rule messages. That empty census is **unqualified for debt
removal**. An explicit `seaGlassChime.ts` control in that snapshot finds
one file and three generator plus three engine diagnostics, both with and
without `--no-ignore`. In the main checkout, a directory control finds
317 Driftwood generator files and the same six diagnostics. The directory
walk's coverage in the ignored snapshot remains under investigation.

## Pinned raw rule count inventory

All 4,779 tracked source code paths were supplied to the existing committed
count phase. It reports 574 rule/file rises across 381 files, including 563
missing rows and eleven rises above existing positive limits.

| Rule | Raw rule/file rises |
| --- | ---: |
| generator-imports | 353 |
| shard-engine-imports | 112 |
| shard-game-imports | 34 |
| shard-game-plugins | 34 |
| shard-sandbox | 22 |
| no-raw-random-time | 16 |
| public-index | 2 |
| no-global-listener-patch | 1 (native suppression, not a CLI rise) |

The same count phase finds 319 recorded rows with zero raw reports. They
are candidates for shrink-only cleanup, not permission to delete 531 rows
from the empty CLI run. At this pin, **no recorded count row names an absent
tracked file**: the earlier stale-path cleanup has already landed.

## Genuine rises above an existing credit

These source or folder-boundary changes can be inspected directly; they are not explained
by a missing-row fallback or the snapshot's empty walk.

| File suffix | Rule(s), recorded → raw | First source boundary |
| --- | --- | --- |
| Driftwood `seaGlassChime.ts` | generator, engine: 2 → 3 each | `d78cef78109f` |
| Driftwood `trophyPlaques.ts` | generator, engine: 2 → 3 each | `d78cef78109f` |
| Ink Cel `ink-cel-valley.mjs` | generator: 6 → 7 | `128c843a786d` |
| Ink Cel `terrain.ts` | generator: 2 → 3 | `dc81033ce035` |
| Nalati `campProps.ts` | generator, engine: 3 → 4 each | `305cca8000b5` |
| Nalati `canidBody.ts` | generator: 4 → 5 | `1388017ebd5e` |
| Nalati `nalati-capture.mjs` | generator: 9 → 10 | `4e2c7b9fe445` |
| Pastel `pastel-plain.mjs` | generator: 6 → 7 | `128c843a786d` |

For example, `d78cef78109f` changes `SlotRecorder` from the shard's own
runtime module to `@wildshard/engine/models/slots`, adding the third engine
import. The source already has that import at last-green `59a595ab1`;
unchanged since that revision does not make the 2 → 3 rise disappear.

## Renames and attribution limits

Git rename history identifies 56 missing-credit candidates (125 former
units): 31 engine, nine generator, eight game-plugin, six game and two
sandbox entries. All 56 old rows **and** their new rows are already absent
from the pinned policy. There is no live old row to move one-for-one in
this cleanup. Restoring historical credit would increase today's policy;
this audit does not do that or fund it with unrelated clean rows. Some
renames also have genuine growth beyond the old credit (Nalati `gear.ts`,
for example). The CSV retains both facts.

The historical attribution evaluates the pinned current rules on 2,911
source revisions and joins all historical ratchet changes on their Git
ancestry. It identifies the start of the current uninterrupted raw excess,
not an old CI failure. Current package exports, vocabulary and rule logic
remain fixed, so the CSV calls these **candidates**. Six rows cross a
historical parse/read refusal; one raw timer report is natively suppressed.
The concrete source changes above were separately inspected.
No fabricated first-bad SHA or historical lane attribution fills a gap.

Close D53/D94 only after a covered actual full CLI on clean HEAD is green.
The current audit establishes neither that verdict nor permission to
rebaseline real violations.
