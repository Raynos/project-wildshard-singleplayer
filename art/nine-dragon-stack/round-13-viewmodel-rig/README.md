# Round 13 · the first-person arm rig (lab P8 "viewmodel", E169)

Jake on round 9's motion sheet: "the texture quality and the model quality is surprisingly good" — but "the hand twisting
and going in a completely broken snap fashion … something in the animation and the rigging is completely fucked".

He was right, for three reasons:
- The round-9 glove was bolted to the sword and turned with it.
- The sleeve was aimed at a screen point, with no roll continuity.
- The moves were per-axis Euler deltas about the guard, so a cut flipped the grip over the blade and folded the wrist
  past 90°.

This round replaces all of it with a real rig. It keeps round 9's models and textures, and is delivered **engine-ready**:
one skinned GLB with named clips, and a small player module. The shard is moving into the engine as
`src/chunks/nine-dragon-stack/` (P0-5c); the clean room's `vm/` was not touched.

## The evidence

| File | What |
|---|---|
| `motion-before-after.jpg` | Round 9 (left) and round 13 (right), side by side, same 4 × 6 layout. The two halves are also saved on their own as `motion-before.jpg` and `motion-after.jpg`. Rows: idle ×3 + walk ×3 · light slash ×6 · charge + heavy ×5 · parry ×3 + sheathed + draw ×2. Frames at 60 Hz, 1206×2622. |
| `moves-real-speed.mp4` (6.4 MB) | Every move at real speed, 1206×2622, 60 fps, muted: idle → light, light2, light3 chained at `slashEnd` → charge / heavy → parry → a light interrupted by a parry at 0.12 s (the crossfade) → sheathe / draw → walk + a light while walking → the Fei Zhua's aim / fire / hold → idle. 12.97 s. |
| `moves-quarter-speed.mp4` (7.9 MB) | The first 5.75 s of that sequence (the light combo, charge + heavy, both parries) at ¼ speed, 60 fps. |
| `rest-vs-mockups.jpg` | The idle rest on the spawn camera: target-1 · style A · round 9 · round 13. The rest keeps the mockups' long jian diagonal from the bottom right and the prominent red tassel. |
| `rig-gate.jpg`, `rig-gate.json` | The rig gate (below): every joint angle over the scripted sequence at 60 Hz, with the limits and the events. |

## The rig gate (automated: `riggate.mjs` → `__ndVm.gate()` + `__ndVm.skin()`)

- **What it plays:** the scripted sequence (`GATE_SCRIPT` in `main.ts`) through the shipped path: `fp-rig.glb` →
  `NineDragonArms` → three's AnimationMixer. That means crossfades, chains and interrupts included; it is not the
  authoring solver.
- **What it reads, every frame at 60 Hz, from the played bones:**
  - both arms' elbow flexion, pronation / supination, wrist flexion / extension and radial / ulnar deviation (swing-twist
    about the forearm, `rig.ts measure`);
  - their angular velocities;
  - the second difference: a snap is a spike there;
  - the deepest point of the tassel or talisman inside the fist, the palm, the forearm or the guard.

**Result: PASS, 778 frames.**

| Joint | Range (°) | Limit (°) | Max \|ω\| (°/s) | Limit (°/s) | Max \|Δ²\| (°/frame²) |
|---|---|---|---|---|---|
| R elbow | 26 … 89 | 0 … 150 | 442 | 1500 | 4.6 |
| R pronation | −38 … 59 | ±75 | 667 | 1500 | 10.8 |
| R flexion / extension | −2 … 21 | ±60 | 236 | 1200 | 2.8 |
| R deviation | −30.5 … −2 | −32 … +22 | 478 | 900 | 5.4 |
| L elbow | 58 … 113 | 0 … 150 | 540 | 1500 | 9.0 |
| L pronation | 45 … 70 | ±75 | 293 | 1500 | 4.0 |
| L wrist | 0 (the fist rides the gauntlet straight) | — | 0 | — | 0 |

The \|Δ²\| limit is 12 °/frame² for every joint.

- **Cloth:** the deepest tassel or talisman point inside the hand, forearm or guard is **0.0 mm** (limit 5).
- **Skin** (10 skinned meshes, 102,766 vertices):
  - weights sum to 1 (max error 0);
  - 0 joint indices out of range;
  - bind restore error 7e-16.

Round 9's hand, measured the same way on this rig (`gate-r2`, the old rigid-grip glove), failed:
- pronation 2215 °/s with 37 °/frame² spikes;
- the wrist clamped by up to 107°.

The deviation limit is −32 / +22, not ±25. A jian held in the diagonal grip lives in ulnar deviation: the modelled hand
has 23°, and the anatomical range is 30–35° ulnar, ~20° radial. The rest sits at −29 … −30.

