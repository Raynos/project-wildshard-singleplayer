# SHARD-PLATFORM M3 re-cut: component milestones in three waves (proposal for the plan agent)

Jake, 2026-10-13: *"Can you write your recommendation as a file down so I can give it to the planner agent and he can
recut M3 into component milestones?"* And: *"please respect that right now we are focused on a heavy sprint where we
just try and get Skyreach and Dunes to the 80-20 or 90-10 split. … The first wave is Skyreach and Dunes. And the second
wave is Driftwood, Nalati, Pinewood. And the last wave, the third wave, is Nine Dragon. … I think the component
breakdown is great. But we can't cross-cut against all seven shards on a per component basis, because it's a fucking
lot, bro."*

Written by a read-only audit session from git, the plan folder, the process audits and the coordinator and plan-agent
transcripts. The plan agent (wildshard-v) owns the re-cut; this file is its input, not the plan.

## 1. Why re-cut

| Evidence | Source |
|---|---|
| Sky custom 86 % (10-07) → 81 % (10-12 21:30) in five days and ~3,000 commits; Signal 87 % → 82 % | `progress/shard-platform/split-history-2026-10-13/README.md` (`aa0007f30`) |
| The 12 h sprint then took Sky 81 → 51 % and Signal 82 → 46 %; flat again since 10-13 05:30 (Sky −201 lines, Signal −106) | same |
| The sprint's biggest drops were **shared components**, not single-shard ports: one creature-body loader (`14a757da1`, `02e371386`), one NPC host (`7fd5bd161`), lash and fan on move rows (`0e00aa4e7`), looks as data rows (`dc986514b`, `d9112c821`), shared map palette (`56af303ec`) | same, "The biggest moves" |
| The plan is shard-major: §4 C is one row per shard (SF46–SF51) and the systems are "pulled by their conversion rows", so each shard rediscovers and half-builds the same system | `docs/plans/shard-platform/rows.md` §C |
| Scope creep inside the plan: ~400 decisions (G1–G400), a 644 KB plan folder, Template 2, the dev-texture look, the menu hero board (6 lanes, $127), Pine KTX2, the near tier | `decisions.md`, `usage-audit-2026-10-13` finding 6 |

