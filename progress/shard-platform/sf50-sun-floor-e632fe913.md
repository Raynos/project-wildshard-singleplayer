# Signal Dunes entered-grid floor — retained red result

Pin: `e632fe9132d626335143155841236e8898f66a76` (origin at start).
Raw evidence: [frame-floor JSON](../frame-floor/e632fe913-68305-1791477955945.json).

```sh
node scripts/frame-floor.mjs --rev=e632fe9132d626335143155841236e8898f66a76 --shards=grid --surface=both --developer=on --grid-scenario=sun-entry --setting=memorySaver=on
```

Completed in **426.104 s**, exit **2**, aggregate **FAIL**; 20/22 cadence rows
pass. All four route witnesses per surface completed: road entry, authored
spawn, road return, re-entry. Signal Dunes is resident at each entered stop;
the road return has no active resident. CPU ownership passes all 22 rows;
page errors 0, context loss 0, skipped measured frames 0.

| Surface / measurement | Median fps | p95 ms | Result |
| --- | ---: | ---: | --- |
| Desktop home spawn | 59.88 | 33.3 | FAIL (17.5 ms limit) |
| Desktop other standing views | 59.88 | 16.7 | PASS |
| Desktop all 8 Sun travel/interior rows | 59.88 | 16.7–16.8 | PASS |
| Simulator Sun re-entry travel | 30.303 | 36 | FAIL (35 ms limit) |
| Simulator other 10 rows | 30.303 | 34 | PASS |

Long tails remain in the raw record: Sun first-entry travel p99 is **83.3 ms
desktop / 1173 ms Simulator**; re-entry travel p99 is **66.6 / 633 ms**. The
p95 grader does not erase these stalls. No rebaseline, quarantine, threshold
change or renderer change was made. This is a complete red attempt, not a
floor clearance. Other lane-owned browser work ran on the machine; contention
is a possible cause, not a demonstrated explanation.

Desktop measures 1440×900 at 2×; Simulator measures Mac-backed Mobile Safari
with the phone tier and 2× scale. Simulator results are not physical-iPhone
performance evidence. The harness owns its pinned preview and lane cleanup;
all owned resources closed after the run. The queued loading audit acquired
the Simulator afterward. The coordinator owns routing any graphical fix.