## What changed

1. **A real hand pose.**
   - The round-9 glove was a correct right hand in a grip no arm can reach from the right shoulder. Every rotation round
     the grip × every elbow swivel needed either ~160° of supination or ~60° of ulnar deviation (a brute-force search).
   - The hand fork re-posed it into the **diagonal jian grip** (`blender/hand_model.py DiagonalHand`):
     - the back of the hand faces the eye;
     - the forearm continues the grip line, 3° off it;
     - 23° of modelled ulnar deviation;
     - the pommel tucks against the heel of the hand.
2. **The armature** (`rig.ts`):
   - Per arm: shoulder → upper arm → forearm, with **three twist bones** (a pure roll carrying 90 / 60 / 25 % of the
     pronation change: no candy-wrapper, no glove spinning on its own) → hand → R_weapon / L_claw.
   - Upper arm 0.33 / 0.31 m, forearm 0.30 m (the left is scaled 0.82 from its 1.2×-oversize model).
   - Anatomical shoulders at (±0.17, −0.19, −0.05) from the eye.
3. **The skin** (`bake.ts`): weights from the geometry, by distance along the rest forearm.
   - The glove blends hand → twist1 over the wrist's first 3.5 cm.
   - The sleeves use tent weights over the twists, plus the upper arm over the elbow's last 3 cm.
   - The gauntlet's brass shell rides twist1 rigidly.
   - The fist is 100 % hand.
   - The upper-arm sleeve stops 14 cm past the elbow. A full one swept across the lens on the heavy.
4. **Driven by the weapon.** Every clip is authored as the path of the jian (right) or the gauntlet (left); the arm
   follows through two-bone IK (`twoBone`).
   - **The pole:** the elbow is behind the wrist along the hand's own forearm axis, so the wrist stays near its modelled
     pose.
   - **The reach:** a soft tanh knee over the last 10 %. A hard clamp kinks the motion.
   - **The wrist:** a swing-twist clamp to the limits, soft from 80 %. The hand wins and the weapon follows it: the hand
     is locked to the grip.
   - Rotations are quaternions only (slerp). The grip point is interpolated, not the guard, so a turn pivots in the
     fist.
5. **The motion** (`moves.ts`):
   - **Authored on screen.** The strikes are authored on the portrait viewmodel camera, which has only ±18° of
     horizontal view: the fist's point and the tip's point in NDC at the cocked pose and at the follow-through, then one
     slerp between them.
   - **Edge and wrist.** Both ends keep the same side of the flat toward the cut plane. A per-pose search over the flat's
     side, a ±70° roll and a ±7° lean picks what the wrist holds best. Its cost is the limits, the clamp, and how far the
     forearm turns from its rest pronation (a cut that starts with a 90° roll reads as a snap).
   - **Phases.** Anticipation → strike → follow-through → recovery, each on a minimum-jerk profile. The peak falls inside
     the engine's active window.
   - **Timing** is the engine's (`SwordMoves.ts`): light = SLASH (0.07 / 0.235 / 0.35), light2 = BACKHAND, light3 =
     FINISHER, charge = CHARGE_BLEND 0.16, heavy = HEAVY (0.06 / 0.30 / 0.62).
   - **Idle** is a 3.2 s breath (4 mm). **Walk** is a 0.8 s figure-8 (±9 mm), synced to the step phase.
6. **Crossfades, never restarts** (`fpArms.ts Channel`):
   - Each arm has a base loop (idle ↔ walk by speed) under one-shot moves.
   - A new move fades in over 100 ms while the old one keeps playing and fades out, so a combo chain, or a parry
     interrupting a slash, blends from wherever the arm is.
   - A finished move fades back to the base over 150 ms.
   - `charge` and `sheathe` hold until the next move.
7. **Cloth that respects the hand.**
   - The tassel is 24 strands × 9 points, 17 cm, bigger as dome A asked. The talisman is 6 × 16.5 cm.
   - Both collide with four capsules: the fist round the grip, the palm mass, the forearm, the guard.
   - Their tubes' winding was inside out (the ink hull covered the silk: the "black tassel"). Fixed.
8. **The triangle diet** (dome A: the vm hulls were ~330 k of a 2.28 M frame):
   - the guard is 30 k, not 60 k;
   - the sword and the guard are merged into one mesh (`R_jian`);
   - hulls are drawn only from decimated proxies (`gltf-transform simplify`, 25–50 %), and never on the blade (its neon
     edges are its silhouette);
   - the cut-off back of the guard is capped.

## Cost

Measured at 1206×2622, in the lab, on the M5 Max.

