# SHARD-PLATFORM: stop wasting wall-clock time (SF74)

Jake, 2026-10-09: *"Hey, did we make a brand new mini plan for how to stop wasting so much wall clock time? And how do
we get prod deployed and unstuck?"* Source: the 12-hour process audit `progress/process/audit-2026-10-09/README.md`
(138 agent-hours, ~59 h lost to the top 10 sinks, ~44 h recoverable) and Jake's G273–G275.

## Targets (measured by re-running `progress/process/audit-2026-10-09/measure.py --hours 12`)

| Measure | 2026-10-09 | Target |
|---|---|---|
| Commit → origin, median / p90 | 6.2 / 15.6 min | ≤ 2 / ≤ 5 min |
| Push cycle (gate) | ~6 min | ~1.5 min |
| Lane full test suites per 12 h | ~150 | 0 (the push gate is the only full suite) |
| Test-lease queue, median | 152–271 s | ≤ 30 s |
| Agent-hours spent polling | ~11 h | ~0 |
| Gate-only / receipt-only commits | 43 % | ≤ 10 % |
| Push CI green | 40 of 96 | ≥ 95 % (a red push CI stops every release) |
| Production age | hours | ≤ 1 h behind the newest green main |

## Rows

| # | Change | Owner | Needs Jake | Status |
|---|---|---|---|---|
| W0 | **Prod unstuck**: a red push CI blocks every release (deploy ships the newest CI-green main). Fix the red test first, always; the coordinator checks `version.json` against origin hourly and runs `gh workflow run deploy` when they differ. **The deploy job re-runs the whole `pnpm test` on a commit whose push CI already passed** (`.github/workflows/deploy.yml` "Test": 20+ min on 2026-10-09 19:59): skip it for a CI-green pin and keep only the build + chunk check + production verify | coordinator | no | in flight 2026-10-09 |
| W1 | Lanes land on quick checks of what they touched; the push gate is the only full suite (reach the Codex briefs too: 14 lane suites ran the hour after the cut) | coordinator | no | landed in the coordinator's brief; Codex briefs pending |
| W2 | Take regeneration off the push lock: generated files (api-surface, docs/api, ENGINE.md appendix, layer-edges, debt counts) are built in gen / CI, not committed; drop the gate's duplicate 88 s check | coordinator | no | open |
| W3 | Cache gate steps by content hash; affected-only tests at push (bake-check only when bake inputs change); a full suite every Nth push or nightly | coordinator | no | open |
| W4 | The push gate gets its own lease, separate from the lanes' test / build leases | coordinator | no | open |
| W5 | No polling: one detached proof runner writes its result and pings the lane | coordinator | no | open |
| W6 | Lanes commit directly after quick checks: no 0.7 GB clean exports or private-index landings per lane; the push re-records stale checkpoints itself | coordinator | no | checkpoint re-record in flight (Opus lane) |
| W7 | Fix the sim-lane reaper (~2,000 failed quit attempts in 12 h from every Stop / SubagentStop hook) | coordinator | no | open |
| W8 | Heavy proofs (soak, frame floor, boot smoke, Simulator) per milestone and before a grid-changing deploy; the physics walk only after collider changes | coordinator | **G273 yes** | rule landed `4b391c109` |
| W9 | gpu-gate nightly + milestones, not per push; lanes stop local parity re-runs | coordinator | **G274 yes** | rule landed `4b391c109`; CI workflow change open |
| W10 | Paperwork: one ≤ 3 KB `docs/plans/SHARD-PLATFORM/STATE.md` written only by the coordinator; no Plan-State trailer check; no per-lane handoff files; no raw soak / receipt archives in git | coordinator | **G275 yes** | rule landed `4b391c109`; `scripts/asks.mjs` change open |
| W11 | Fleet ceiling: at most 5 Opus and 5 Codex live; Codex paced by openusage to last to its reset | coordinator | yes (Jake's rule) | landed `33bfc2f28` |

## Done when

The re-measured 12 hours meet the targets above, and production has stayed within an hour of the newest green main
for a day.
