# Pine King collision and ranged continuation — bounded receipt

Plan-State: unchanged. Whole-Pine compatibility remains false.

The King scalar animation is one shared law. Its collision-only four-joint FK reads the actual GLB rest chain, with three clip samples baked at 60 Hz and strict source/asset hashes. The page visuals remain live and skinned. FK hit queries are **not activated**: the measured rendered volumes agree, but pre-render hit-delivery matrix caching is still unproved.

The old/new visual oracle covers 2,400 ticks, 22 joints and 844,800 matrix components with exactly zero difference and identical scalar memory. This synthetic oracle is separate from the real fight capture. The latter samples 1,080 rendered frames across all three developer-started phases, nine observed fight modes, and no page errors. Maximum old-live-bone versus FK volume error is 3.9721e-15 m against a stated 1e-10 m epsilon. These are render-time observations after scene matrix propagation; they do not establish every fixed-step damage delivery. See the compressed trace and comparison JSON.

The single actual Pine bake reads twice independently from private capture pin d4ba445f20e7705412294e3c7666a97d57d20ebe. Both reads are identical: 164 actors, 918 trees, 2,078 solids and 50 registered pieces. Geometry, ground, actor starts, herds and parked creatures match the prior committed bake. Tags now retain actual material and owner provenance (2,070 piece owners, four declared owners, four untagged solids), so native contacts no longer default all surfaces to wood. Unknown owner objects refuse capture. Restoring rebuilds tags with stable host-owned identity.

One corrected native outcome is intentional: the main King capsule's Y pitch uses the shipping positive-sine convention. The prior bake inverted the two endpoint Y values (1.716914/1.383086 m); the fresh bake matches shipping (1.383086/1.716914 m). This is not claimed byte-identical gameplay.

Native longbow shafts retain the page's 48-slot stopped-arrow pool, yaw attachment/death drop, eighth-update pickup cadence, capacity-before-RNG ordering and 70% recovery decision. A real Rapier continuation fires, lands, saves, restores and takes the shaft; full suffix state and RNG match. Surface fixtures cover stone/metal glances and ground/wood sticking. Ranged cones and optional movement/ADS samples use the shared laws. The serialized gust clock requires a boost callback from the future single weather owner; it never constructs Weather. Without the page motion/weather bindings, standing spread and still-air outcomes remain open. Custom stopped crossbow bolts remain separate work.

The actual checkpoints and record/fresh proof include the SF55a lockfile landing (9b1fead83). Input fingerprint: `511bee80987f122aee841a3652a7c8027e61bcd55c1bcbf53da3965ec768c079`. Full canonical digest: `d0a8221c52308bc5fb3bbd3b4512ec2a21a8724641e19f80802a00de3ab095b9`; 1,200-tick phase-II replay: `fb0675b14220c6397d475e4b259cb8ae7978c4ebd48b221e3adeaacb3f21a217`, equal after restore with no repeated fact. King defeat remains tick 29,295 and tape completion tick 30,015; the two resin takes, pack, quota retry and duplicate ledger refusal pass. Root/scripts strict, touched lint, paths, ratchet, coupling and nine focused files / 35 checks pass. The clean full run passes 1,093 files / 5,974 checks / 14 skipped in 121.15 s, with its sole generated AG7 graph mismatch refreshed only inside the export and that guard rerun separately. Arm64 and Rosetta x64 full native JSON outputs are byte-identical. No shared generated files are included in the source landing.

Reproduce the bounded render observation (phone capture, muted, finally closed):

```sh
scripts/browser-lane.sh node progress/shard-platform/sf72-pine/king-combat/capture-king-fight.mjs http://127.0.0.1:PORT/ /tmp/king-trace.json
node --import ./scripts/sim-node-loader.mjs progress/shard-platform/sf72-pine/king-combat/compare-king-fight.mjs /tmp/king-trace.json /tmp/king-comparison.json
```

Regenerate the strict table with `node --import ./scripts/sim-node-loader.mjs scripts/bake-pine-king-collision.mjs`. Actual physics capture uses `scripts/bake-pine-physics.mjs` through browser-lane and requires two identical reads. Native checkpoint generation and record/fresh commands are documented in the parent README.
