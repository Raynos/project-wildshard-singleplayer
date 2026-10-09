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

**Owner (Jake, 2026-10-09):** the plan agent runs SF74 with an Opus subagent; the coordinator pushes its commits through the serialized pusher. **Deploy cadence stays hourly** (Jake: *"Hourly is fine"*); W0 fixes the stuck path, not the schedule.

| # | Change | Owner | Needs Jake | Status |
|---|---|---|---|---|
| W0 | **Prod unstuck**: a red push CI blocks every release (deploy ships the newest CI-green main). Fix the red test first, always; the coordinator checks `version.json` against origin hourly and runs `gh workflow run deploy` when they differ. **The deploy job re-runs the whole `pnpm test` on a commit whose push CI already passed** (`.github/workflows/deploy.yml` "Test": 20+ min on 2026-10-09 19:59): skip it for a CI-green pin and keep only the build + chunk check + production verify | plan agent (Opus) | no | in flight: sp-x5 (deploy.yml: no duplicate full test for a CI-green pin), plus `697fca989` exact smoke dispatches the deploy (local, pushing next) |
| W1 | Lanes land on quick checks of what they touched; the push gate is the only full suite (reach the Codex briefs too: 14 lane suites ran the hour after the cut) | plan agent (Opus) | no | done: broadcast to all Codex lanes 2026-10-09 (no builder full suites; push gate is the only full suite) |
| W2 | Take regeneration off the push lock: generated files (api-surface, docs/api, ENGINE.md appendix, layer-edges, debt counts) are built in gen / CI, not committed; drop the gate's duplicate 88 s check | plan agent (Opus) | no | decided (op-pipeline): kept committed; layer-edges + debt are shrink-only baselines, docs/api + ENGINE table are read in-repo, api-surface read by engine-docs.test; duplicate generated + ratchet gate checks removed (`d8f159aa2`, `28f5bd545`) |
| W3 | Cache gate steps by content hash; affected-only tests at push (bake-check only when bake inputs change); a full suite every Nth push or nightly | plan agent (Opus) | no | done (local, pushing): `420b061c8` content-hash step cache + affected-only vitest, full every 8th gate / 6 h / GATE_FULL=1 |
| W4 | The push gate gets its own lease, separate from the lanes' test / build leases | plan agent (Opus) | no | done (local, pushing): `693c85f5c` push-gate lease |
| W5 | No polling: one detached proof runner writes its result and pings the lane | plan agent (Opus) | no | open |
| W6 | Lanes commit directly after quick checks: no 0.7 GB clean exports or private-index landings per lane; the push re-records stale checkpoints itself | plan agent (Opus) | no | partly done: lanes commit by pathspec after quick checks (broadcast); the push re-records stale witness manifests (`ec89b2e60`, pushed); exact-tip push `d8f159aa2` |
| W7 | Fix the sim-lane reaper (~2,000 failed quit attempts in 12 h from every Stop / SubagentStop hook) | plan agent (Opus) | no | done (local, pushing): `a5dfb0242` sim-lane reaper quits once per PID |
| W8 | Heavy proofs (soak, frame floor, boot smoke, Simulator) per milestone and before a grid-changing deploy; the physics walk only after collider changes | plan agent (Opus) | **G273 yes** | rule landed `4b391c109` |
| W9 | gpu-gate nightly + milestones, not per push; lanes stop local parity re-runs | plan agent (Opus) | **G274 yes** | done (local, pushing): `476a24450` gpu-gate nightly 08:41 UTC + workflow_dispatch |
| W10 | Paperwork: one ≤ 3 KB `docs/plans/SHARD-PLATFORM/STATE.md` written only by the coordinator; no Plan-State trailer check; no per-lane handoff files; no raw soak / receipt archives in git | plan agent (Opus) | **G275 yes** | done (local, pushing): `17d4da5e5` no Plan-State check / no handoff rules / pre-commit refuses new raw archives under progress/; STATE.md lives at docs/plans/shard-platform/STATE.md (`555c2d3bd`) |
| W11 | Fleet ceiling: at most 5 Opus and 5 Codex live; Codex paced by openusage to last to its reset | coordinator | yes (Jake's rule) | landed `33bfc2f28` |

## Done when

The re-measured 12 hours meet the targets above, and production has stayed within an hour of the newest green main
for a day.
