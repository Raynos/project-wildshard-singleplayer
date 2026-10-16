# Driftwood Safari: first regression attributed

2026-10-16. Attribution only; no runtime change shipped.

The first bad commit is **`c5b1f0b2f`**, “require native swords”. Its
immediate parent `eb23978d4` has the same measurement settings, draw
counts and triangle counts. The pickup-only control keeps mandatory
native arms and the removed fallback rig; only pickup materials change.

| Build / control | Spawn work p95 | Wreck | Beach |
| --- | ---: | ---: | ---: |
| Old endpoint `fea49ae28` | 7 ms | — | 7 ms |
| Immediate parent `eb23978d4` | 10 ms | 9 ms | 10 ms |
| First bad `c5b1f0b2f` | 17 ms | 16 ms | 16 ms |
| First bad + old raw pickup | 9 ms | — | 10 ms |
| First bad + admitted toon-family pickup | 10 ms | 9 ms | — |
| HEAD baseline `68cd273ea` | 15 ms | 17 ms | 18 ms |
| Current HEAD + toon-family pickup | 17 ms | 15 ms | 19 ms |
| Current HEAD + old raw pickup | 16 ms | 18 ms | 19 ms |

The two pickup graph surfaces introduce the first **6–7 ms** jump.
Reverting them alone no longer recovers current HEAD: the later graph-port
window retains additional cost. Individual later commits are not attributed.
Neither current candidate meets the coordinator's **at least 3 ms** gain
bar. Both source drafts were discarded. Remaining graph per-draw work stays
in the G436/G437 end-of-plan pass. No look change or floor recovery is claimed.

Every case uses the same plain Safari standing harness: phone tier, 2×,
Developer on, muted, live clock, 120 frames per view after 2 seconds,
no profiler or GL observer, under bounded quiet windows. Camera scanning
can choose different authored views. Isolated HEAD cadence was 34–36 ms;
it did not reproduce every 44–45 ms milestone reading. **Work p95**, not
cadence, determines this attribution. Settings match across the adjacent
pair; telemetry timestamps and sub-millimetre spawn settling differ.

Historical builds used an approved scratch-only generation adapter:
Driftwood/shared jobs and packing, retaining producer pins and refusals.
One missing foreign compile-source JSON required its full official producer.
Current-HEAD controls used stock builds. The shared HEAD never moved.
[receipt.json](receipt.json) retains all normalized readings, including the
mixed gull reading and repeat. No scratch harness, gate change or runtime
experiment is committed.
