# Asks graveyard audit: Codex clean-room (gpt-6-astra, read-only), 2026-10-03 (E423)

The second, independent audit for E423. It saw none of the Claude audit. Kept verbatim.

**The graveyard is real: 86 of 133 apparent open asks should leave the active queue.** The remaining 47 include genuine bugs, decisions and verification—not 47 approved implementation jobs.

Read-only audit of the October 3 working tree, commit history and current code. No files changed; no builds, browsers or models run. Counts cover **439 ask files**, including **132 nonterminal statuses**, plus **E4b**, stranded in the legacy ledger. Concurrent agents continued committing during the audit.

| Classification | Count | Meaning |
|---|---:|---|
| STALE-DONE | 33 | Delivery/completion evidence exists; status never caught up |
| DEAD | 20 | Superseded verification, expired session work or explicitly parked work |
| DUPLICATE/FOLDED | 33 | Another ask or plan should own the remaining work |
| REAL | 47 | Meaningful work or decision remains |

“DEAD” recommends retiring the old task; it does **not** certify that a historical bug cannot recur. “STALE-DONE” distinguishes completed delivery from optional further feedback.

**Ask-by-ask classification**

IDs refer to [docs/tasks/asks/](/Users/raynos/projects/games/wildshard-singleplayer/docs/tasks/asks); statuses below are shortened. Archived plan names refer to files under `project/archive/`.

