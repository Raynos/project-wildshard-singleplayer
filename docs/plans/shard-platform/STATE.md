# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-09 17:00 CT.** Councils done. Part A only.

**Milestones:**
- **M1:** done.
- **M2:** open. SF57 forced-compressed soak running (sp-x5); then SF22 gates and G269 phone runs.
- **M3:** open. 1 of 7 at 80/20.

**80/20 (share · runtime/ceiling · compatible):**

| Shard | Share | Runtime / ceiling | Compatible |
|---|---|---|---|
| Template 1 | 90.4 % | — | ✓ |
| Signal | 20.9 % (25.4 % candidate) | 806/965 | ✓ |
| Sky | 18.5 % (`124b14522`) | 1288/1377 | ✓ |
| Pine | 3.1 % | 5317/4339 | ✗ |
| Driftwood | 1.0 % | 5868/3753 | ✗ |
| Nalati | 0.4 % | 9583/6618 | ✗ |
| Nine | 0.2 % | 722/5033 | ✗ |

Blender Template (8th) is 97 %. The rest needs SDK systems: an offline skinned bake, effect/look rows, boss/quest rows.

**Live:**
- Production 1c74e431 (G258, G266, G270, G271, shadow fix).
- Prod grid regression (Jake 21:25 UTC) is owned by the plan agent's grid-fix lane.
- Pushes are automatic (auto-push.sh). Standing approvals live in .git/generated-approval.json, and the pusher waits while .git/quiet exists.

**Floors on HEAD (`bb4d2409b`):**
- Simulator: 8/8.
- Grids: pass.
- Desktop: 7/8. The Pine cabin is GPU-bound at vsync; the label fix `64b9b57ef` is in, and its rerun is queued to sp-x5.

**Codex lanes:**
- **sp-x1:** Nalati witness (elites, Kokbori, Qyran, Qara, ghosts done).
- **sp-x2:** Pine King activation (lands before the cabin bake).
- **sp-x4:** Driftwood. Posed volumes are live (`661da2660`); next ragdolls, camera, prompts.
- **sp-x5:** SF57 → Pine floor rerun → SF22.
- **sp-x6:** Driftwood static bakes (`38df10ae3` modelGeometry).

**Opus lanes:**
- **op-signal2:** Signal SDK look-family rows, whip view, species clips (Signal at 26.5 %, `f6691ec7c`).
- **op-loading2:** SF67 slicing land + benchmark.
- **op-pinebake:** Pine cabin + static builders.
- **op-nine:** Nine ledger + bakes.
- **op-skin:** SDK offline skinned-model bake.

**Unowned:**
- **NEXT Opus slot:** Pine desktop headroom. The quiet floor at c7de9850e FAILED (spawn median 30 fps, p95 33.4 ms, main-thread work p95 22–29 ms) at load ~43 that quiet can't remove (non-platform ffmpeg); op-floor passed it at load 5–7. GPU 16.8 ms at the vsync edge (N8AO 3.8, shadow PCF +0.6–1.0). Need ≥ 2 ms GPU + CPU headroom with no look change.
- **M2 memory:** the Simulator can't model phone memory (forced-compressed mixes Basis RGBA; SF57 peak 1,756 MB), so M2's memory verdict = Jake's G269 phone runs (`4f1f6772e`).
- SF36 weapon rows;
- SF34 player modes;
- SF24, SF27, SF26 systems rows;
- SF28 panels;
- SF59/SF63 look;
- SF64 Simulator capture;
- SF67 benchmark + sliced-world branch (parked: sf67-sliced-world-candidate);
- SF66 map in shardfile.

**Jake:**
- G269: three phone runs.
- G260: Blender board.
- Sky's playable isles are per-session random; baking them fixes one look (pick).
- **Pick:** the public Pine and Nalati cards boot the FROZEN legacy copies (entries.public='legacy'), so every SF67 loading fix reaches only the shardfile entry (Developer). Public Nalati cold-loads in 68.9 s with a 10.4 s freeze (op-loading2, 72aaeaa2e). Recommendation: flip the public entries to shardfile per shard once its SHARDFILE entry passes boot, walk and parity.
