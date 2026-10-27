# Builder decisions, 2026-10-27

What the builder (wildshard-new) and its lanes decided today without a G-row from Jake, what needs his word,
and hard questions for the rest of SHARD-PLATFORM. Times are Cancun. Sources: today's commits, the coordinator
transcript, [STATE](../STATE.md), [BURN-DAMAGE-LIST](../../BURN-DAMAGE-LIST.md) and
[decisions.md](../decisions.md) G767–G810. Anything that is already a G-row is Jake's, not listed here.

## 1. Autonomous decisions today

Risk = what it costs if the call was wrong. ⚠ = sits against a G-row or a standing rule.

### Scope cuts and row closures

| Time | Who | Decision | Evidence | Risk | Jake confirm? |
|---|---|---|---|---|---|
| 05:31–06:40 | coordinator, sp-o3 | ⚠ Nine counts as "on tiles" by proof only. Its city stays boot-resident whole (168 MB). Streaming not built, since it saves 5.4 MB. T8 marked done | c1a7396a78, T8.N2 | high | Yes. G790 says all seven on tiles |
| 10:35 | coordinator | S1 closed as a miss: shaders 1.6 / 1.5 s against 1.0 / 0.8 s. Counts toward the % | be576c0abe | med | Yes |
| 11:38 | coordinator | I1 closed; its 26 MB wire bar moved word for word to I3 | 49c4370fae | low | FYI |
| 11:54 | coordinator | H3's bar redefined: the Template door's tick counter is exempt. H3 and H5 closed | 987ea0a9ac | low | FYI |
| 12:40 | sp-o4 | js-heap archived at 100 %. The whole-page idle target (≤ 0.5 MiB/s, ≤ 2 GCs a min) is missed at 2.79 / ~12: "not a row" (D180) | d29cb45cd6 | med | Yes |
| 07:40 | sp-x2 | T10 source audit closed; the whole-shard path is gone before any official reading | f0058f4fb8 | med | FYI (G790 ordered it) |

### Bars, caps and readings

| Time | Who | Decision | Evidence | Risk | Jake confirm? |
|---|---|---|---|---|---|
| 03:02, 03:56 | coordinator | Decision-module cap 8 → 9 for every shard (D59), so Pine's contract guest ships as a module | ba9b0b3a2e, aaf3c280ae | low | Yes (flagged D59) |
| 04:44, 04:46 | coordinator | Pine declared phone ceiling 91.7 → 105.0 MB: bytes the phone already fetched now count (D82). Later ratcheted to served 67.6 MB | 0d44614d3a, 47e8a93d33, 9910e0acb6 | low | No |
| 04:22–04:33 | coordinator | The phone counts the largest texture variant per texture; product files carry a device tier | a0ff9b1991, 8ff76ba9db | low | No |
| 09:55 | lane (G782) | WebKit parked budget doubled (2 materials, 512 KiB), on one Simulator run per variant | e80511aa70 | med | No: tonight's phone QA covers it |
| all day | coordinator | Signs Ratchet-Approved / Generated-Import-Approved debt rises; a new approval line; a rollback exemption in the policy check | 9265a2eae1, ef35b30ff6, 44c5067141 | low | FYI |

### Looks and graphics

