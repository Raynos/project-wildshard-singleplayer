# SF72 Driftwood: renderer-free ecology

The trusted headless keeper now owns the shipping `quest/Ecology.ts` queue: the exact kind/variant delays, reverse
due order, separate spawn stream, once-per-second check, 60 m visibility fence and the sailor's night gate. Page
code is unchanged. A return takes the same creature stream draws and entity allocator as practice/captain spawns,
rejoins its saved herd and uses the baked floor (the sailor's hold). Queue, timers, roster and RNG restore exactly.

The practice crab's independent quick return remains; its old ecological queue entry is preserved too, as today.
The renderer-free roster is bounded to 256 native slots, including the captain's reserved slot. Recipes and queue
output are reused; no new per-frame allocation allowance. No engine or map-hash input changed; graph rise zero.

Proof: an executable oracle drives the real page queue and the headless queue through 1,200 seconds, checking
rules, reversed order, both boundary fences and every spawn-stream draw. Real native boar death, an actual walk
out of sight, due materialization and one pending-queue restore suffix are exact. The sailor remains dead through
185 seconds of daylight and returns after night; the hold floor and a post-return restore suffix are exact.
Focused coverage: 2 files / 21 cases pass in 44.73 s. The final sailor floor/restore check passes in 3.55 s.
Clean full ticket1019: 1,058 files / 5,846 passed, 14 skipped, 106.76 s. Root strict, all touched root-config typed
lint, coupling and ratchet checks pass. Private-index hooks are run before landing; generated output stays with
the serialized pusher. Client code is unchanged, so this slice has no new visual or walk-baseline claim.

Open: sword dodge/held-heavy/lunge inputs, canonical gameplay checkpoints, captain mid-fight replay and gameplay
ledger witness are the following SF72 slices. The native scheduler/contact/presentation differences remain
documented in `runtime/keeper.ts`; this step does not claim full shard compatibility.
