# Ruler readings

`oneFrameLooks` grades the completed, error-free Simulator grid entry and
its look/travel/whole-drive windows: no reload or hole in the route witness,
no context loss or skipped sample, and no observed frame above 200 ms.
The composite frame test's `pass` also includes FPS and CPU limits; it does
not decide this visual criterion.

`frameFloor` is a separate per-shard criterion, with its own evidence and
six-shard total beside M2. Every relevant grid window must meet p95 ≤ 35 ms
and rounded median ≥ 30 fps on Simulator, or p95 ≤ 17.5 ms and rounded
median ≥ 60 fps on desktop. Missing timings remain unknown. Only exact-SHA,
plain, quiet receipts qualify for either frame criterion. Native memory
keeps its existing independent qualification.

Frame floor does not enter M2's visual-readiness aggregation or change the
60% M3 + 40% M2 plan formula. Memory and frame limits are unchanged.

The existing `fc38b2e417` snapshot gained explicit unknown frame-floor fields;
its revision, source counts, history, M2 and plan percentages are unchanged.
Future ruler runs populate the new fields from qualified receipts.

Report-only ruler runs isolate product failures and still measure healthy
shards' structural/grid criteria. The failed product records its error
and cannot keep an old product in the ownership census. When any verified
section inventory is unavailable, G294 shared-user attribution, custom
percentages and M3 remain unknown, including the error, rather than stale
or zero. History omits unknown points and port badges omit unknown shares.
The plan keeps its 60% M3 + 40% M2 weights with a range for the unknown M3.
Ordinary app/catalog builds and `--check` remain strict.
