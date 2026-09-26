# Round 9 · lab P9 "grapple": the Fei Zhua in action, first person (E169)

Jake (2026-09-25): "polish and remaster and upscale the first person — the grappling hook … pumped to the max."
The 飛爪 Fei Zhua is shard 4's signature: a wrist grapple on the left forearm that bites brass dragon hooks and zips you
between strata. Lab P8 "viewmodel" owns the jian, the hands and the resting arms. This lab owns the grapple in action.

- Page: `dev/nd-lab-grapple.html`. Code: `src/dev/nd-lab/grapple/`. Models: `public/assets/nine-dragon/lab/grapple/`
  (**902 KB total**: `fei-zhua.glb` 402 KB, `dragon-hook.glb` 500 KB).
- The page plays two takes in a loop: `hook` (3.6 s), then `miss` (2.4 s). It is driven headless through
  `window.__ndGrapple` (no URL switches): `ready`, `pixelRatio(r)`, `seek(take, t)`, `play(on)`, `snapshot(w, h, q)`,
  `stats()`, `bench(n)`, `set(key, v)`, `takes()`, `duration(take)`, `debug()`.
  - `set` keys: `hullPx`, `corePx`, `haloPx`, `bloom`, `env`, `ticks`, `gain`, `gamma`, `sat`, `world` (0 hides the
    Well), `vm` (0 hides the arm).
- `capture.mjs` (here) is the Playwright driver: stills, benches and video frames. Run it under the lab's browser lock.

| File | What |
|---|---|
| **`grapple.mp4`** | **The loop to watch.** 5.7 s, 640×1392, 30 fps, H.264, no audio track. The hook take (0–3.53 s), then the miss take (0.2–2.3 s). |
| **`strip.jpg`** | **12 frames of the full sequence**: aim · lock · fire · fly · bite · zip · arrive · release · vault · land, then the miss's snap and reel. |
| `final.jpg` | Top: comp-B next to 5 final frames. Bottom: the gauntlet vs comp-B, the hook vs its codex edit, the dragon in profile. |
| `models.jpg` | The hook's codex ref → TRELLIS.2 → in game; the Blender gauntlet → in game. |
| `loop-01…09.jpg` | Each loop's capture next to its target. The captions say what was wrong and what changed. |

## What was built

| Piece | How | File |
|---|---|---|
| **Gauntlet** (hero) | **Blender, headless.** A carbon bracer with two leather straps and brass buckles, and wide riveted brass cuffs at the wrist and elbow. On top, a brass housing: two plates with a panel gap, a carbon skirt, 23 domed dragon scales and two rivet rows. The barrel has bands, a carbon sleeve and a flared muzzle collar with 3 talon guides. Also: a capacitor (a glow core in a brass cage with end caps), a conduit, and 3 status LEDs in bezels. The **spool** on the inner side has spoked flanges and glowing filament windings. The filament guide eyelet sits above it. Bevel + harden → weighted normals. **Cycles AO baked into the vertex colours** (the arm with the claw docked; the claw alone). 41.7 k tris. | `blender/fei_zhua.py` |
| **Claw** | Blender. A brass hub with a band, a faceted steel nose spike, 3 clevis knuckles, and a glowing rear eyelet where the line ties on. **One talon** (link arm, rib, piston, joint, and a curved raptor blade with a lens section, sharp edge inward) is cloned at 90 / 210 / 330°. Hinge angles: fold 2°, armed 34°, open 64°, grip 20°. | same |
| Fist, sleeve | Blender stand-ins (P8 owns them): a gloved fist; an indigo sleeve with folds and two braided red silk cords, their pitch irregular. | same |
| **Dragon-head ornament** on the launcher | The dragon hook's TRELLIS casting with its plate and ring clipped off, 7.8 cm long, on the barrel's saddle (comp-B paints one there). | `feizhua.ts setOrnament` |
| **Dragon hook** (hero) | **TRELLIS.2.** A codex `image_gen` ref (one object on white, side profile) → `1024_cascade` (a 9.5 M-face raw generation, 229 s) → `driftwood_post.py --keep-texture` (18 k tris, 1024² albedo + a normal map baked from the 60 k mesh) → meshopt. The ring came through as solid metal. | `hook.ts` |
| Hero program | A painted-realistic metal, driven by the baked data in COLOR_0 (AO, convexity, class, emit group). It reflects an analytic world-space environment: sky-screen ceiling bars, a band of warm windows, two neon smears, the dark drop. Also: a GGX key, a warm fill from below, magenta and cyan neon rims, the muzzle flash and the capacitor glow as point lights. Per class: engraved brass (triplanar 祥云 / 回纹 canvas), polished bevel wear and patina in the creases; carbon twill with an anisotropic sheen under a clear coat; leather; braided silk; cloth; blade brass; HDR glow. Plus an **ink hull**, brushed on living parts. | `vm-material.ts` |
| **Mono-filament** | A **verlet rope**: 44 nodes, stepped at a fixed 240 Hz from the moment of the shot, both ends pinned (the muzzle; the claw's eyelet). It resists stretch only. `slack` > 1 sags and whips; 1 is taut. A **feed** straightens the first 7 nodes out of the muzzle. It is drawn as ONE screen-space ribbon: a white-cyan core 2.6 px wide at 3× inside a 12 px cyan halo (HDR → bloom), an energy crawl, and a tension pulse that runs back to the wrist on the bite. | `line.ts` |
| Choreography | A pure function of (take, t), so a strip, a video and the live page all agree. See the timeline below. | `sequence.ts` |
| FX | **Sparks**: 64 streaks with drag + gravity, white-gold → ember, one draw. **Flash**: a star (core, six rays, a shock ring) for the muzzle, the bite and the dock click. Camera shake is trauma impulses → yaw / pitch / roll noise. | `fx.ts`, `sequence.ts` |
| Frame | The facade lab's pipeline plus: **depth slices** (world in depth [0.3, 1], viewmodel in [0, 0.3); P4's learning 8); the **zip** (a radial smear toward the hook with jittered step-print taps, silk-white speed lines streaming out, dark ink-wash brush streaks at the rim); the HUD-language **lock reticle** (cyan hairline brackets that snap to gold); drizzle; the fitted **blue-hour grade**. | `post.ts` |
| The set | A Well 18 × 86 m of the facade lab's grammar (a snapshot copy in `world/`). A south overlook in **wet granite**: flecks, an art-directed sheen, neon streaks rippled by rain, drizzle rings. A timber veranda on the east wall with red lacquer pillars, a glazed eave, lanterns and the hook. 3 bridges, 26 spans of cables / laundry / lanterns, 11 neon signs. | `well.ts`, `wetstone.ts`, `neon.ts` |

