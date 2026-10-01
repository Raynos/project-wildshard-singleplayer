# P3 / R6 — intended: decision 40 coyote

The Nine Dragon combat footstep differences are a measured consequence of the requested **100 ms coyote window**, not an input leak introduced during arena setup. Keep coyote and the 120 ms buffer. **Jake still picks P3**; this evidence neither accepts parity snapshots nor changes a baseline.

Decision 40 / [X1 step 6](../../../docs/plans/game-normalization/10-sweeps.md) requires both timings. The lead instructed sol-r10 to classify R6 as intended if grace is correct, without removing coyote or resetting the harness. Its boundary and single-consumption checks pass.

## What Jake sees in the counters

`—` means no event. Counts are events during the scripted route, including settling and the swing. All other combat event IDs and counts are identical.

| Tier | Counter | m5 baseline | Current coyote | Current source, coyote disabled only |
|---|---|---:|---:|---:|
| Desktop | combat `nd.step.metal` | — | 2 | — |
| Desktop | combat `footstep:metal` | — | 1 | — |
| Phone | combat `nd.step.metal` | 2 | 1 | 2 |
| Desktop | walk jumps / lands / stone cues | 8 / 9 / 89 | 9 / 5 / 83 | 8 / 9 / 89 |
| Phone | walk jumps / lands / stone cues | 8 / 9 / 97 | 9 / 6 / 93 | 8 / 9 / 97 |

The escape route's endpoint rises from **126.138 m to 126.582 m**; its max height rises from **127.147 m to 127.329 m**. The isolated no-coyote control restores both endpoints and all walk/combat event maps to the baseline. Disabling only the jump buffer leaves the current walk/combat event maps unchanged. No stuck or out-of-bounds point was introduced by coyote.

## Cause and controls

- Source introduced in `8f9c5566`, activated in `fc043dfe`; current captured source is `df3989476a82869c3e14b9c0127259ecec3d2d88`.
- Fresh captures of the original m5 commit `ee0dd78b2f2977f36f0ed5e44cf0d1da172f13ea` reproduce the stored phone and desktop event maps exactly.
- Diagnostic `505fb212158dbc771be0b1b011d61f6e8f2ce795` changes only the Player condition `this.onGround || this.groundedAgo <= this.coyoteMs` to `this.onGround`. Both tiers then reproduce the baseline walk and combat sound maps exactly, with the same insertion order.
- Jump-buffer-only control `298645ab0207e8f03906afbfca81840dd8503a7c` consumes a jump in input rather than retaining it for the fixed step. It has the same event maps as current source. This rejects the jump buffer as the cause of R6 on these routes.
- Instrumented head/ground controls preserve their uninstrumented event maps. Arena spawn and lunge positions, velocities and relative frame numbers match exactly between controls on both tiers. The changed walk advances `bobTime` differently, and `spawn()` retains that cadence. On desktop the before-arena cadence is **299.860716644 → 304.249094794**; on phone it is **325.821684026 → 330.210062176**. Combat crosses different retained footstep phases. The phone's existing dodge also persists equally in both controls; X1 did not introduce that motion.
- `step.metal.1` is a pre-existing `synth_keeps` slot on both baseline and current source. Coyote's changed cadence/step rotation selects it during the desktop lunge, yielding the extra generic `footstep:metal`. Audio is ready in the traces; no sample or cue migration was needed.

Historical pre-X1 `478f6864` cannot boot Nine Dragon because its primary equipment factory is missing. Rather than treat that failed midpoint as evidence, the diagnosis uses a fresh known-good baseline plus the isolated source controls above.

## Timing checks

A clean export of `df398947` passed **7 Rapier fixture tests**: the four existing player input timing cases plus explicit boundary and post-launch cases.

| Check | Result |
|---|---|
| Grace at 99 ms and exactly 100 ms | Ground jump, launch speed 7.2 |
| Grace at 100.001 ms and 101 ms | Grace expired; existing double jump, speed 8.6 |
| Held press after a launch | One launch; buffered press consumed |
| New press after a coyote or grounded launch | Existing double jump, never a renewed ground-grace launch |
| Third new airborne press after both jumps | No launch |
| Blocked jump at exactly 120 ms / 120.001 ms | Launch / expired |

The tested implementation consumes the jump and sets `groundedAgo = Infinity` on a ground/coyote launch. It preserves the game's existing separate double jump. See [the measured proof](r6-coyote-proof.json) for source SHAs, maps, exact phase observations and checks.

## Reproduce and review limits

All captures used the same default accelerated 30 Hz route, including poses before gate walks and combat; no outer browser-lane wrapper, no acceptance/record/rebaseline flags, no pending-based inference. Example:

```sh
node scripts/parity.mjs --export=df3989476a82869c3e14b9c0127259ecec3d2d88 --lane=m5 --shards=nine-dragon-stack --tiers=phone,desktop --retry=0 --out=/private/tmp/e357-sol-r10/head
```

Run the same command with the baseline and diagnostic SHAs above into distinct output directories. Raw captures, the boundary fixture and its export runner are retained in `/private/tmp/e357-sol-r10/`. The compact proof records their paths and the fixture hash. The full captures exit 1 for historical normalization fingerprints; that is not a claim that the whole milestone gate is green. No runtime or harness change landed, so this evidence-only commit needs no new four-shard runtime boot. Every owned capture context and preview was closed by the harness.

**Recommended P3 answer:** retain 100 ms coyote / 120 ms buffer as requested; include these two combat event fields with B1's measured walk consequence when the lead reviews and accepts the board. Do not waive unrelated sound fields.