| Metric | Round 9 | Round 13 |
|---|---|---|
| Triangles rasterised by the vm | 357 k | **214 k** (147 k body + 62 k hull + cloth) |
| Draw calls (vm) | 23 | 23 |
| GPU ms / frame (`bench(120)`, median of 2) | ≈ 0.3–0.4 | **≈ 0.3** (1.65 with the vm vs 1.36 without; the plate and post alone cost 1.36) |

- CPU per frame:
  - the mixer: 16 bones over 2 channels;
  - the cloth: ~260 points × 4 sub-steps, plus 4 capsules;
  - the GPU skinning: bone texture, 7 bones per skeleton.
- What ships to the engine is 4.95 MB:
  - `fp-rig.glb` 2.48 MB (meshopt, 16 clips);
  - the four map pairs 2.47 MB.

## Engine hand-off

**Ship these:**
- `public/assets/nine-dragon/lab/viewmodel/fp-rig.glb` + `{hand-r,arm-r,fist-l,gauntlet}-{maps,nrm}.webp`;
- the module `src/dev/nd-lab/viewmodel/fpArms.ts`, with `materials.ts`, `cloth.ts`, `trail.ts`, `jian.ts` (the halo),
  `geo.ts` and `rig.ts` (the gate's `measure`) from the same folder.

**Leave these in the lab:** `bake.ts`, `moves.ts`, `main.ts`, `post.ts`, `assets.ts`, `blender/`, `viewmodel.ts` (round
9) and the `bake/` + `plates/` assets.

```ts
const arms = await NineDragonArms.load();           // RIG_URL; the maps next to it
camera.add(arms.root);                              // or the viewmodel pass's scene (the rig is in camera space)
arms.layout(vmCamera);                              // fits the root; the clips are framed for a 70° vertical viewmodel FOV on portrait
arms.resize(bufferW, bufferH, pixelRatio);          // ink widths + the halo are in pixels
// input → moves (the engine's timing lives in arms.moves[name].timing = { windup, slashEnd, total, sweep }):
arms.play('light' | 'light2' | 'light3' | 'charge' | 'heavy' | 'parry' | 'draw' | 'sheathe', fade = 0.1);
arms.playLeft('grapple_aim' | 'grapple_fire' | 'grapple_hold' | 'idle');   // P9's flying claw: arms.setClawVisible(false)
// per frame, after the player:
arms.update(dt, { speed, walkPhase: player.bobTime, lookVel, gravity: (0, −cos pitch, −sin pitch)·9.8 });
// the hit sweep + trail: while arms.active (windup … slashEnd), arms.blade(base, tip, from) in root space;
// the grapple's filament origin: arms.muzzle(out)
```

- **Draw order.** Every mesh is plain three.js: hulls at renderOrder −1, the cloth and the halo after. Put the root
  under the engine's viewmodel clearer / depth slice (`worldDepth.ts`) the way `Sword.ts` does.
- **FOV.** The clips are framed for the clean room's 70° vertical viewmodel projection on the iPhone portrait. The
  engine's world camera is ≈ 94° (Hor+). Either give the viewmodel pass its own 70° projection (the mockup look, as most
  first-person games do), or let `layout()` fit the root to the world camera: a smaller rig.
- **The combo** mirrors `Sword.ts`: play `light2` at light's `slashEnd` (+ CHAIN_LAG), then `light3`. The crossfade
  carries the arm through.

## How to rebuild

1. The hand (only if the model changes):
   `blender -b --factory-startup --python src/dev/nd-lab/viewmodel/blender/hand.py -- --out public/assets/nine-dragon/lab/viewmodel --scratch <dir>`.
   Then re-make its hull proxy: `gltf-transform simplify hand-r.glb bake/hand-r-hull.glb --ratio 0.3`.
   **A stale proxy draws the old hand's silhouette in black**: it happened once this round.
2. The bake. The lab page's `__ndVm.bake()` builds the rig from the part GLBs and exports the GLB (`rigbake.mjs` writes
   it). Then run `pnpm exec gltf-transform meshopt fp-rig.raw.glb public/.../fp-rig.glb --level medium`.
3. The gate: `riggate.mjs gate.json`, then `gate_chart.py gate.json rig-gate.jpg`.

## Not done / next

- **Fingers.** The finger bones are omitted: the fingers are skinned rigid to the hand, fine for a fixed grip. A
  grip-tighten on the strike would need finger groups.
- **The left wrist** is held straight (the fist rides the gauntlet). The grapple aim points at the frame's centre only;
  aiming at an arbitrary hook needs a runtime IK or an aim blend space.
- **Landscape** is framed by `layout()` only; its composition is untuned.
- **Weak spots of the re-posed glove** (the hand fork's list): slightly separated fingertips from the fingers' side, and
  ~10 % bad normals on stud / buckle contact faces.