| ID | Current status | Class | Evidence | Recommended action |
|---|---|---|---|---|
| D38 | open | STALE-DONE | Driftwood `audio/systems.ts` drives dusk; day/night backdrop exists; night sailor verified `12e64e8f0` | Close |
| D42 | folded into E5 | DUPLICATE/FOLDED | Explicit fold; `3da0701e1`; MUSIC subsequently archived | Make fold terminal |
| E4 | in flight, Sep 22 | STALE-DONE | LOAD-PERF and PLAY-PERF archived `1ee4d74b8`; L1 later closed by Jake | Close original plan-building request |
| E4b | legacy needs pick | DEAD | Old ≤300 desktop-call proposal; PLAY-PERF archived; current measured budgets replaced that baseline | Retire old budget proposal |
| E8 | handed over, Sep 22 | STALE-DONE | E7 remaster completed `39711fa`; archived Driftwood remaster; newer V2 owns remaining models | Close old agent assignment |
| E11-C | folded into E11 | DUPLICATE/FOLDED | `6d4d5f6bf`; explicitly a generated subtask, not another user ask | Terminal fold |
| E12 | folded into E11 | DUPLICATE/FOLDED | Same commit; delivered B-lunge image | Terminal fold |
| E12-IMG | folded into E11 | DUPLICATE/FOLDED | Same commit; delivered Settings image | Terminal fold |
| E24 | needs you | REAL | NATIVE-APPS still requires store accounts/secrets | Keep one explicit account checklist |
| E29 | open | REAL | NATIVE-APPS still lists listing kit, support/privacy and native drills | Keep; distinguish proposals from authorized work |
| E30 | open | REAL | Native inbox code `1e46950`; native end-to-end delivery remains unproved | Keep with exact acceptance test |
| E38 | in flight, Sep 22 | STALE-DONE | Rotate gate `804fadcb5`; current `rotate.css`; obsolete one-day deploy-quota blocker | Close |
| E40 | open, E5 lane | DEAD | V1 arrangement complaint predates current state-driven mixer; `Music.ts` recalculates kick levels; score moved in `bd2e547d2` | Retire old reproduction; reopen only with current failure |
| E45 | needs pick | STALE-DONE | Audit delivered `e35905e8e`; ENGINE-FIT folded into normalization `3ae8256e5` | Close audit request |
| E56 | open | REAL | Archived MUSIC explicitly leaves registration to Jake; no completion evidence | Keep account action |
| E57 | open | REAL | Published music/SFX listening pages; optional veto remains a human decision | Move to one listening review, outside ready work |
| E62 | open, Sep 23 phone check | DEAD | E44-era preload check predates serial audio changes and normalization | Replace vintage check with current release smoke test |
| E73 | open, Sep 23 phone check | DEAD | Original PHYSICS archived `771895a14`; subsequent F11 rewrite; ask records Jake accepting local best guess | Retire original-build reading |
| E74 | open | REAL | LOCK-ON archive leaves L13–L15 and telegraph work; no completion evidence | Separate approved work from optional ideas |
| E75 | open | REAL | Current lock eligibility still distinguishes melee; requested manual ranged aiming remains separate | Keep |
| E77 | needs you, Sep 23 | DEAD | Recovery subsequently changed through E96/E98/E99/E135 | Retire old recovery checklist |
| E91 | needs you, Sep 23 | DEAD | NaN fix shipped `69df2333c`; old shader verification predates later rendering changes | Close vintage retest; reopen on recurrence |
| E93 | needs you | DEAD | E117/E147/E153 subsequently changed the exact pop/shadow behavior it asks to verify | Retire |
| E96 | needs you | DEAD | `0c791eac3` explicitly records failure despite E96 and adds E135 recovery work | Close as superseded |
| E98 | needs you | DEAD | Its blurred-game resume design replaced by E99’s branded screen | Close as superseded |
| E99 | needs you | STALE-DONE | Jake picked A; shipped `4dadb24`; all-three-shard evidence `d77d19a4f` | Close design delivery |
| E101 | needs pick | STALE-DONE | Weights check completed `3b4150c12`; its remaining policy question is explicitly settled by AGENTS.md | Close |
| E103 | needs pick | STALE-DONE | Blind pairs sent `eb37255ba`; optional guessing is not unfinished delivery | Close; retain answer-key reference |
| E106 | open | REAL | `nalati-grasslands/look/minimap.ts` still loops across the whole `half` range per overlay | Keep measurement/optimization task |
| E107 | needs you | REAL | Flow shipped `9b5cdf54f`; SenseNova and mflux directories still exist; moved weights directory is absent | Rewrite to remaining paths only |
| E117 | parked | DEAD | Jake explicitly stopped hunt; `4229a17cf` records “later” | Remove from active queue; retain reopening trigger |
| E122 | needs pick | DEAD | Rejected HUD board `8b8c38ce3`; later E319 establishes current HUD | Retire old board decision |
| E131 | needs you | REAL | Rotation fix `036b22533`/`683c76512`; no later physical confirmation found | Keep one current-build rotation check |
| E141 | needs you | REAL | Pine followups archive explicitly retains F-J1/F-J2; other two checks closed | Keep only those two checks |
| E147 | in flight via E153 | DUPLICATE/FOLDED | `38c175db5` transfers outcome to E153; old file still reserves shadow files | Close fold; release obsolete ownership |
| E148 | needs pick | REAL | `spruceMask` deleted `a83e63f74`; churn decision and `interact/validate.ts` remain | Remove solved subitem; retain actual remainder |
| E163 | needs pick | REAL | Cliff/crag expansion excluded by Jake’s “Only the boulders for now” | Keep as deferred proposal, not ready work |
| E164 | open | STALE-DONE | E314 delivered FINDS/trophies; archived DRIFTWOOD-LOOT records approved replacement | Close against later Bag design |
| E165 | open | REAL | Two specific measurements remain without closing evidence | Reproduce on current engine before optimizing |
| E166 | needs pick | REAL | PCSS remains an offered, unapproved enhancement | Move out of active work until selected |
| E167 | open, phone check | DEAD | Two-resident-world premise removed by E216 `2bb24342` | Retire obsolete residency experiment |
| E168 | needs you | REAL | Trailer delivered `403bd7c57`; acceptance still explicitly awaits Jake | Register one trailer review |
| E169 | open | DUPLICATE/FOLDED | Explicitly carried by NINE-DRAGON-STACK; next step E380 | Keep plan as canonical queue |
| E170 | needs pick | REAL | Four named visual concerns from trailer; no complete disposition found | Revalidate current views; present one decision board |
| E179 | needs iPhone | DEAD | Its “switch never navigates” premise reversed by E216 and later navigation changes | Close superseded diagnosis/check |
| E185 | folded into E188 | DUPLICATE/FOLDED | File explicitly retracts diagnosis and names successor | Terminal fold |
| E195 | needs you | REAL | Self-symlink and all four named stashes still exist; several named temporary directories do not | Keep exact surviving cleanup items |
| E196 | open | REAL | `scorecard.mjs` still compares baseline goldens; no replacement-baseline evidence found | Keep; specify current baseline scope |
| E197 | needs pick | DEAD | Old all-heroes-at-loading proposal overtaken by E222 static selector and E244 selected-hero decode | Retire old choice |
| E198 | open, parked | DEAD | Explicit “Call it done”; restart only after new sub-30-fps report | Remove from active queue |
| E200 | in flight, Sep 26 | DUPLICATE/FOLDED | Loading-restart investigation proceeds through E216 to E264; facade fix `d85d4eab4` | Fold into current E264 acceptance |
| E201 | in flight, Sep 26 | STALE-DONE | Empty UI `7eb0f72c`; actual model registration `2a1393be` | Close |
| E203 | in flight, Sep 26 | DEAD | Old 724-path sweep largely committed; residual shared-index snapshot is seven days obsolete | Close old session inventory |
| E204 | in flight, Sep 26 | DUPLICATE/FOLDED | Trailer delivered; remaining review/parity tracked in NINE-DRAGON-STACK F3/F10 | Fold into those rows |
| E205 | in flight, Sep 26 | STALE-DONE | Models registered `2a1393be`; process audit delivered; broader scope transferred to E206 | Close |
| E206 | in flight, Sep 26 | DUPLICATE/FOLDED | SHARD-CHECKPOINTS merged into WORLDCLAW-SHARD through E406, D77–D92 | Terminal fold |
| E207 | in flight, Sep 26 | DEAD | PDFs delivered; old process-review gate superseded by E406’s merged workflow | Retire old review request |
| E208 | in flight, Sep 26 | STALE-DONE | `art/hud-explorer/round-1-arena/`; E212 explicitly approves proposal | Close |
| E210 | in flight, Sep 26 | STALE-DONE | `arena-nine-angles.jpg`; approved through E212 | Close |
| E212 | in flight, Sep 26 | STALE-DONE | Arena shipped `ce1305ac`; later dummy plan records shared integration done | Close |
| E215 | in flight, Sep 26 | STALE-DONE | Training-dummy plan archived Sep 29; Jake approved under E285 | Close |
| E217 | in flight, Sep 26 | DUPLICATE/FOLDED | Early memory reductions superseded by E264’s physical isolation and cuts | Fold into E264 |
| E218 | in flight, Sep 26 | DUPLICATE/FOLDED | Diagnostics/research recorded `9dc339f85`; crash acceptance now E264 | Fold into E264 |
| E219 | in flight, Sep 26 | STALE-DONE | Safe-root boot implemented; `91084292` provides renderer-free selector | Close original crash-trap request |
| E220 | in flight, phone pending | STALE-DONE | Actual Simulator PWA investigation recorded `bfaba6c68`; findings enumerate completed tests | Close investigation; E264 owns phone cap |
| E224 | in flight, Sep 27 | DUPLICATE/FOLDED | Failed early mitigation; later physical isolation in E264 | Fold into E264 |
| E225 | in flight, Sep 27 | STALE-DONE | File records loader attempts, heap/texture estimates and unavailable iOS fields implemented | Close diagnostics request |
| E226 | in flight, Sep 27 | STALE-DONE | Matched engine/load/memory tables delivered; benchmark script `f9582b735` | Close benchmark delivery |
| E227 | in flight, Sep 27 | DUPLICATE/FOLDED | Performance followup covered by E283 and NINE-DRAGON F9/E264 | Fold |
| E228 | in flight, Sep 27 | DEAD | Old “50 files” inventory; hygiene delivered `10f6a9bf6`; original session gone | Close old sweep |
| E230 | in flight, Sep 27 | DUPLICATE/FOLDED | File itself routes physical result to E231; successor E264 | Fold |
| E231 | in flight, Sep 27 | DUPLICATE/FOLDED | `63e2058` mitigation; current physical acceptance NINE-DRAGON F9/E264 | Fold |
| E236 | in flight, Sep 27 | STALE-DONE | `63e2058` records/shows reload reasons; file routes physical investigation elsewhere | Close diagnostics delivery |
| E241 | in flight, Sep 27 | STALE-DONE | Compare implementation `240107cc`; EXPLORE-V2 explicitly records completion | Close |
| E242 | in flight, Sep 27 | STALE-DONE | Same commit; current `engine/explore/Compare.ts` | Close |
| E243 | in flight, Sep 27 | DUPLICATE/FOLDED | File records 3,895→353 ms fetch improvement; remaining phone acceptance E264/F9 | Fold residual verification |
| E244 | in flight, Sep 27 | DUPLICATE/FOLDED | Historical failed first-frame build; later facade isolation E264 | Fold |
| E246 | in flight, Sep 27 | DUPLICATE/FOLDED | Repeated Simulator/phone investigation now NINE-DRAGON F9/E264 | Fold |
| E248 | in flight, Sep 27 | DUPLICATE/FOLDED | Crash review/fallback delivered; remaining phone KTX2 issue also named in E376/MW12 | Fold into E264 and E376 |
| E251 | in flight, Sep 28 | DUPLICATE/FOLDED | First-frame mitigation followed by E257/E264 and global facade removal | Fold |
| E256 | in flight, Sep 28 | DUPLICATE/FOLDED | File explicitly continues actual fixes in E257; diagnostics shipped `e161ffd0` | Fold into E264; retain incident evidence |
| E257 | in flight, Sep 28 | DUPLICATE/FOLDED | Long investigation culminates in E264 isolation; `d85d4eab4`; E283 records working phone play | Close incident chain into E264 |
| E262 | in flight, Sep 28 | DUPLICATE/FOLDED | Empty body; E264 contains actual 4-GB investigation and cuts | Fold into E264 |
| E264 | needs you | REAL | Four cuts landed; file explicitly distinguishes Simulator results from unverified physical caps | Keep as canonical memory acceptance |
| E268 | open, no Chrome Simulator | DEAD | Later physical USB inspection and Jetsam evidence made this unavailable-tool detour obsolete | Retire |
| E274 | in flight, Sep 28 | DUPLICATE/FOLDED | DEPLOYMENT_ASSET_TRIM owns T2/T4/T5 | Terminal fold |
| E281 | paused | DUPLICATE/FOLDED | Migration finished `b08f956e7`; NINE-DRAGON plan now puts E380 before round 3 | Update canonical plan, retire duplicate paused claim |
| E286 | needs you | REAL | Grapple UX shipped `7c3640677`; phone discoverability feedback still meaningful | Include in one Nine Dragon playtest |
| E301 | needs you | REAL | Nalati load cut `2d54fd57`; physical memory/fps still explicitly owed | Keep canonical Nalati check |
| E303 | superseded by E319 | DUPLICATE/FOLDED | E319 replacement shipped `7ce4995de` | Terminal fold |
| E307 | needs you | REAL | Playgrounds shipped `2b64d80`; requested feel feedback not recorded | One playground review |
| E313 | folded into E314 | DUPLICATE/FOLDED | Explicit expansion; E314 completed | Terminal fold |
| E329 | needs you | REAL | Fix `6d3599fcc`; corrected test `e410a5709`; touch-device acceptance absent | Keep one concise two-thumb check |
| E334 | needs you | REAL | Arms shipped `be0eec66`; explicit physical-memory requirement remains | Combine with Driftwood device session |
| E338 | open | REAL | Timer fixed `a28af6310`; `serve-build.sh` still identifies `all-mine` by shared cwd | Close timer half; fix ownership half |
| E351 | needs you | REAL | Specific look-review findings and committed boards remain | One optional visual review |
| E353 | open | REAL | Four concrete playground/UI/catalog defects; `ee85c65f1`; no complete closure evidence | Revalidate and prioritize |
| E354 | open | REAL | Ten specific trail stuck points `af98faa86`; newer general walk checks do not prove these trails clear | Keep exact trail regression |
| E355 | open | REAL | Five named defects `c36ab7734`; obsolete session owners, incomplete closure record | Reassign surviving defects |
| E358 | open | REAL | `BatchedMesh` still constructed in Pine crags and Nalati camp people | Keep |
| E359 | needs pick | DUPLICATE/FOLDED | Three current plans and registered reviews now own workflow/tools/pilot decisions | Close research umbrella; retain plan links |
| E363 | picked, old board pending | STALE-DONE | Signal Dunes built and later passed round 25 `7952baa90` | Close initial shard-building ask |
| E364 | needs pick, old board | STALE-DONE | Sky Reach built, passed round 14 `d7f4278a7`, top-ten work completed | Close initial shard-building ask |
| E365 | needs pick | REAL | Audit delivered; crouch/reload/spear-jump decisions remain distinct from E419 key help | Present only unresolved decisions |
| E373 | private candidate pending | STALE-DONE | J15 landed `c45b6df52`; lead closure `c41bde909`; current developer banner exists | Close |
| E374 | open | DUPLICATE/FOLDED | SIGNAL-DUNES/SKY-REACH own acceptance; latest handoff says original top-ten work finished | Close umbrella into those plans |
| E375 | open | REAL | Gamepad explicitly unbuilt in normalization leftovers | Keep as unapproved proposal |
| E376 | open | REAL | MW8/MW12/MW21/MW22 remain named work; archive §8 explains each | Replace cryptic row IDs with concrete scope |
| E377 | open | REAL | EF3/6/7/9 proposals remain; TP18 overlaps the asset re-layout | Remove completed overlap; retain actual proposals |
| E378 | open | DUPLICATE/FOLDED | ANIMATION-REMASTER A3–A7 owns same work and approval blocker | Fold into plan |
| E379 | in flight, Oct 3 | REAL | Current arch-guards work; same-day AG7/AG10 and layer commits | Keep claim; narrow remaining rows |
| E380 | open | DUPLICATE/FOLDED | NINE-DRAGON-STACK explicitly names re-plan as next row | One canonical plan task |
| E382 | open | REAL | New-shard runner baselines remain; requested return to `newest-green` superseded by Oct 2 release policy | Keep baselines; delete obsolete deploy instruction |
| E385 | open | STALE-DONE | Fix `6cbb7f5a5` directly implements PAUSE/MAP/BAG over dialogue | Close |
| E388 | in flight | REAL | Table still has unbuilt soak/parity spread derivations; WorldClaw half closed `cac369be0` | Update summary to remaining work |
| E389 | in flight | STALE-DONE | Tooling `d4b7db1f`; repeated committed progress captures `6a3601720`, `8669d1125` | Close setup request; captures are ongoing process |
| E395 | answered | STALE-DONE | Audit answered and followup work recorded `54c69ca26`, `c846a0bac` | Close; WORLDCLAW-TOOLS owns implementation |
| E399 | open | STALE-DONE | Jake lowered bar to 7; both passed, `7952baa90`; ledger records override | Close council-bar request |
| E400 | open | REAL | Hero re-shoot explicitly waits for finished look loops; those loops have now settled | Ready to claim |
| E401 | open | REAL | Recent Pine pond/golden-hour report `90312e9a7`; no resolving evidence | Keep |
| E407 | open | STALE-DONE | Audits/top-ten plans delivered; final original rows recorded `952fe63bb` | Close requested audit/planning delivery |
| E412 | in flight, Oct 3 | REAL | Current drafts feedback claim `a0d8a6d55`; active drafts edits | Keep |
| E415 | in flight, Oct 3 | REAL | Generated boot-table relocation explicitly remains after LAYER-PURITY | Keep |
| E416 | needs pick; “skip” | REAL | Pilot complete; skipped question is not approval or rejection | Park decision; stop prompting every session |
| E420 | needs pick | REAL | E419 shipped key shortcut; visible button/placement remains requested | Prepare board, then one decision |
| E421 | open | REAL | Three precise new keeper/mill/Roc polish notes `4369b010c` | Deferred polish, not a passed-shard blocker |
| E422 | open | REAL | Current explicit test-suite request; no completion evidence at inventory time | Keep |
| E423 | open | REAL | Current markdown audit request | Close when this report is accepted/delivered |
| N11 | needs you | DUPLICATE/FOLDED | Same physical Nalati reading now E301 | Fold into E301 |
| N13 | open | STALE-DONE | Riding complete `3aebdeb58`; NALATI-FINISH B1 explicitly done | Close |
| N14 | open | STALE-DONE | NALATI-FINISH B2 done; `083be98bf`, `ac8fb14dd` | Close |
| N24 | needs bug list | DEAD | Unspecified v0.3.0 complaints; later Nalati finish/remaster completed | Retire; accept concrete new reports |
| N26 | open | STALE-DONE | Driftwood navmesh rebaked `7da5e2160`, after earlier `7f4589517` | Close stale-bake request; E354 retains trail defects |