The per-shard sprint steps already work best where they are really components (G391, "every legacy builder becomes a
generator", is one). This re-cut makes components the shape of each wave.

## 2. The waves (Jake's order)

| Wave | Shards | Finish line | Status |
|---|---|---|---|
| **W1** | Sky Reach (`far-reach`), Signal Dunes (`sunscar-dunes`) | 80/20, stretch 90/10 (Jake) | **now**: Sprint 2 (G400) |
| **W2** | Driftwood Isle, Nalati Grasslands, Pine Hollow | 80/20 | after W1 |
| **W3** | Nine Dragon Stack | 80/20 | last |

Template 1 is done; Template 2 and Pastel are outside the waves. A component milestone covers **only the shards of the
current wave**, never all seven. W1 builds each component for two shards; W2 reuses and extends it for three; W3 for
Nine. Each wave starts with the components the previous wave left, so the later waves are mostly adoption.

## 3. The rules inside a wave

1. **The unit of work is a component across the wave's shards.** A component closes when (a) the format / SDK / game
   supports it as data, generators or approved systems, (b) every shard in the wave uses that path, and (c) every custom
   line for that component is deleted in those shards, legacy path included. That is **100/0 for that component in
   that wave**. The wave reaches 80/20 or 90/10 when enough components close; whatever custom code is left sits inside
   named open components, so the remainder is a known list, not a mystery tail.
2. **Every shard stays valid at every step.** Each milestone leaves the wave's shards booting, playable and passing
   validate. Legacy code for a component keeps running until that component closes, then goes in one commit set.
3. **Discovered work is routed, not built.** A finding that belongs to another component becomes a line in that
   component's row and waits. A finding in a shard of a later wave goes to that wave's list. Nothing orthogonal is built
   in the current milestone.
4. **The headline metric**: per wave, **components closed N of M** and **custom lines left per component**, beside the
   per-shard custom % that the 80/20 bar still reads.
5. **Lanes own components, so they own disjoint files.** At most 2–3 components in flight, one per lane. This also cuts
   the cross-lane stale-bake reds (§6).
6. **A component closes with one check per shard in the wave**: a labelled capture board when the look changes (G112),
   a behaviour check otherwise (a fight finishes, a quest completes, a mover arrives). Exact-value tests the component
   touches (byte totals, closure counts, code-shape snapshots) become bounds or behaviour tests in that milestone.

## 4. W1 milestone 0: the component inventory for Sky and Signal (hours, not days)

Tag every remaining custom line in Sky and Signal (the lines `scripts/shard-platform.mjs` counts as custom: shard TS,
sole-platform code, extra GLSL) with exactly one component, and make the script report custom lines per component.
Extend `generator-inventory.md` rather than start a new file. This sizes each component and shows which ones W1 must
close to cross 20 % and 10 %. Starting points: Sky 3,407 custom lines, bar 1,355; Signal 1,860, bar 824. Sky `runtime/`
is 1,360 (largest: `index.ts` 357, `weapons/coneFan.ts` 167, `looks/windFx.ts` 143, `headless.ts` 115), Signal
`runtime/` 1,314 (largest: `looks/fireFx.ts` 314, the lash files ~450 together, `looks/bakedGround.ts` 115,
`looks/duskLook.ts` 98). W2 and W3 run their own milestone 0 when they start.

## 5. Proposed components (W1 checks the order against its inventory)

Dependency first: later components stand on earlier ones. The W1 column maps the current Sprint 2 steps and lanes.

| # | Component | Closes when | W1 today (Sprint 2, STATE) |
|---|---|---|---|
| C1 | **Static world**: terrain, props, buildings, dressing | every legacy builder is a generator; tiles, colliders and far proxy from the build; no runtime world code | G391; o123 Signal world → tiles; o120 Sky world → tiles |
| C2 | **Looks**: materials, shaders, sky, fog, time of day | every material on a family or graph; sky / dusk as curve rows; no raw GLSL in shards | o121 Signal graphs; o120 Sky graphs, sky rows (G387 boards) |
| C3 | **Effects**: particles, wind, fire, ribbons, discs | effect rows on one shared effect host | o122 effects paired (Sky step 9); Signal `fireFx` |
| C4 | **Creatures**: bodies, rigs, brains, flocks | shared creature loader + brain rows for every species | x6 creatures |
| C5 | **NPCs, dialogue and quests** | quest graph rows, quest-givers on the shared NPC host, director stages | x6 quest; x5 quest → director stages |
| C6 | **Items and combat**: weapons, moves, viewmodels, bosses | move and item rows, one viewmodel host, boss phases as rows | x1 lash → melee row; x8 war fan, Roc re-record |
| C7 | **Movers and traversal** | mover rows on the fixed step | x1 movers; x4 Sky movers (G388) |
| C8 | **Audio**: cues, ambient beds | cue rows on the shared audio host | each shard's `audio/cues.ts` |
| C9 | **Boot glue**: persistence, ledger, headless host, `runtime/index.ts` | whatever is left in `runtime/` is only what the wave's finish line allows | x5 glue → rows; x6 glue |

The sprint does not stop: its lanes keep their work and are relabelled by component, so each lane's steps become one
component for both shards instead of a numbered step for one shard. The grid (M2) and the memory and frame-floor proofs
stay where they are; they are not shard components.

## 6. Tests and the push (Jake's second question, same day)

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
not pixel tests. For the re-cut: each component owns the bakes and generated files of its component, and the usage
audit's cut 2 (bakes regenerate at commit for the shards whose inputs changed, or build in CI and stop committing the
cheap ones) should land early in W1, because C1 and C2 change the bake inputs of both shards.

## 7. What the plan agent does with this

1. Run W1 milestone 0 (the Sky + Signal inventory and the per-component metric), or staff it as the first row.
2. Rewrite `rows.md` §C as three waves; W1's rows are components C1–C9 for Sky and Signal (or the order the inventory
   supports). Map every open SF49 / SF50 exit to one component; SF46–SF48 go under W2 and SF51 under W3, untouched
   until their wave starts.
3. Relabel the Sprint 2 lanes and steps by component (§5) without stopping them.
4. Add components closed and custom lines per component to the STATE headline for the active wave.
5. List the scope that is not W1 (Template 2, the dev-texture look, the menu hero board, the near tier) as paused or
   elsewhere, for Jake to confirm.
