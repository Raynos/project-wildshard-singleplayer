# Driftwood native gameplay witness

Use Node's real SDK loader and type transform, without browser globals:

```
node --experimental-transform-types --import ./scripts/sim-node-loader.mjs test/proof/driftwood-isle/run.mjs checkpoints
node --experimental-transform-types --import ./scripts/sim-node-loader.mjs test/proof/driftwood-isle/run.mjs record
node --experimental-transform-types --import ./scripts/sim-node-loader.mjs test/proof/driftwood-isle/run.mjs fresh
```

`checkpoints` authors a bounded continuous player-command tape in the actual trusted `runtime/headless.ts`: Wendell,
the flint chest, the lookout and beacon, the hold sailor/key/pump/winch/strongbox, iron sword, the nearby plate crabs, the physical
barrel on plate B and player on plate A, the sluice and cave shard, the altar, the living Captain and the reward.
No code writes player poses, HP, flags, grants or actor decisions. If the player dies or the tape stalls, it fails.
At the living Captain it also restores a fork and compares the **uninterrupted original** against that fork through
victory/reward: full canonical state and committed effects, exactly. Every captured profile prefix came from those
completed ticks' actual effects. The second quest fact at reward is recorded honestly; the ledger grants only once.

CI runs `headless` (10k ticks plus the real 92/92 entry proof), `slice-tick-10000`, `slice-captain`, `replay`
(the actual mid-fight checkpoint, exact suffix, and 60 SDK-worker ticks), and `ledger-spawn` / `ledger-tick-10000` /
`ledger-captain`. Each slice executes at most 10k ticks. The worker wrapper installs the same platform-stable test math
before importing the same production runtime; it replaces no gameplay. Canonical hashes compare native world state,
including exact poses/velocities/contacts, rather than Rapier's noncanonical serialization order.

`fresh` hashes every loaded repository module, the runner/loader/lockfile and physics module. It checks the input tape
and each compressed checkpoint SHA too. A changed input refuses the old checkpoints; regenerate from real play.
Snapshots also carry their actual profile prefixes, so reload/refusal/retry/dedupe proves earned achievements rather
than synthetic facts. `record` writes `compatibility.json` from executing these proofs. `all` is deliberately nonzero:
the scoped gameplay proofs pass, but **whole-shard compatibility remains false** while `open` lists the page laws and
optional gameplay not covered here. This is not a claim of browser parity for every contact/rig/camera/optional quest.

The sailor nonvisual rise/sink/deck continuation is copied only in the trusted body callback. Its executable native
oracle runs the actual shipping source block (hash-fenced) for 10k 30/60-Hz frames and an interrupted/restored rise.
Moving the shipping block would change a physics-bake input, so page rig/animation and bakes stay untouched.
Jake picked flared pier ramps (plan ca6e4631e); they are the only path. The straight variant and Debug row are removed.