The [legacy ledger](/Users/raynos/projects/games/wildshard-singleplayer/docs/tasks/ASKS.md) is explicitly frozen, so its historical statuses should not become additional live work. Nine other apparently open legacy rows already have terminal authoritative files:

| ID | Legacy status | Class | Evidence | Action |
|---|---|---|---|---|
| L1 | needs pick | STALE-DONE | File: Jake said “L1 close out” | Resolve through file |
| P5 | in flight | STALE-DONE | File done; `911bad9` | Resolve through file |
| P6 | open | STALE-DONE | File: Jake explicitly closed it | Resolve through file |
| E1 | in flight | STALE-DONE | File done Sep 22 | Resolve through file |
| E5 | needs pick | STALE-DONE | MiniMax selected; continuation E33 | Resolve through file |
| E14 | in flight | STALE-DONE | Explore World archived; `80ae3ab` | Resolve through file |
| E21 | needs pick | STALE-DONE | Rules/hooks delivered `63afe18` | Resolve through file |
| E22 | needs pick | STALE-DONE | Physics delivered `558d234` | Resolve through file |
| E7 | in flight | STALE-DONE | Remaster delivered `39711fa` | Resolve through file |

Those nine are excluded from the 133 count. X1/X2 are already “closed—accepted.” **E4b is the actual migration hole:** the brief’s `[A-Z0-9-]+` pattern silently excludes its lowercase suffix.