| Time | Who | Decision | Evidence | Risk | Jake confirm? |
|---|---|---|---|---|---|
| 01:15, 01:23 | sp-o3 | ⚠ Driftwood phone rocks and foliage decimated (−7 MB), shipped as the phone default, "board follows". No board exists: `art/driftwood-isle/round-20-phone-decimation/` holds one uncommitted script. 11 min earlier the same lane wrote that this "needs Jake's board, not a G769 recommended default" | 0af15f154b, 8d1751970e, bfb9fb12b4 | high | Yes |
| 08:10 | sp-x8 (coordinator's call) | The held loading view now draws only within 125 m, default on. D175 asks 125 vs 60 m but never "unbounded, as before" | 86683bcaa0 | med | Yes (D175) |
| 09:04 | coordinator | ⚠ Held view at a 30 fps floor; desktop gets every other vsync, so 30 fps on a 60 Hz screen. The coordinator itself cited Jake's 60–120 desktop bar | 7972590759 | med | Yes |
| 09:20 | lane | While held, minimap, map and day-sky curves update 1 frame in 4 | 1a64bc3103 | low | No |
| 05:56 | sp-o3 (coordinator's call) | Night Market far (L1) tiles: posters, water, landmark only near; vertex-colour stand-ins far | 1361eb295e | med | Yes: he plays Night Market tonight |
| 07:32 | coordinator | Merged cells as instances, default on, no Debug row. Proof failed; fixed forward | 0e6ef0ef32, 92bc42ebef | low | No |
| 10:11 | coordinator | Boot links only what spawn draws; the rest compiles after control | 141ea5f018 | low | No |
| 09:01 | coordinator | Approved "skip the post pass while held"; it then became D178, a pick, not built. Good catch | 27635f2d7d | — | — |

### Process and assignments

| Time | Who | Decision | Evidence | Risk | Jake confirm? |
|---|---|---|---|---|---|
| 14:59 | coordinator | STATE lists D183 as a Jake pick; no D182 or D183 row exists in the damage list | b62304a7a7 | low | No: fix STATE |
| all day | coordinator | ready-queue's lane table still shows the pre-G804 lanes | lanes/ready-queue.md | low | No |
| 08:01–09:01 | coordinator | Crossing levers split: sp-x8 held scheduling, sp-o3 program sharing, sp-o4 owns D176; Nine and Night Market far materials to sp-o3 | transcript | low | No |

## 2. Questions and decisions for Jake

Ordered by what they unblock. Option 1 is always "Skip for now".

1. **D178 Cheaper held view?** The cold crossing is ~13 s on Nalati even with every hook zeroed (8 s bar).
   Options: Skip · Pause the post chain and pull in the far plane while held · Keep the full held view.
   **Rec: pause it while held.** It is a loading moment; nothing else gets cold under 8 s.
2. **D179 Nine spawn view.** Options: Skip · A: full detail before control (97.85 MB) · B: coarse first, sharpen
   nearest first after control (~10.5 MB). **Rec: B.** Nine's only way under I2's 12 MB bar.
3. **T8 for Nine.** It stays a 168 MB boot-resident city. Options: Skip · Accept as "on tiles" · Build L0
   streaming anyway. **Rec: accept, with D179 B.** Streaming saves 5.4 MB; B is the real saving.
4. **D181 Pine shader volume.** Options: Skip · Keep Pine's photoreal look · Drop sheen on phone foliage and cloth.
   **Rec: keep the look.** At most ~0.2 s of an 18 s crossing.
5. **D175 Held draw range.** Options: Skip · Keep 125 m · 60 m · Unbounded, as before today.
   **Rec: keep 125 m.** 60 m measured no gain.
6. **Driftwood phone decimation.** Options: Skip · Keep (−7 MB) · Back to full rocks and foliage · Board first.
   **Rec: keep, and look at it in tonight's play.** It is phone only and the biggest DW cut.
7. **Held view on a 60 Hz desktop at 30 fps.** Options: Skip · Accept while held · Keep 60 on desktop.
   **Rec: accept while held.** The phone keeps 30; it only lasts the crossing.
8. **Accept closed misses: S1, I1 (to I3), H3, js-heap's whole-page idle.** Options: Skip · Accept all ·
   Reopen S1 · Reopen js-heap. **Rec: accept all.** Each has a damage line and an owner.
9. **D59 module cap 9.** Options: Skip · Accept · Back to 8. **Rec: accept.** Nalati's course wants it too.
10. **Night Market far look.** Options: Skip · Keep the far stand-ins · Posters and water far too.
    **Rec: judge it tonight on the plaza.** The near look is unchanged.
11. **Burn-damage Q1–Q5** are drafted in BURN-DAMAGE-LIST. **Rec: ask them at plan end**, not tonight.

## 3. Grill

1. **Is 8 s cold reachable?** DW 11.8, Nalati ~15, Pine 18.3 s. Nalati is ~13 s with zero hook work. Without
   D178, is G808 a bar or a wish? Should the bar be read on the phone, not Chromium 4×?
2. **How honest is 85 %?** S1, I1, H3 (builder) and RM1, C4, C2 (Jake) closed as misses, moved bars or
   ratchets. How many of the 177 met the bar as written?
3. **T10 deleted the whole-shard path before any official reading.** The Simulator says 10 / 15 and T7 misses
   are open. With no reverts (G674), what is the plan if tonight's phone QA finds tile holes?
4. **G807 lets a lane grade its own row** on one Chromium reading. Who catches a lane that reads its own work
   generously, now that plans archive on it?
5. **Live has not moved since 10-26 17:58** (59a595ab10). Six G809 rows wait on a first green push run.
   Is "fix forward later" now costing more than the gate did?
6. **Are the CI rows worth keeping?** SW3, CF3–CF5, GM1 and build-speed's CI row only measure CI. Drop them
   and close on the burn plan instead?
7. **Should the 18 open plots really wait** for a plan after tonight? The generic tiled-plot pipeline is
   no-regret; one lane could start it now.
8. **Is the damage list still a list?** 448 lines today. Who reads it, and does BURN start at zero or at 150?

## 4. Brainstorm

1. **Tonight's play is the reading.** One checklist covers T10, M2, RM13, LD5–LD8, A1–A2 and Night Market. Cost: 1 h of Jake.
2. **Cut-or-close pass on the 32 open rows:** build, accept miss or drop, as one batched question. Cost: 30 min.
3. **Warm the next cell's shaders during play.** Compile neighbours' programs in idle frames before the edge. Cost: ~1 d Opus.
4. **Make the crossing a beat.** A short bridge or ride clip covers the cold seconds in-world (G578). Cost: board + 2 d.
5. **Lanes that finish a plan go straight to BURN rows**, not to extras. Cost: none.
6. **After SHARD-PLATFORM: BURN first** (green main, moving deploy), then the open-plots plan, then HOST-AUDIT. Cost: ordering only.
7. **Freeze grid-crossing at today's numbers with a ratchet** once D178 lands, and move Opus to Night Market content. Cost: none.
8. **Nine D179 B may cut boot memory too**, if far L0 tiles never load; measure the 168 MB first. Cost: ~0.5 d.
