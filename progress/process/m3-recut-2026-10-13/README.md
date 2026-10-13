# SHARD-PLATFORM M3 re-cut: component milestones (proposal for the plan agent)

Jake, 2026-10-13: *"Can you write your recommendation as a file down so I can give it to the planner agent and he can
recut M3 into component milestones?"* Written by a read-only audit session from git, the plan folder, the process audits
and the coordinator and plan-agent transcripts. The plan agent (wildshard-v) owns the re-cut; this file is the input, not
the plan.

## 1. Why re-cut

| Evidence | Source |
|---|---|
| Sky custom 86 % (10-07) → 81 % (10-12 21:30) in five days and ~3,000 commits; Signal 87 % → 82 % | `progress/shard-platform/split-history-2026-10-13/README.md` (`aa0007f30`) |
| The 12 h sprint then took Sky 81 → 51 % and Signal 82 → 46 %; flat again since 10-13 05:30 (Sky −201 lines, Signal −106) | same |
| The sprint's biggest drops were **shared components**, not single-shard ports: one creature-body loader (`14a757da1`, `02e371386`), one NPC host (`7fd5bd161`), lash and fan on move rows (`0e00aa4e7`), looks as data rows (`dc986514b`, `d9112c821`), shared map palette (`56af303ec`) | same, "The biggest moves" |
| The plan is shard-major: §4 C is one row per shard (SF46–SF51) and the systems are "pulled by their conversion rows", so each shard rediscovers and half-builds the same system | `docs/plans/shard-platform/rows.md` §C |
| Scope creep inside the plan: ~400 decisions (G1–G400), a 644 KB plan folder, Template 2, the dev-texture look, the menu hero board (6 lanes, $127), Pine KTX2, the near tier, deploy plumbing | `decisions.md`, `usage-audit-2026-10-13` finding 6 |
| 80/20 is a waypoint: `runtime/` never ships to the MMO, so the "nasty 20 %" is exactly what decides MMO compatibility, and the plan defers it to successor plans (C38) | `SHARD-PLATFORM.md` §0, §C |

Rule G391 ("every legacy builder becomes a generator, all shards") is already a component milestone. This re-cut makes
that the shape of all of M3.

## 2. The rules of the re-cut

1. **The unit of work is a component across all seven shards, not a shard.** A component milestone is done when
   (a) the format / SDK / game supports it as data, generators or approved systems, (b) every shard's instances use
   that path, and (c) every custom line for that component is deleted in every shard, including its legacy path.
   That is **100/0 for that component**. A shard is never half on a component.
2. **The shard definition is valid at every step.** Each milestone leaves every shard booting, playable and passing
   validate. Legacy code for a component keeps running until that component's milestone closes; then it is deleted in
   one commit set, everywhere.
3. **Discovered work is routed, not built.** Anything found mid-milestone that belongs to another component becomes a
   line in that milestone's row and waits. If no milestone fits, append a new component row. Nothing orthogonal is built
   in the current milestone. The coordinator labels each finding with its component when it lands in STATE.
4. **The headline metric changes.** STATE leads with **components closed N of M** and **custom lines left per
   component** (all shards summed), not the per-shard custom %. Per-shard 80/20 falls out of it and stays as a
   secondary line.
5. **Lanes own components, so they own disjoint files.** At most 2–3 milestones in flight; one component per lane.
   This also cuts the cross-lane stale-bake reds (§5).
6. **Each milestone closes with one check per shard for its component**: a labelled capture board when the look
   changes (G112), a behaviour check otherwise (a fight finishes, a quest completes, a mover arrives). Exact-value tests
   the component touches (byte totals, closure counts, code-shape snapshots) become bounds or behaviour tests inside
   that milestone.

## 3. Milestone 0: the component inventory (do this first, hours not days)

Tag every remaining custom line in all seven shards (the same lines `scripts/shard-platform.mjs` counts as custom:
shard TS, sole-platform code, extra GLSL) with exactly one component, and make the script report custom lines per
component. Extend `generator-inventory.md` rather than start a new file. This is the denominator for every milestone
and the thing that tells you the true size of "the nasty 20 %". Today's starting points: Sky `runtime/` 1,360 lines
(largest: `index.ts` 357, `weapons/coneFan.ts` 167, `looks/windFx.ts` 143, `headless.ts` 115), Signal `runtime/` 1,314
(largest: `looks/fireFx.ts` 314, the lash files ~450 together, `looks/bakedGround.ts` 115, `looks/duskLook.ts` 98).

## 4. Proposed component order (the plan agent checks it against the inventory)

Dependency first: later components stand on earlier ones.

