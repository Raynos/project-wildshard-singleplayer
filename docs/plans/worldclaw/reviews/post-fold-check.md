# The check after the fold (2026-10-01)

One Codex reviewer (not a council round: the cap is four), read-only, across WORLDCLAW-SHARD, WORLDCLAW-TOOLS, THIN-ICE, 06, 04 and the three skills, after D57–D76 and J21–J52 landed. **21 findings, all verified and fixed** in the commit that adds this file. The findings as the reviewer wrote them:

1. `docs/plans/WORLDCLAW-SHARD.md:148` and `docs/design/worldclaw/06-shard-flow.md:250,563` require writable page notes, contradicting `docs/plans/WORLDCLAW-TOOLS.md:91` (J17: every review page is read-only; answers only in chat). Fix R20 to describe the read-only Atlas/artifact and replace both flow references to page notes with chat notes.

2. `docs/plans/WORLDCLAW-SHARD.md:348`, `docs/design/worldclaw/06-shard-flow.md:410`, and `docs/design/worldclaw/04-our-pipeline.md:265` still require T15, contradicting its superseded status at `docs/plans/WORLDCLAW-SHARD.md:292` and its replacement chain at `docs/plans/WORLDCLAW-TOOLS.md:370`. Replace T15’s prerequisite with that before-P0 W-row chain and mark the pipeline’s T15 entry superseded.

3. `docs/plans/WORLDCLAW-SHARD.md:355` schedules T4 and T5 after P6, contradicting Map Lab’s use of both before P5 at `docs/plans/WORLDCLAW-TOOLS.md:71,372`. Move T4 and T5 before T19, W6, and P5 in the main order.

4. `docs/plans/WORLDCLAW-SHARD.md:357` builds T8 after P9b, contradicting `docs/plans/WORLDCLAW-TOOLS.md:373`, which requires T8 for W10 before P9b. Move T8 before W10 and P9b.

5. `docs/plans/THIN-ICE.md:145–146` proceeds directly from mechanic implementation to P8, contradicting the mandatory P7 gate for new traversal verbs at `docs/plans/WORLDCLAW-SHARD.md:311`; Thin Ice’s rope grab is explicitly new at `docs/plans/THIN-ICE.md:81`. Insert P7 after TI0/P6 and the grey traversal implementation, before P8.

6. `docs/plans/THIN-ICE.md:146` defers the queen, Bellkeeper, survey, ladders, and beam mechanics until P10–P15, contradicting P8’s complete grey content and scoped boss test at `docs/plans/WORLDCLAW-SHARD.md:312` and `.claude/skills/worldclaw-interactive/SKILL.md:146–151`. Build their grey logic and quest functionality before P8, leaving final models and look work for P10–P15.

7. `docs/plans/WORLDCLAW-SHARD.md:152,303` still makes iterative steering unavailable until S2, contradicting D62’s absorption into interactive at `docs/plans/WORLDCLAW-SHARD.md:107` and S2’s merged status at line 331. Rewrite R24 around the interactive skill’s available checkpoints and polish rounds, and remove the obsolete availability question from P0.

8. `docs/plans/WORLDCLAW-SHARD.md:394,453` limits full polish to approximately 35% of the shard, contradicting D60 and current R11 at `docs/plans/WORLDCLAW-SHARD.md:105,139`. Change the risk mitigation to full polish on every seen band and mark PB2’s former mid/far treatment explicitly superseded by D60.

9. `docs/design/worldclaw/06-shard-flow.md:450` says cutting the verb keeps concepts, contradicting the required redraw of verb-dependent concepts, boards, and views at `docs/design/worldclaw/06-shard-flow.md:182–184`. Rewrite the invalidation row to redo those affected images alongside the verb line and slice, keeping only unaffected concepts.

10. `docs/plans/WORLDCLAW-SHARD.md:279` makes the illustrated map a paint of the schematic, contradicting D68’s requirement that the top-down illustrated map come from the shared blockout at `docs/plans/WORLDCLAW-SHARD.md:113`. Keep T2’s schematic and label compositor, but make its illustrated-map input T19’s top-down blockout render.

11. `docs/design/worldclaw/04-our-pipeline.md:86–90` generates three variants while preserving one schematic’s coordinates, contradicting the three different layouts required at `docs/design/worldclaw/06-shard-flow.md:138`. Specify three layout specs and schematics first, then paint each while preserving its own coordinates.

12. `docs/plans/WORLDCLAW-SHARD.md:282,314` restricts route-leg cameras and targets to the close band, contradicting re-targeting on every seen band at `docs/design/worldclaw/06-shard-flow.md:226–227`. Extend T5 and P9b to include mid/far crest and vista cameras, with the close band first.

13. `docs/plans/WORLDCLAW-SHARD.md:110` says Draft mode replaces image-in-chat review, contradicting J21’s titled image sets and chat review at `docs/plans/WORLDCLAW-TOOLS.md:95`. Mark that part of D65 superseded by J21 and state that the drafts site provides history while review happens in chat.

14. `docs/plans/WORLDCLAW-SHARD.md:117` leaves the content-board sequence open, contradicting D75’s settled P5b position at `docs/plans/WORLDCLAW-SHARD.md:120`. Replace the open-sequencing clause with “settled by D75: P5b, after P5 and before P6.”

15. `docs/plans/WORLDCLAW-SHARD.md:142` still escalates the design location to §7 Q2, contradicting its settled answer at `docs/plans/WORLDCLAW-SHARD.md:103,408`. State in R14 that D58 settled the location as `src/shards/<slug>/design/`, linked from SHARDS.md.

16. `docs/plans/WORLDCLAW-SHARD.md:289` tests J3 escalation only for a split greater than 1, contradicting R6 at `docs/plans/WORLDCLAW-SHARD.md:134`, which escalates when the split is not less than 1. Change T12’s pick-split threshold to `≥ 1` and retain `≥ 3` for individual gate-line splits.

17. `docs/plans/WORLDCLAW-TOOLS.md:83` still places built prototypes under `public/draft/<slug>/proto/<id>/`, contradicting the current path and W7 output at `docs/plans/WORLDCLAW-TOOLS.md:241,349`. Update J9’s output path to `drafts/<slug>/proto/<id>/` on the separate drafts site.

18. `docs/plans/WORLDCLAW-TOOLS.md:94` and `docs/plans/THIN-ICE.md:127` name `art/worldclaw-tools/round-1/`, contradicting the actual round path recorded at `docs/plans/WORLDCLAW-TOOLS.md:56`. Replace both with `art/worldclaw-tools/round-1-draft-and-explorers/`.

19. `docs/plans/WORLDCLAW-TOOLS.md:90,97` cites §2.9, but the current two-site architecture is §2.1 at `docs/plans/WORLDCLAW-TOOLS.md:161` and no §2.9 exists. Replace those §2.9 references with §2.1.

20. `docs/plans/WORLDCLAW-TOOLS.md:111` estimates the initial tool package at approximately 7 agent-days, contradicting the revised before-P0 package’s approximately 12 days at `docs/plans/WORLDCLAW-TOOLS.md:379`. Mark the former package and estimate revised by J44, and update J37 to the current before-P0 rows and approximately 12-day estimate.

21. `docs/plans/WORLDCLAW-SHARD.md:383–384` claims fourteen touchpoints, fifteen with P7, but its accompanying enumeration contains thirteen, fourteen with P7. Change the counts to thirteen and fourteen respectively.

21 findings.