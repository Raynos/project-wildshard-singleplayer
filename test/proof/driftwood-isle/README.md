# Driftwood native gameplay witness

Use Node's real SDK loader and type transform, without browser globals:

```
node --experimental-transform-types --import ./scripts/sim-node-loader.mjs test/proof/driftwood-isle/run.mjs checkpoints
node --experimental-transform-types --import ./scripts/sim-node-loader.mjs test/proof/driftwood-isle/run.mjs record
node --experimental-transform-types --import ./scripts/sim-node-loader.mjs test/proof/driftwood-isle/run.mjs fresh
node --experimental-transform-types --import ./scripts/sim-node-loader.mjs test/proof/driftwood-isle/run.mjs reef
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

SF34 installs the actual lowered sea, including its four dry sockets, before fresh play and before restore. Its Gerstner
bob reads the host's own restored clock. The wet Sealed Ring tape now takes 19,816 ticks (previously 19,255): wading
changes travel and fight positions, so the key approach follows the sailor's actual fall. The real Captain checkpoint
is tick 18,898 at 190 HP; victory/reward follows in 918 ticks. The changed gameplay also defeats three nearby plate crabs
instead of two. These are recorded outcomes of the shipping water law, not grants or adjusted combat tuning.

The independent reef proof starts at the real spawn, swims east around the island and crosses the jetty's dry asphalt
approach, then dives to the actual optional chest. It earns eight doubloons in the pack and one durable treasure fact.
It restores the earned mid-dive checkpoint in the native host and SDK worker. The 60-worker-tick window includes held
DIVE, the real treasure command and held SURFACE; the native original/restored pair continues through the complete
137-tick suffix to surface. Complete canonical physics agrees at worker boundaries and at the final native state;
player/swim state and effects agree every native tick. The reef route itself consumes no cached Sealed Ring checkpoints.
Whole-shard compatibility remains false for the other laws in `open`.

Living creature head/body/fore volumes now use the actual baked rig rest chains and the shipping scalar/custom
pose laws. The browser baker checks each chain against the loaded skeleton inverse binds. Contacts read the previous
published pose, while body updates advance current locals; snapshots preserve both. The source-hashed native oracle
covers each living rig for 10k frames and a restored suffix, including 60 / 30 / 20 Hz and paused scheduling.
Rendered ragdoll bodies remain outside the witness.

The sailor rise/sink/deck transition has one pure defining function, called by the page animation and the trusted body
callback. Visual rig work stays on the page. Actual Driftwood and Pine browser captures retain every earlier gameplay
field; Driftwood adds 35 captured pose recipes. Before the SF34 swim extension above, the tape stayed at 19,255 ticks, with the living Captain at
18,339 (190 HP), the same fact ticks and the same 916-tick fight/reward suffix. Its new checkpoint payloads include the
pose continuations. Exact original/restored state, 60 SDK-worker ticks and durable/refused-write ledger proofs pass.
Jake picked flared pier ramps (plan ca6e4631e); they are the only path. The straight variant and Debug row are removed.

Chest items now use the shipping pack law and authored Driftwood catalogue, with copied, strictly bounded pack
continuations. The real tape earns two doubloons from Wendell's chest and three from the strongbox: five pack items,
separate from purse coins (the 10k prefix still has two; the strongbox opens at tick 11,101). A focused native prompt test opens the actual reef chest, earns its eight doubloons and
treasure fact, then restores exactly and refuses a duplicate opening. That test places the player at the prompt and
does not claim underwater travel by itself; the independent reef journey above now covers that approach. Reward
carry/camera and travel to the zipline launch remain open.
