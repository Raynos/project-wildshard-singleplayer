# E452 — why only Driftwood appeared playable

2026-10-07, sp-x2. Public production `/version.json` still reports **316e175c-muumf0z9**, built 2026-10-05. A muted iPhone 16 Pro browser on that URL has the old shard-select title and no INFINITE entry. The coordinator confirmed that subsequent Linux CI failures prevented promotion. The SF60 observation pin **b64c2a908** has the same grid admission gates and Developer substitutions as the tested **ccc61236e** HEAD.

## Cause per cell

Coordinates are catalogue x/z cells. Developer is on, as required to show INFINITE today.

| Cell | Instance | HEAD result / cause |
| --- | --- | --- |
| (0,0) | Driftwood | Normal borrowed home; admits and plays. |
| (-1,1) | template-1 | Real outward and return transfer succeeds. |
| (0,1) | Pine Hollow | Manifest has no shardfile. Intentional M3 proxy, not an images-first memory refusal. |
| (1,1) | template-2 | Real outward and return transfer succeeds. |
| (-1,0) | Sunscar Dunes | Intentional Developer replacement of public template-3; no shardfile, waits for M3. Label matches the assembled catalogue. |
| (1,0) | Nalati | No shardfile; waits for M3. The endless Loading message was misleading. |
| (-1,-1) | template-4 | Real outward and return transfer succeeds. |
| (0,-1) | Sky Reach (`far-reach`) | Intentional Developer replacement of public template-5; no shardfile, waits for M3. |
| (1,-1) | template-6 | Real outward and return transfer succeeds. |

Public catalogue: template-3 and template-5 replace the two Developer cells. They use the same admitted `_template` product. No descriptor, budget, catalogue placement or M3 gate was changed.

## Isolated source fixes

- **0928093c3**: a metadata-only `prefetchable` port excludes unsupported far proxies before taking the three cold candidate slots. Previously the three closest unconverted cells consumed every slot at the home spawn. Native default behaviour, resident count, cold distance and admission remain unchanged.
- **1186cf2ac**: the existing wall panel says **NOT READY FOR GRID / ENTER THROUGH SHARD SELECT**, without a fake progress bar, for known unconverted cells. Genuine loading and refusal messages retain their existing behaviour and panel position.
- **cfd133f4f**: the same waiting read also consumes the original typed M3 error for a descriptor with an unsupported hybrid runtime.

## Witnesses

One muted Chromium/Metal phone browser at a time, through `scripts/browser-lane.sh wait`, entered by the actual title tap on `serve-build.sh --head`. Settings Developer was seeded in the device save, with `touch&tier=phone&mute=1&sw=0`. No gameplay URL switch.

On **ccc61236e**, `driveGridSeam` from `scripts/physics-grid.mjs` drove each corner: home → highway → template → highway → home at a requested 15 m/s. **Four round trips, sixteen frame commits, zero stuck legs, zero template admission issues, zero page errors**. Only each leg's starting pose was placed; movement thereafter used the actual input, player and physics. Full traces are in `head-corner-traces.json.gz`. This is an admission/transfer witness, not a replacement full physics-baseline pass: diagonal home corner routes can sample the existing lowered home terrain below road y=0.

On patched **40cc62809**, three templates warmed without a request/refusal storm. The player drove to Nalati's real closed wall; telemetry reports `status: waiting`, no pending request and no admission issues. The playing admission readout was **906.13 MB / 1000 MB**. The screenshot retains the unchanged wall, panel and HUD. It is not a physical-phone memory measurement.

`pnpm exec vitest run test/live-grid-waiting.test.ts test/grid-soft-wall-waiting.test.ts test/live-grid-admission.test.ts test/live-grid.test.ts test/live-grid-save-fence.test.ts test/grid-assembly.test.ts`: **15/15**. Scoped type-aware oxlint and root `tsc --noEmit --incremental false`: green. The canvas witness checks waiting, refusal precedence, retry/loading and wall opening; the native witness checks in-bound warming, no out-of-bound allocation, no repeated unsupported fetch and closed unsupported readiness.

Browsers and both owned previews closed. Source and this evidence await the coordinator's serialized green push. Jake's playable grid build must include these commits and the CI repair; the current production 316e175c does not. M3 conversions and the newly picked G217 full Developer 3D loading screen remain separate plan work.
