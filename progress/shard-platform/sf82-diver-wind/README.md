# SF82 BR-1: wind diver preset

The shared `DiverBrain` now owns Nalati Storm-Wing’s wind orbit, tells, fixed-target stoop, grounded weak point and cooldown continuation. `WindStooperBrain` is its parameter preset. The encounter still supplies its real body after spawning, wind/terrain, shared RNG, callbacks and the separate native manager/frame cadence. No placeholder actor is constructed.

The authenticated shipping Qyran oracle, preset and direct wind profile match over 2,400 variable-step frames, including phase two, hit/miss stoops, all five phases, leash, body state, callback order and RNG. Per-frame SHA-256 trace digests are identical. Both public constructors restore the mid-stoop 600-frame suffix exactly; malformed continuation refuses atomically, and null-body frames emit no callbacks or random draws. The orbit/patrol/burst and phased Matriarch regression cases remain green.

Actual Node Nalati capture and a second capture comparison preserve all 35 actors, 2,694 solids, terrain, material/owner metadata and placements. Only source provenance changes. The native physics input fence now names the shared diver source; this is an actual recapture, not a hash-only update. Four existing shard witnesses retain their exact gameplay outcomes and checkpoint payloads.

Focused checks: 47 tests in seven files; root/layer strict and touched typed lint pass. The approved downward move adds one defining engine import in `windStooper.ts` (shard-engine-imports 1 → 2); its exact receipt row is supplied for push regeneration. No new package export is introduced.

Open: group/herd/hunt patterns, complete creature-row encounter ports for wind/howl/pounce, boss-row consolidation and shard adoption (BR-2–5). Existing author rows are not claimed to host an unbound encounter.
