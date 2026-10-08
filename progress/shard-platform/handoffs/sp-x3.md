# sp-x3 handoff — 2026-10-08, active soak retry

- Sun floor receipt `2ed39b862` shipped: pin e632, 426.104 s, 20/22 cadence
  rows pass, aggregate RED. Desktop home p95 33.3 ms; Simulator Sun reentry
  travel p95 36 ms. All eight route witnesses complete, CPU passes, no errors/loss.
  `progress/shard-platform/sf50-sun-floor-e632fe913.md` has exact raw JSON link.
- SF57 dry5 FUNCTIONAL PASS316.270s, actual D→P→N→template→D, errors0/loss0,
  sampling/calibration/leakZero pass, peak WC+GL993.183MB. Partial warm-up lap,
  no qualifying/full-catalogue clearance. Durable raw data/summary/receipt under
  `progress/memory/sf57/e632fe913-dev-subset/`.
- THIRTY-MINUTE driver is active through sim-lane after an intervening template
  floor. Fresh owned device `sf57-sp-x3-dev-e632-soak`, unified session59725.
  Scratch `/private/tmp/claude-501/sp-builders/sp-x3/sf57-e632fe913-retry/soak`.
  User authorized dry5 then30; Developer prepared D/P/N/template subset only,
  light observer/coalesced journal, raw OFF. No graphical fixes: report to owner.
- ONE owned preview :4401, PID/PGID10061, HTTP/disk e632fe9-muzs3wpn; root
  `/private/tmp/claude-501/sp-builders/sp-x3/sf57-e632fe913-retry/serve/20261008-115519-4401`.
  Both parents use --borrowed-preview to retain this own server between runs;
  explicitly stop :4401 after final capture. Expiry18:57UTC, enough for current run.
- Machine load logger session72038/PID71214, 10-second samples. Finish by creating
  scratch `STOP_LOAD`, then preserve machine-load.jsonl and note desktop overlap.
- Next: preserve full30 result and all failures with gzip hashes, report per-lap
  WC+GL, allocator and GPU separately; commit exact evidence+receipt by private
  index/CAS/hooks and verify ancestry. Coordinator alone pushes. Clean only own
  clients/preview/scratch; never touch another preview occupying a reused port.
- Pine P0 proven d77c83b84+f9e50f6fb (both in e632). HOVER shipped8f1918525
  +c932ce846, touch4/4. SF57 shipped route fix cef43b993, route tests15/15.
- No source WIP owned; no plan edits; never message wildshard-v.
