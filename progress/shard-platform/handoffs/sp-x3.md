# sp-x3 handoff — 2026-10-09, SF57 qualifying public soak next

## Done in this landing

Rejected-pool receipt `3a4172c09` is on main. No pooled workspace, retained dictionary/capacity or timer ships. New raw-byte capture/optional durable saveBytesSteps is default-on with coordinator approval after the matched measurement. Receipt `progress/memory/sf57/checkpoint-native-bytes-2026-10-09/README.md`.

Same-parent pair93640b158 →474f3fbf7: source-mapped byteArray sampled allocations22,591,036B→0; native drive peak640.225→516.624MB, settled median538.407→505.925MB, no errors/loss, maxgap1.02s. Historical before-only spread489–498MB settled/531–605MB peak; including current control489–538MB settled/531–640MB peak. Report spread beside rule(b), do not claim a stable saving from one pair. It retains nothing by construction.

Clean full1065files/5885pass/14skip +strict/rootlint/ratchet/layers. All11 native payloads byte-identical, including the latest Pine297e99 witness; only input manifests refresh. Four real boot-smoke cases pass, faults0. Snapshot/subview freezing/interleaving/cancellation/staged/quota/re-entry/native durability fixtures green. Final source validation candidate4e94f29177d9bf9d4a93916e4b95976bf6755dd0; defining SHA95ea6414d. Shared liveSession New game WIP excluded/preserved.

## Exact next step

Driftwood input-manifest forward preserves four archives and command tape byte-identically; freshness1/1 passes. Send its SHA to wildshard-new; coordinator alone pushes. Wait for latest pushed origin carrying it, then ONE invocation:
`node scripts/soak/soak.mjs --prepare --rev=<pushed SHA> --layouts=shipped --legs=cells,road --route-scope=catalogue --qualifying --out=<fresh own scratch>`.
Driver builds ONE preview through heavy-lane, writes manifest, waits for `<out>/GO`; request coordinator GO before touching it. sim-lane queues automatically. Two30-minute legs (~60min total); light observer/raw OFF, footprint-only/no per-pose vmmap/heap snapshots, no manual eviction or GC. Keep recorded errors/failures and exact tool verdict, settled growth and peak WC+GL. Commit raw evidence + receipt under `progress/memory/sf57/public-<sha>/` with the control spread alongside rule(b). Latest old cells recorded verdict failed rule(b); regrade is not a new qualifying pass.

## Resources / cleanup

All own Chrome/Safari/Inspector/proxy/sampler closed; Simulator lane0/1. Owned device checkpoint-sp-x3-20261009 /2AA1E530-647F-4C9B-9F11-DC3E5E825EE8 is shut down. Both matched previews :4400 stopped (before PID82852, after31036); no preview remains from this step.
Scratch `/private/tmp/claude-501/sp-builders/sp-x3/checkpoint-save-2026-10-09`. Useful: typed.json/typed.patch, typed-final.json, mapped summaries, plain raw native/probe drivers and clean logs (also archived in repo). Delete finished typed-export/typed-final-export and stopped after-preview export by literal path once landing guards/readback finish. Before-preview export and rejected-pool export deleted; intrusive original heaps deleted after complete ≥64KiB owner extracts/raw hashes archived.
Land by CURRENT-HEAD private index + hooks + CAS old-value check, inspect subject/stat/ancestor. No generated files/plan edits; never wildshard-v. Coordinator pushes; Simulator/browser/heavy lanes always apply.