## The hook take (seconds)

| t | Beat | What happens |
|---|---|---|
| 0.0–0.5 | aim | The camera looks down the Well. The arm raises onto the hook, which sits up and right as in comp-B. The capacitor charges (0.45 → 1.8) and the LEDs light one by one. |
| 0.44–0.52 | lock | The cyan brackets fly from the centre to the hook, snap to gold (a spring, overshoot) and shrink. The hook's gold hull flares and the LEDs turn gold. The talons **arm**, springing to 34°. |
| 0.72 | fire | Muzzle flash and exposure kick. Recoil: 4.5 cm back along the forearm, then a spring back. Shake 0.45. The capacitor drops to 0.12. The claw leaves and its talons spring to 64°. |
| 0.72–1.18 | fly | 0.46 s along a 0.55 m arc. Scale 1 → 1.7 (it has to read at 14 m), a slow spin. The line pays out, slack 1.17 → 1.05. The spool spins. |
| 1.18 | bite | The talons snap to 20° (a spring). 64 sparks, the bite flash and the hook lit by it. Shake 0.55. Slack goes to 1.0 in 0.07 s. The tension pulse runs to the wrist in 0.26 s. |
| 1.18–1.36 | tension | The camera dips 5 cm into the pull. The arm extends to the zip pose and trembles. |
| 1.36–2.30 | zip | Eased along the line to 1.15 m in front of the ring, with a 0.35 m sag and a 3.4° bank. FOV +11°, then back. Speed, the smear and the speed lines peak mid-zip. The spool reels. |
| 2.30–2.64 | release | The talons open and the claw is reeled home to the moving muzzle, the line whipping (slack 1.12). The dock click comes at 2.64. |
| 2.30–2.95 | vault | A Bézier up over the dragon's head, across the rail beside the pillar, down onto the deck. The look turns from the hook to the veranda. |
| 2.95 | land | A 14 cm dip with a spring and shake 0.75. The arm lowers, the LEDs reset, the gold fades. |

**The miss take.** Aim at empty air up the Well; the brackets stay cyan and never lock. Fire at 0.52. The claw flies 21 m
with a ballistic drop. At the line's end (1.02) it jerks back 35 cm, the talons slam shut and the line rings. It is then
dragged home (1.10–1.76) under a 2.2 m gravity sag with slack 1.3 → 1.02. The verlet line whips into S-curves. Dock
click.

## Cost (1206×2622, iPhone portrait at 3×, M5 Max, Metal, `bench(60)`, median of 3)

