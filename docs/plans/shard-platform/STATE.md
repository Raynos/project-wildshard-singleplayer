# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-09 19:35 CT.** Councils done. Part A only. Origin moved after ~3.5 h stuck (3e16dd96e, includes SF75 `a1731cf57`); the pusher now pushes the green prefix (W25).

**Milestones:**
- **M1:** done.
- **M2:** open. SF22 (33 ms crossing) is sp-x5's; memory verdict = Jake's G269 phone runs (the Simulator can't model phone memory).
- **M3:** open. 1 of 7 at 80/20.

**80/20 (share · compatible):**

| Shard | Share | Compatible |
|---|---|---|
| Template 1 | 90.4 % | ✓ |
| Nine | 23.4 % (A+B held: 33–35 %) | ✓ |
| Signal | 30.5 % | ✓ |
| Sky | 20.7 % | ✓ |
| Pine | 10.5 % | ✗ |
| Driftwood | 2.9 % | ✗ |
| Nalati | 0.4 % | ✗ |

Blender Template (8th) is ~90–97 %.

**Live:**
- Production 1c74e431. The deploy of 3e16dd96e (with SF75) is running.
- Pushes are automatic; standing approvals live in .git/generated-approval.json; the pusher waits while .git/quiet exists.
- P0 SF75 is fixed (`a1731cf57`, with a regression test).

**Codex lanes:**
- **sp-x1:** Nalati witness.
- **sp-x2:** Pine King + bake hashes.
- **sp-x4:** Driftwood headless.
- **sp-x5:** SF22.
- **sp-x6:** Driftwood static bakes.

**Opus lanes:**
- **op-nine4:** Nine A+B.
- **op-loading4:** SF67 Nalati/template.
- **op-pinebake3:** Pine props / tree fallback.
- **op-pineperf:** Pine desktop floor (a quiet window follows).
- **op-sf63:** grid look parity finish.

**Unowned:**
- SF36 weapon rows; SF34 player modes; SF24 / SF27 / SF26 systems rows.
- SF28 panels (RideHUD waits on an E332 HUD-slots method).
- SF59 material graphs; SF64 memory debugger.
- SF66: pack the map image into the shardfile.

**Jake:**
- SF67: the AudioContext constructor is one ~130 ms task; only creating it on the first tap removes it. Pick.
- G269: three phone runs.
- G260: the Blender board.
- Sky's playable isles are per-session random; baking them fixes one look. Pick.
- **Pick:** the public Pine and Nalati cards boot the frozen legacy copies, so SF67 loading fixes reach only Developer. Recommendation: flip each public entry to shardfile once its SHARDFILE entry passes boot, walk and parity.