**Handoffs: valuable evidence, unusable current instructions**

- **318 headings beginning “Handoff” across 15 ask files.** [E357](/Users/raynos/projects/games/wildshard-singleplayer/docs/tasks/asks/E357.md) alone has **223**, 2,942 lines and **641 KB**. [E374](/Users/raynos/projects/games/wildshard-singleplayer/docs/tasks/asks/E374.md) has **53**, 1,377 lines and **119 KB**. E392 adds 14.
- The problem is contradictory instructions, not merely length. Completed E357 still contains “lead lands/cherry-picks” instructions and obsolete file ownership. E374’s penultimate handoff says continue toward 8; its last says Jake stopped at 7 and there is no next work.
- “Read the last Handoff” is unsafe for multi-lane asks: the last section belongs to one lane, not necessarily the job being resumed.
- Archived NALATI-FINISH still says “Start here: B5 → B1 → B2 → B3,” although its current table says those rows are complete.
- **Keep:** final accepted result, exact commits/builds, durable measurements, failed approaches that explain current constraints, and incident evidence.
- **Compact:** obsolete next commands, superseded candidate refs, repeated gate narratives, stale ownership and scratch paths. Keep one current handoff per unfinished lane; move completed history to a linked archive while retaining the ask stub.
- E264 demonstrates the right evidence worth preserving—physical versus Simulator measurements—but its early instructions to enable facade multi-draw need an unmistakable **historical/superseded** boundary.

