# Handoff (sf72-nalati18) — owned native player driver and raw controls

Coordinator wildshard-new pushes. Plan-State: unchanged. Nalati canonical qualification remains fail-closed.

`SimHost.usePlayerDriver({input, step})` installs one scope-owned motion driver on an owned active host. Its input
runs after the tick clock and before the sole native physics step; returning true delegates motion to its post-physics
step. Ordinary walk/board/jump/dodge are skipped only while delegated; targeted attacks, creature bodies/systems,
health and fixed-post still advance once. False or no driver preserves the ordinary law and snapshot bytes. Borrowed,
frozen, disposed and duplicate installs refuse; early removal releases the captured callback. Dynamic driver clocks
and native handles use the existing state adapter and physicsRestored continuation contract.

Command version 1 adds optional raw local `{keyX,keyY,stickX,stickY}` and held sprint/crouch. Missing/unsupported
versions, malformed/extra/nonfinite/out-of-range axes and nonboolean held fields refuse before host mutation.
The SDK forwards detached fields through one helper in both worker paths. `Player.sampleSteer()` reads the semantic
directions and touch stick separately; `sampleCommand(1)` explicitly opts a recorder in. Ordinary page sampling has
the original shape. Actual rider input consumption, lying-capsule motion and page/headless continuation are NEXT,
not claimed by this generic port.

Five real-Rapier driver tests cover frame order, single authority, actual native movement/targeted combat, exact
ordinary bytes, restore suffix, rejected owners and disposer census. Three command tests cover strict wire admission,
detached forwarding to the real driver and the real page producer. Fourteen combined timing/control checks pass;
the eight new cases pass under coverage in 5.74 s. Root strict/root and touched lint/ratchet/SF2 pass.
All four existing witness recorders were run for real: every one of the 15 compressed checkpoints is byte-identical,
and Pine/Driftwood recorded outcomes are exactly equal apart from the source-input hash. All four freshness checks
pass. The full-suite result is recorded in the accompanying player-driver receipt.

Next in the original task order: extract and host Mount's actual lying-capsule motor/query/position law, including
its custom clocks and real horse gait phase; make the page and native reins consume the same command-v1 producer
before presses are consumed. Add actual native terrain/deck/rail/ditch/touch and restored-motor proofs, then crouch.
After those: Golden King/Storm Titan, swept sabre/held heavy, then committed canonical checkpoints/freshness hashes.
Do not infer mounted gameplay from the reins decision oracle or this driver fixture.

Ordering: this source rebases on diagnostic 4bfc5a445 plus tar forward 7f30a2f72; the G258 claim forward and Nalati
NPC relocation rebuild after this defining SHA. No actor/geometry/map input changed here; no native physics rebake.
SDK→engine +1 type-only sim import approved by coordinator. No raw shard reach or coupling change.

Scratch `/private/tmp/claude-501/sp-builders/sp-x1/nalati18/`; reusable clean export `../nalati12/candidate/`.
`refresh.py` runs actual checkpoint/compatibility recorders and verifies compressed bytes; `witness-summary.json`
keeps all hashes/timings. `command.py` is the one-time private edit builder, not safe to rerun over finished edits.
No owned preview/browser/Simulator. Current-HEAD private index, explicit hooks, old-value CAS, exact paths,
subject/stat/ancestor verification, preserve foreign ENGINE prose and all foreign disk/index entries.
