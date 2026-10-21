# SHARD-PLATFORM Simulator queue (G549, Jake 2026-10-21)

One lane runs every iOS Simulator job: **sp-o5** (from its next task boundary, G492). Every other lane adds a row
here and moves straight to its next ready-queue row; no lane waits on the Simulator.

**Requesting:** append one row with a pathspec commit (`docs(sim): request <what>`), then send `wildshard-new` one
line. Give the exact SHA (committed; the owner never builds uncommitted work), the exact command
(`scripts/frame-floor.mjs …`, soak, memory or loading-calibration script, with `--ktx2-probe=skip` per G386), and the
numbers you need back.

**Owner:** batches requests per build (one served preview, one primed device: wait on `tmp/sim-primed`), runs them
through `scripts/sim-lane.sh`, quiet window (`.git/quiet`, ≤ 10 min, no push running) for official readings, and
answers each row in place with the numbers, receipt path and SHA, then herdr-tells the requester one line.

| # | Requester | SHA | Command / scenario | Numbers wanted | Status / answer |
|---|---|---|---|---|---|
| S1 | sp-o1 (O16 Pine drive p95 + cold stall) | 71f4c966135dd24472be7cd43901f840e2067936 (has bc7e546659) | quiet, one devserver preview of the SHA: `node scripts/frame-floor.mjs --rev=<SHA> --shards=grid --surface=sim --grid-scenario=cell --grid-cell=pine-hollow --devserver --gl-observer=off --ktx2-probe=skip --task-clock --serve-base=<preview>` and the same with `--grid-scenario=cold` | per run: travel / whole-drive / interior p95 and max, crossing time, drive `longFrames.at`, `entryPreparation.stages` (with `endAt`) and `nodeBuilds`; keep both raw frame-floor JSONs (task-clock `tasks`) and give their paths: sp-o1 bins the > 36 ms frames by preparation stage to pick the cut | open |
| S2 | sp-o4 (O15 Driftwood drive p95) | 71dfa5f6cac7433171b2debd2063fc581bb769fa (has O15 b4298c8895, 16829329cc, 562edf7cb3, 390b718ba4, 879f11048, 5ebb1d742; bc7e546659; O20 56304b9735) | quiet, twice on one devserver preview of the SHA: `node scripts/frame-floor.mjs --rev=<SHA> --shards=grid --surface=sim --grid-scenario=milestone --devserver --gl-observer=off --grid-routes=driftwood-isle-road-entry --ktx2-probe=skip --serve-base=<preview>` (the protocol of receipt 451c545177, drive p95 43 ms) | per run: whether the crossing completed (no 'stalled in before-warm'), travel / whole-drive / interior p95, p99, max, drive frames and `longFrames.over50Ms`, `over35Hooks`, `nodeBuilds.byHook`; the raw JSON paths. Target: drive p95 <= 35 ms | open |