**Plans: fresh dates conceal stale content**

All **15 root plans** have a State line on line 3: seven `in progress`, six `draft`, two `blocked`. Formatting compliance is good; semantic accuracy is not.

| Plan/surface | Finding | Action |
|---|---|---|
| SIGNAL-DUNES | State still reports round 15 at 6.57; round 25 passed 7.00 in `7952baa90`; links missing `SIGNAL-DUNES-TOP10.md` | Update to final acceptance/phone blocker and archived link |
| SKY-REACH | Phone blocker remains genuine; State incorrectly says E410’s mill/light/keeper work remains open | Remove completed E410 work; retain P6 and E421 |
| ARCH-GUARDS | State calls AG7/AG10 open despite `099c05407`/`6dfc6d676`; E414/E417 also completed | Reconcile remaining rows |
| DECISION-MODELS | D1–D4 done; D5/D6 explicitly unapproved proposals | Finish approved phase; keep proposals separate |
| FINISH-LINE | State explicitly admits its own table tags are older than reality | Reconcile table or retire umbrella after routing remaining choices |
| DRIFTWOOD-REMASTER-V2 | `in progress`, but unowned and unchanged since Sep 23 | Mark queued/dormant; do not imply an active builder |
| DEPLOYMENT_ASSET_TRIM / NINE-DRAGON-STACK | Genuine remaining scope, explicitly unowned | Distinguish queued work from active execution |
| NATIVE-APPS | Valid account blocker, but independent agent tasks remain | Show blocked release separately from available work |
| WORLDCLAW-SHARD / THIN-ICE / WORLDCLAW-TOOLS | Current approval/dependency distinctions are meaningful | Keep; avoid duplicating their queues in umbrella asks |
| `mockup-council/` | **116 Markdown files, 18,215 lines**; both shards passed | Archive completed round records; leave result/register links |
| `shard-polish-council/` | **14 files**; named rounds and outcome completed | Archive |
| `worldclaw/` | **31 files**, including completed council/review histories | Archive completed reviews; retain active contracts/fixtures |