| # | Component | What closes it | Existing rows / decisions to fold in |
|---|---|---|---|
| C1 | **Static world**: terrain, props, buildings, dressing | every legacy builder is a generator; baked tiles, colliders and far proxy from the build; no runtime world code | G391, SF55a, generator-inventory, -g grid-ready parts of SF46–SF51 |
| C2 | **Looks**: materials, shaders, sky, fog, time-of-day | every material on a family or graph; sky / dusk as curve rows; no raw GLSL in shards | SF59 (graphs), SF10a families, G387 boards |
| C3 | **Effects**: particles, wind, fire, ribbons, discs | effect rows on one shared effect host | Signal `fireFx`, Sky `windFx` / `wakeRibbon` / `discLayer` |
| C4 | **Creatures**: bodies, rigs, brains, flocks, herds | shared creature loader + brain rows for every species | SF72, shared creature-body loader, far herd |
| C5 | **NPCs, dialogue and quests** | quest graph rows, quest-givers on the shared NPC host, director stages | SF27, the shared pivot NPC host |
| C6 | **Items and combat**: weapons, moves, viewmodels, bosses | move rows, item rows, one viewmodel host, boss phases as rows | lash, cone fan, Roc, Matriarch, Pine King |
| C7 | **Movers and traversal**: lifts, platforms, bridges, mounts, riding | mover rows on the fixed step; riding on SF34 | SF30, SF34, G388 |
| C8 | **Audio**: cues, ambient beds, footsteps | cue rows on the shared audio host | each shard's `audio/cues.ts` |
| C9 | **Boot glue**: persistence, ledger, headless host, `runtime/index.ts` | `runtime/` empty for every shard: 100/0 | SF46 hybrid loader, ledger, headless / replay checks |

The grid (M2) and the memory and frame-floor proofs stay where they are; they are not components of a shard.

## 5. Tests and the push (Jake's second question, same day)

Jake asked whether pixel-matching regression tests built for porting are what kills the pushes. Measured:

- **Pixel parity is not in pre-push.** Since G363 (`e11091664`, 10-12 22:06) pre-push is changed-file typecheck and
  lint plus ≤ 45 s of affected vitest (`scripts/local-gate.py`, `scripts/local-gate-checks.mjs`). Auto-push: before
  G363 8 ok / 34 red; after, 273 ok / 49 red. Parity runs only in the nightly `gpu-gate` and in boot-smoke.
- **The red moved to push CI.** Of the last ~60 `deploy.yml` runs (10-13 10:00–13:00 UTC) 1 succeeded, ~45 failed,
  5 were cancelled. The failing steps: `bake-check` (committed bakes no longer byte-exact, e.g. Sky
  `world-bake.test.ts` "every committed piece is byte-exact"; generated docs stale, e.g.
  `docs/design/webgpu-port-inventory.md`), `engine-docs.test.ts`, `frame-floor-fixture.test.ts`, `row-data.test.ts`
  and Nine `layout-file.test.ts`. The deploy ships only CI-green SHAs, so production holds.
- **The red log** (`red-green.md`, 146 rows 10-11 → 10-13): stale bakes / regeneration ~48, typecheck / lint ~28,
  CI / Linux ~18, receipts ~13, exact values ~12, parity / look ~8. One parity red was a real live bug (Nine's phone
  sounds), so parity earns its nightly slot.

So the killer is **committed, byte-exact derived outputs** that go stale when another lane changes a shared input,
not pixel tests. For the re-cut: each component milestone owns the bakes and generated files of its component, and
the usage audit's cut 2 (bakes regenerate at commit for the shards whose inputs changed, or build in CI and stop
committing the cheap ones) should land before C1 starts, because C1 changes every shard's bake inputs.

## 6. What the plan agent does with this

1. Run milestone 0 (the inventory and the per-component metric), or staff it as the first row.
2. Rewrite `rows.md` §C as component rows C1–C9 (or the order the inventory supports). Map every open SF46–SF51 exit
   and every "systems" row to one component; mark the per-shard rows superseded.
3. Replace the Sprint 2 per-shard step lists with the active component milestones; lanes take components.
4. Change the STATE headline to components closed and custom lines per component.
5. Put the scope that is not a component of M3 (Template 2, the dev-texture look, the menu hero board, the near tier)
   into a short "paused or elsewhere" list for Jake to confirm.
6. Ask Jake, with option 1 Skip: **does Part A now end at 100/0 per component (runtime/ empty) instead of 80/20 per
   shard?** Recommended: yes. 80/20 left the hard 20 % to successor plans; component milestones are how the hard part
   gets designed rather than deferred.
