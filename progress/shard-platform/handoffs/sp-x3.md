# sp-x3 handoff — 2026-10-08, active after un-throttle

- Signal Dunes floor complete on origin `e632fe913`: 426.104 s, aggregate RED,
  20/22 cadence rows pass. Desktop home spawn p95 33.3 ms; Simulator Sun re-entry
  travel p95 36 ms. All four route witnesses per surface complete, errors0,
  context loss0, CPU checks all pass. No graphical edits. Raw JSON and receipt:
  `progress/frame-floor/e632fe913-68305-1791477955945.json` and
  `progress/shard-platform/sf50-sun-floor-e632fe913.md`.
- Next: one queued current-origin preview for SF57 Developer subset D/P/N/template,
  light c132 observer/coalesced exact-state journal, raw tracing/stacks OFF.
  Five-minute rehearsal then 30-minute failure-inclusive soak under coordinator
  GPU quiet, after the queued loading audit releases the Simulator. No rendering,
  shader or look fixes in this lane; report those to wildshard-new.
- Pine P0 proven by sp-x4: `d77c83b84` + `f9e50f6fb`, standalone/grid WebKit
  actual D→road→Pine green. Both are included in e632. Prior failed soak artifacts
  remain committed; full-catalogue, road-only and shipped coverage stay open.
- HOVER E459 shipped: `8f1918525`, receipt `c932ce846`, actual touch4/4 and
  focused7/7. SF57 shipped route fix `cef43b993` shipped, route tests15/15.
- No owned browser/Simulator/live preview or queued heavy job after Sun floor.
  The harness stopped its own :4401; any later :4401 is foreign.
- Scratch: `/private/tmp/claude-501/sp-builders/sp-x3/sun-floor-e632fe913/run.log`;
  completed E459 scratch remains expendable (its rm-rf cleanup was rejected).
- Shared source files clean/released. Private-index CAS only; coordinator pushes,
  no plan edits, never message wildshard-v.