Do **not** describe the 25-round mockup council as an unexplained policy violation: its ledger explicitly records Jake’s override of the four-round cap and subsequent reduction to 7. The rot is that several other documents still advertise earlier targets.

**Other Markdown rot**

- Inventory: **1,130 Markdown files, approximately 11.3 MB**. Large files are not automatically bad: `ENGINE.md` is a maintained API reference. E357’s executable-looking historical instructions are a substantially worse problem.
- The legacy ledger immediately contradicts its freeze banner with “Kept current … at every commit” and “If it is not in here, it was not asked.”
- `prepare-to-exit` still says a **3-browser lane**; AGENTS.md says **4**. It also treats a done ask without a production build ID as failed delivery, even for research, documentation and external-account work.
- AGENTS.md’s HUD coordination list contains pre-layer-split paths. Historical lock-era ownership wording remains mixed into current instructions.
- Archived TRAINING-DUMMY-MODELS says every row is built while its table retains “built, not yet live” and an open phone-memory row. Archiving did not reconcile the table.
- Archived DRIFTWOOD-LOOT says “No leftovers,” while E351 separately records look-review leftovers. Closure language is inconsistent across surfaces.
- A direct-link check of AGENTS.md and root live plans found one missing target: SIGNAL-DUNES’ top-ten link. A Markdown inbound-reference scan found one unreferenced design/process/audit file: `docs/audits/nine-dragon-lab-parity.md`. The dominant problem is **duplicated state**, not widespread orphan files.
- The five-entry review registry is useful, but older trailer, listening and PDF review requests still live in asks. Without consolidation, it becomes another parallel queue.

