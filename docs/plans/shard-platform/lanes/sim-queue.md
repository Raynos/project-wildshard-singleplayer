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