| Frame | ms | Draws | Tris |
|---|---|---|---|
| Full (lock / bite / zip / release) | **2.50 / 2.48 / 2.34 / 2.33** | 65 / 68 / 65 / 59 | 0.61 M |
| The grapple alone (Well hidden) | 1.56 | 29 | 150 k |
| The post chain + hook + line only | 1.28 | 23 | 49 k |
| The Well alone (arm hidden) | 2.37 | 62 | 514 k |

- The **arm** costs ~0.3 ms. It is 6 draws (body + hull, spool ×2, ornament ×2) plus 8 for the docked claw.
  - That is 57 k tris, ×2 with the hull.
  - Merging the ornament into the static body gives 4 draws.
- The **post** (5-mip bloom, then the composite with the silhouette, smear, speed lines, reticle and rain, at full
  resolution) is ~1.2 ms, the biggest single item.
  - At DPR 2 it is ~0.55 ms.
  - The smear taps run only while `uSpeed` > 0.
- **Phone levers:**
  - the hook's 1024² maps → 512² (it is ~60 px on screen until the arrival);
  - the talons 1.6 k tris ×3 → 800;
  - the sleeve's 12.8 k tris is P8's to replace anyway.
- A budget verdict against Pine Hollow's (≤ 200 draws, ≤ 2.5 M tris): **within it**, with room to spare.
- Models: 902 KB. The hook's textures are 122 KB of WebP.

## Learnings

1. **A screen-space ribbon must be double-sided.** Loop 1 had no line at all. The ribbon's winding flips with its screen
   direction, so a single-sided material culled it. The rope was right the whole time (`debug()` showed it).
2. **Composition decides whether the grapple reads, before any shader does.**
   - Across a 20 m Well the hook was a 40 px dot, and the frame was wall plus a grey balustrade block.
   - The fix was to turn the set: look DOWN the Well's length (comp-B), with the hook up and to the right at 14 m, and
     aim the arm, not the camera.
   - That gives depth for free (fog bands, bridges, lantern strings) and a long diagonal for the line.
3. **The viewmodel sits ~0.6 m out, not 0.4.** The sleeve went through the camera at 0.4. comp-B's forearm width puts
   the fist at ~0.62 m (view space (−0.17, −0.13, −0.6) aiming).
4. **Aim the arm at the target in view space, and never behind the camera.** After the zip passes the hook, its
   direction points back, and the arm swung end-on at the eye (loop 4). Fall back to rest when `aimDir.z > −0.35`.
5. **The vault is a path problem.** Loop 4 flew through the dragon's head, and the look target swept through the drop.
   Now: up and south of the head, across the rail beside the pillar, and turn the look to the veranda, not back across
   the Well.
6. **A line paid out from a moving muzzle droops next to the gun.** The nodes near the muzzle have no velocity and fall.
   A **feed** fixes it: blend the first 7 nodes toward the straight run to node 7 (weight 0.6 × (1 − i/7)). Real line
   comes off a tensioned spool.
7. **Codex edits of your own frame are the best target.** Two rounds, 7 edits, none re-rolled.
   - They keep geometry, camera and pose, so each gap is measurable.
   - Round 1 said the palette is **~0.55× darker in linear mids with deeper shadows**. Sampled: sRGB 0.50 → 0.34
     (p10 0.39 → 0.21).
   - Fitted as `c' = 0.6·c^1.22`, saturation 1.25 and a cool toe, with HDR lights let through. It matched in one step
     (`loop-07`).
   - Round 2's gap is surface only: glossier granite, sculpt texture on the brass, grime on the lacquer.
8. **Wet stone needs an art-directed fresnel.** Water's physical 3 % at ~48° reads as dry grey. The targets paint a near
   mirror.
   - Use 0.22 + 0.78·(1 − n·v)² and keep the environment dim (×0.28).
   - Streaks: `exp(−across²/0.0003 − along²/0.12)` on the reflected ray's error to each sign (tight across, long
     along), broken by high-frequency ripple noise, ×5.
   - Granite flecks come from value noise at 240 / 610 per metre. Hashed cells read as pixels at 0.5 m.
9. **TRELLIS.2 is excellent for a cast-brass sculpt.**
   - The side-profile dragon hook with its ring came out as one clean solid.
   - Keep `--faces 60000` for the normal-map bake source, decimate to 18 k.
   - The same casting clipped (drop the plate at z < −0.06 and the ring below the jaw) makes the gauntlet's ornament
     for free.
   - The texture's luminance is dark: remap it (`smoothstep(0, 0.2, lum)`) and wash our own brass. The hook needs a
     ×1.6 lift to stay the brightest brass after the grade.
