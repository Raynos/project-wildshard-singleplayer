# Simulator loading calibration

Measured served SHA: `47f83b6acab324b1ab5e05cb7e3b98d896dfa326`.
Muted iPhone 16 Pro Simulator through sim-lane; one cold HTTP origin per path.

| Path | Wall / measured stages (s) | Purpose |
|---|---|---|
| SHARD SELECT shardfile | 14.4 / 14.471 | current per-stage baseline |
| Grid entry | 14.9 / 14.915 | current per-stage baseline |
| Legacy entry | 17.3 / 17.337 | legacy per-stage baseline |

The composition root supplies these actual row durations to the weighted bar.
Like-for-like device history blends subsequent measurements. Crossing has no
full-panel progress bar; its diagnostic reports actual transition durations.

These are calibration receipts, **not final Phase 1 acceptance**. Legacy's
older accounting was short 27.44% and cadence reached 1274 ms; both failures
are retained in JSON. The source now replays early worker receipts and slices
complete schema checks. The phone-grid 1073 ms cadence failure also keeps the
six-case accuracy milestone open. New source requires a new served proof.

Every compact receipt includes the raw measurement digest and actual rows.