**Process changes, ranked by impact**

1. **Make closure and folding machine-readable.** Validate a small status enum; add terminal `folded` with `superseded_by`. Generate the brief from it. Reject `answered`, `picked` and prose-only supersession as active statuses. Use deterministic parsing, not a model.
2. **Give agent claims leases.** Require owner/session, claimed time and heartbeat. After 24 hours without renewal, show `claim expired`; return work to unclaimed status. Never automatically drop the underlying request.
3. **Stop turning every observation into an obligation.** Revise prepare-to-exit’s “anything found or deferred” rule. A leftover needs a current reproduction or explicit desired outcome, priority and acceptance criterion. Unselected improvements belong in a proposal list, not the active asks.
4. **Use one canonical queue entry per outcome.** Followup messages about the same crash update its incident; they do not create twenty parallel unfinished fixes. Plan rows reference their owning ask, and the brief displays that work once.
5. **Bundle physical-device verification by release and device session.** Keep E264’s hard-cap acceptance explicit. Replace obsolete per-commit phone requests with one current checklist covering memory, recovery, offline audio and touch. Record when code changes invalidate earlier checks.
6. **Require reconciliation when work lands.** A completion command updates the ask, owning plan row and current handoff together; records `landed`, `deployed` and `accepted` separately. Documentation-only work must be closable without a game build ID.
7. **Bound the attention queue.** Start with at most ten ready jobs and three decisions for Jake; everything else is deferred with a reopening trigger. The brief should show counts, expired claims and actionable priorities—not 132 entries on every startup.
8. **Keep one current handoff per lane and archive completed evidence.** Add deterministic checks for missing links, duplicate IDs, terminal parents with active children, expired claims and stale State/table disagreements. Make council archival part of council completion.