10. **Blender for anything mechanical.**
    - Bevels, rivets, flanges and spokes, talons with a real lens section.
    - AO baked to vertex colours in seconds (Cycles `bake(type='AO')` with target `VERTEX_COLORS`).
    - Convexity computed in numpy gives edge wear and grime without a texture.
    - Write your own GLB with COLOR_0 as normalised bytes and one node per part.
    - **meshopt quantises positions and normals to normalised shorts.** `applyMatrix4` on those clamps metres to ±1, so
      convert them to floats first (`toFloat`).
11. **FOV kick in portrait is huge.** Portrait vfov is ~105°, so +24° hfov makes the Well look up the shaft. +11° reads
    as speed.
12. **The dev server can reload the page mid-capture** (another agent's edit). `capture.mjs` waits for the lab again
    and redoes the job, up to 3 retries.

## Integration into `src/dev/nine-dragon/` (the lead's)

1. **Copy** `vm-material.ts`, `feizhua.ts`, `hook.ts`, `line.ts`, `fx.ts` and `sequence.ts`. `sequence.ts` is the
   reference choreography: the game drives the same `Frame` fields from input. `blender/fei_zhua.py` goes to
   `scripts/blender/weapons/`.
   - Move the GLBs to `public/assets/nine-dragon/`.
   - Don't take `world/`, `well.ts` or `main.ts`: they are this lab's set. The clean room has the real Well.
2. **Viewmodel.** `FeiZhua.load(url, vmUniforms(silk, engraveTexture()))`, then `fz.setOrnament(hook.raw)` once the
   hook has loaded.
   - Merge `fz.scene`'s arm into P8's left arm: P8's sleeve and fist replace mine. Keep the bracer, housing, spool and
     claw.
   - Pose it with `fz.pose(wrist, fwd, roll)` in view space. Per frame:
     - `u.uViewToWorld.setFromMatrix4(camera.matrixWorld)`;
     - `u.uRes` = the drawing buffer size;
     - `u.uHullPx = 2.3 · pr / 3`.
   - Glow per frame: `uEmitA = (led1, led2, led3, capacitor)`, `uEmitB = (spool, eyelet)`, the LED colours cyan → gold
     on lock.
3. **Depth slices.** The clean room's `post.ts` must render the world into `gl.depthRange(0.3, 1)` and the viewmodel
   into `(0, 0.3)` (P4 integration step 1), or the flying claw and line won't sort against the arm.
4. **The flying claw** is `fz.clawWorld.root`, in the world scene.
   - At the shot, seed it from the docked claw: `Timeline.vmToWorld(f, CLAW_PIVOT · armMatrix)`. This keeps the vm
     and world FOVs matched, or scales x / y by tan ratio.
   - `setTalons(angle)`: fold 2°, armed 34°, open 64°, grip 20°.
5. **The line.** `new Rope(44)` + `new Filament(44)` in the world scene. Each fixed step (the game's 60 Hz `onFixed`
   is fine; the lab uses 240 Hz), call `rope.step(dt, muzzleWorld, eyeletWorld)` with `rope.slack` from the state
   machine. Then call `filament.update(rope)`.
   - The muzzle world point comes through the same FOV-matched `vmToWorld`, so the line leaves the muzzle on screen at
     any FOV kick.
6. **Dragon hooks.** `DragonHook.load(url, fogUniforms, wallPoint, wallNormal, 1.3)` per hook. `anchor` is the bite
   point. `setLock(k, pulse)` drives the gold hull and glow.
   - Physics: register each hook as a small static ball collider at `anchor`, category 'hook', so `castRay` finds it
     for the lock.
7. **Post.**
   - Add the zip block (smear, speed lines, ink streaks) and the reticle block from `post.ts` `FS_COMP` to the clean
     room's composite, with `uSpeed`, `uFocus`, `uRetAt / Lock / Alpha / Size`.
   - The blue-hour grade (`uGain 0.6`, `uGamma 1.22`, `uSat 1.25`) was fitted on this lab's frames. Re-fit it on the
     clean room's before taking it wholesale.
8. **Wet granite.** `wetStoneMaterial(shared, signs)` draws any Kit geometry: the balustrades, the square's
   flagstones. Pass the 4 nearest signs' positions and colours.

## Not done / next

- Surface detail codex still adds (round 2):
  - sculpt texture on the hook's brass (use the TRELLIS albedo as a cavity map, not just a luminance);
  - lacquer grime;
  - glossier puddles.
- The claw's talons are one mesh cloned. An animated second joint (the blade curling on the grip) would sell the bite
  more.
- The sparks don't collide. A hit-flash decal (泼墨 ink splash) on the ring was not tried.
- Enemy yank (the brief's "yanks enemies") was not staged: no enemy in this lab. The Rope and the timeline handle it
  (anchor on the enemy, reel toward the player).
- Sound was not built: the lab is muted by the rules.
