# Memory saver defaults in Developer

E451 / E435. Source `1f84c55dc`, token-fence change `b38c036a4` (each raw report retains its harness revision).
Absent picks now default ON in Developer and OFF publicly. Explicit saved OFF/ON remains an override in Developer; public sessions ignore saved ON. Unrelated preference writes preserve an implicit default. The existing reload row stays available.

| Surface | Poses | Raw median fps | Worst p95 | Worst content-owner CPU p95 |
|---|---:|---:|---:|---:|
| desktop | 12/12 PASS | 59.88 | 16.8 ms | 0.900 ms |
| sim | 12/12 PASS | 30.303 | 34 ms | 3.000 ms |

All four shards (Driftwood, Pine, Nalati and grid) witnessed device Developer `true` and saved Memory saver `on`; zero page errors or context losses. The settings tests separately prove the absent-pick default, explicit overrides, invalid picks, public fence and mode notifications.

The first report retains all outcomes: its desktop section passed, while standalone Simulator evaluation refused clock-origin differences. The retry reuses the existing per-document random token fence: same-document clock drift is recorded, a new token still fails, and commands are never replayed. The complete Simulator retry replaces all first-attempt Simulator results. Its final grid-crossroads p99 reached 45 ms near a coordinator-reported external browser launch, so a further isolated grid-only retry supplies the accepted Simulator grid section. The isolated grid retry still had a crossroads p99 of 43 ms (versus 45 ms before); this tail persists without the external browser, while its median/p95 and content CPU meet the floor. Both reports are retained; thresholds stay unchanged. This is no rebaseline or FPS threshold change.

Reproduction (each command owns lanes and cleanup):

```sh
node scripts/frame-floor.mjs --shards=driftwood-isle,pine-hollow,nalati-grasslands,grid --surface=both --rev=1f84c55dc --setting=memorySaver=on
node scripts/frame-floor.mjs --shards=driftwood-isle,pine-hollow,nalati-grasslands,grid --surface=sim --rev=1f84c55dc --setting=memorySaver=on
node scripts/frame-floor.mjs --shards=grid --surface=sim --rev=1f84c55dc --setting=memorySaver=on
```

The harness seeds Developer using the schema's boolean `true`, rather than a string device-save override. The accompanying JSON links both raw reports and their exact source/harness pins. Latest clean export: 855 files / 5,034 tests passed, 14 skipped; root and script strict checks, typed lint and private-index guards passed. Simulator readings do not establish physical iPhone fps or memory caps; the public default remains OFF.
