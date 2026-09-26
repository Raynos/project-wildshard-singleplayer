# The look loop: 9 angles, mockup targets, ΔE and a learned LUT

A shard-agnostic method for turning "make the game look like the mockups" into measured, routable work. It was used for
the Driftwood remaster (E43, `art/driftwood-isle/round-4-remaster/` → round 6), the Nalati camp
(`art/nalati-grasslands/round-4-camp-9angle/`) and Pine Hollow's PH-0.5 / PH-L1 / PH-L4 (`art/pine-hollow/round-0-baseline/`,
`round-14-look-loop/`, `round-17-look-loop-3/`), but it was never written down as a method until now (E169).

## What it is

One small area. Nine fixed cameras on one anchor. Each capture is **edited** by an image model into a target that keeps
the game's camera, layout and HUD. So the target is reachable, and the gap between capture and target is only the look.
Every round runs the same steps:

1. Shoot the 9 captures.
2. Make the 9 targets.
3. Write a gap list per angle.
4. Merge the gaps into a TOP-10 routed to owners.
5. Measure ΔE00 per palette region.
6. Fix what the gaps call for.
7. Fit a LUT for the colour that is left.
8. Re-shoot from the same cameras.

Stop when the owner signs off each zone's 3×3.

| Where it ran | Rounds | What moved | Evidence |
|---|---|---|---|
| Driftwood spawn cove (E43) | round 1 `ac9b87c` → round 5 `3b41284` → LUT round 6 `ec47cbe` → v0.2 | worst region ΔE00 **16.0 → 5.8** (sand shadow). Parity "~70 %": the LUT fixed the palette, and eye-level density and bounce light stayed the gap | `art/driftwood-isle/round-{4-remaster,5-loop,6-loop,11-v0.2}/` |
| Nalati camp | `25bc4e7` round 1, then per render step with `nalati-camp9.mjs --tag=` | a clean-room render path and paint-over targets (`round-5-paintover/`) | `docs/design/nalati/look-pass.md` |
| Pine Hollow (photoreal) | PH-0.5 `03e81f8` (9 × 5 anchors), PH-L1 r1→2 `c393380` / `63f90f0`, r3 `bee0c6b` | ΔE00 pooled over 27 frames: sky 14.8 → 4.2, ground 6.8 → 1.0, shadow 9.9 → 4.7. Over 54 frames every region is under 6 (worst 4.7) | `art/pine-hollow/round-14-look-loop/README.md`, `round-17-look-loop-3/README.md` |

## When to use it (and when not)

- **Use it** when a real, walkable area has to reach a style (concept art, a style bible) and "closer" needs a number.
  It works for toon (Driftwood), painterly (Nalati) and photoreal PBR (Pine Hollow), and for clean-room lab pages too.
- **Not for render bugs, pop-in or perf.** Show real builds and debug toggles. Jake: mockups "don't help with a render
  bug".
- **Not for HUD reskins.** The E122 clean-room HUD mockups were judged no better than the game: find the real pain first.
- **Not a substitute for moving.** Jake's Nalati rule: every step passes the 9 angles **and** a walk-around, a 12-frame
  orbit strip checked for cutouts, seams and popping. A look that only works from 9 cameras is a screenshot cheat.
- **Taste stays Jake's.** A stylistic change ships switchable in pause ▸ Settings ▸ Debug (never a new `?param`, see
  AGENTS.md), with a before / after board, and he picks.

## Step 0: freeze the world

Both frames of a before / after pair must be the same frame. Freeze these things:

- **Time:**
  - The game uses `tod=0.4167&clock=1000000`: 10:00, and a day now lasts ~11 days, so the sun does not move.
  - Nalati used `clock=0` to hold the def's start hour.
  - A lab page uses its own API, e.g. `window.__nd.time(6.5)`.
  - **The first `tod` in a URL wins.** A cameras file whose query pins `tod` cannot be overridden by `--query=tod=…`.
    Pass a cameras file without it.
- **Weather** clear (`weather=clear`), **boss** held (`bossGod=1`).
- **Creatures** calmed (`animals.calm = true`). Elites ignore `calm`, so park every animal within 24 m, 70 m out
  (`pine-hollow-views.mjs`). An elk's head once filled the pond's FP-back frame.
- **Clouds and wind still move** between shots. Accept it and say so, or pause the clock
  (`__weather.clock.paused = true` on Nalati).
- **The build:**
  - Shoot a **clean export of HEAD**: `git archive HEAD | tar -x -C <dir>`, then `vite build` + `vite preview` on a free port.
  - Never shoot the shared working tree. Other agents' half-done files leak into it.
  - Write the SHA in the README.

## Step 1: the anchor and the 9 cameras

Pick **P**, a spot the player really stands on, and a **faceTo** point. From P the frames should hold the area's main
materials and its landmark. Record the ground height at P from the live heightfield (`__hf.heightAt(x, z)`). Write
everything into a `cameras.json`:

- The first run resolves the nine cameras and writes them back into the file.
- Every later round re-shoots exactly those cameras.

| # | Shot | Camera | View | FOV (vertical) | Viewport |
|---|---|---|---|---|---|
| 1 | FP FRONT | eye at P (`player.spawn(x, z, yaw)`) | yaw = facing `f`, pitch −0.06 | 93.8° (portrait Hor+) | phone tier, iPhone 16 Pro UA, 390×844 @3, touch HUD on |
| 2 | FP LEFT | same | `f + π/2` | 93.8° | same |
| 3 | FP RIGHT | same | `f − π/2` | 93.8° | same |
| 4 | FP BACK | same | `f + π` | 93.8° | same |
| 5 | TOP | 60–90 m straight above P | look down at P, `up` = the front heading, so front is image-up | 72° | 1600×900, HUD hidden |
| 6 | DIAG FRONT | 45 m up, 55 m behind P | a point 20 m ahead of P | 72° | same |
| 7 | DIAG LEFT | 45 m up, 55 m to the left | P | 72° | same |
| 8 | DIAG RIGHT | 45 m up, 55 m to the right | P | 72° | same |
| 9 | DIAG BACK | 45 m up, 55 m in front, looking back | P | 72° | same |

- The offsets are Pine Hollow's (`topUp 90, diagUp 45, diagOut 55`). Driftwood used 34–40 m. Nalati used 40 m up and 40 m out at 45°.
- Move a DIAG camera when the landmark would not fit. Driftwood's shot 6 sat 23 m further south to get the pier, the
  beach and the stair in one frame. Write down why.
- For the owner's phone, also shoot at **1206×2622** (402×874 @3). That is the frame the clean room reports ms at.
- Yaw convention: yaw faces `(−sin yaw, −cos yaw)` in x / z. Check the compass: Driftwood's HUD reads +x as W.

**Holding a god camera still.** The free camera re-applies its Euler angles every frame, so a pose set once is lost.
Pose the camera **last in the frame** from a late hook, and hide the camera's children (the viewmodel shows itself
again on every update):

```js
w.game.onLate(() => { const p = window.__v9.pose, cam = w.game.camera; if (!p) return;
  for (const ch of cam.children) ch.visible = false;
  cam.position.set(...p.pos); cam.up.set(...(p.up ?? [0, 1, 0])); cam.lookAt(...p.look); cam.up.set(0, 1, 0);
  cam.updateMatrixWorld(true); if (Math.abs(cam.fov - p.fovV) > 0.01) { cam.fov = p.fovV; cam.updateProjectionMatrix(); } });
```

For god shots, spawn the player under the look point with `freeCamera = true`, so streaming, the forest LOD and the
grass LOD centre on the view.

### Two domes: where you stand and where you look (Jake, 2026-09-25, E169)

Nine angles around one anchor polish a **half-dome around the player**. A hero view looks *out of* that dome at a focal
area 30–50 m away (Nine Dragon Stack's spawn looks at the paifang and the banyan). The loop only ever sees that area from
one side, so it never reaches the mockup's intensity there. To make a hero view match its mockup, polish **two domes into
the same scene**:

- **Dome A**: anchored where the player stands (the classic loop above).
- **Dome B**: anchored at the focal point, e.g. just in front of the gate / tree. Its 9 views face the gate, the tree,
  left, right, up, the aerials, and **back toward dome A** (you now look at the player's surroundings from the other
  side). Its targets are image-model edits of its own captures **with the hero mockup as a second input**: "the second
  image is this same place seen from ~35 m back — repaint the first (a closer camera) at the same style and intensity of
  detail, keeping the first image's camera and geometry".
- Two agents, one per dome, with **disjoint file ownership** (Nine Dragon Stack: dome B owns the square's hero props,
  dome A owns the systems — materials, post, towers, the Well, the viewmodel). Each round, dome B also re-captures the
  hero view as proof that its work lands there.

When dome B's area reads right from all nine of its sides, the hero view (dome A's edge, looking at dome B's centre) is
right too, because everything in it was polished close up and from every direction.

## Step 2: capture

`scripts/pine-hollow-views.mjs` is the reference implementation (`nalati-camp9.mjs` and `nalati-chunk-views.mjs` are
variants). It does all of this:

- It runs one headless Chromium with `--use-angle=metal --mute-audio`, `&mute=1`, and two contexts: the phone one for
  FP, the desktop one for god views.
- It waits for `window.__world`, then settles: 8 s after the load, 4 s per shot.
- For every frame it logs **draw calls and triangles** (`game.lastFrame`) and prints them on the sheet cell.
- It writes the frames and a 3×3 sheet per anchor. Cell order:
  - row 1: FP front / left / right;
  - row 2: FP back / TOP / DIAG front;
  - row 3: DIAG left / right / back.
- Sheets are JPEG and ≤ 490 KB.
- It closes the browser in a `finally`.

Browsers are a shared lane: at most 3 on the machine. A lab takes the lab's `lockf` browser lock.

## Step 3: targets (image-model edits of each capture)

**codex `image_gen`** for fidelity:

- The runner is `scripts/horizon-matte/run_codex.py <jobs.json>`, jobs `{id, inputs, prompt, out}`.
- It reads `session id:` from each run's log, polls `~/.codex/generated_images/<id>/`, copies the PNG the moment it
  lands (~3 min) and kills that codex. Never wait for codex to copy its own file: that turn hangs for 10+ min on the
  slow uplink.
- Run all 9 in parallel (4–6 at once is fine).
- Pass JPEG inputs (~300 KB), not 1.4 MB PNGs.

**Local Qwen-Image-2.1 turbo** (`scripts/mockup-local.sh`, ~20–35 s) iterates a look fast. Its limits:

- It greys toon palettes.
- It garbles small text.
- It re-composes the camera when given several refs.

Use it for exploration. Use codex for the targets you measure against.

**Prompt shape.** This merges the E43 loop runner and `scripts/nalati-paintover.mjs`. For Jiehua Neon, the style
paragraph from ART-STYLE-RESEARCH §6 goes first:

```
COMMON  The image must read as a REAL SCREENSHOT of <game / shard>, not concept art; no device frame, browser chrome or
        watermark. Image 1 is the capture to EDIT. Images 2–4 are STYLE REFERENCES ONLY — do not copy their composition.
        <one paragraph of style: light, palette, materials, line>.
KEEP (non-negotiable): the exact camera position, angle, field of view, horizon line and composition; the layout and
        silhouette of <every named landmark / structure / prop>; the first-person weapon / hands; every HUD element
        (position, shape, text). Do NOT invent new landmarks, buildings, boats or characters.
REMASTER <the target qualities: materials, lighting, colour, detail, density, finish>.
SCREEN  <this angle>: what is where, and the compass bearing of the sun / moon / planet / landmarks. (Nalati's round 1
        painted the gas giant into views facing away from it.) What to fix here.
TASK    One generation only. Copy the PNG that YOUR image_gen call produced (its path is in the tool result) to <out>,
        never 'the newest file'. This is not a user ask: create or edit no other file, never touch docs/tasks/ or git.
```

- **Style anchors.** Round 1 sent 4 images per run (the capture + 3 concepts): 9 parallel runs took 30–45 min each,
  against the usual 3–5. Later rounds send the capture + **one** concept ref at lower effort, 4–5 runs at a time.
- **Read every target** before you use it. Re-roll one that added or moved objects, drifted the HUD, garbled text or
  lit the scene from the wrong side. Say which ones you re-rolled.
  - Nalati's round 1 re-rolled **5 of 9** (2, 3, 4, 8, 9). It had added the gas giant and a low sun, and invented yurts
    across the river. The re-roll prompts added a SKY RULE.
  - Driftwood's and Pine Hollow's 63 targets needed none.
- **Aspect:**
  - image_gen returns 2:3 or 3:2, not 390:844.
  - A portrait FP target comes back as a 2:3 **recomposition**. Sometimes it is a stretched copy of the capture: Driftwood
    #1 came back with the minimap turned into an oval. Resize that one back to the capture's aspect.
  - Nalati's mockups were stretched ~1.44×. Take the **layout from the capture, never from the mockup**.
- Commit targets as JPEG (`sips -s format jpeg -s formatOptions 88`).

## Step 4: sheets, gap lists and the TOP-10

- **Sheets:**
  - `sheet-ingame-3x3.jpg` and `sheet-mockup-3x3.jpg`, in the same cell order.
  - Each later round adds `r<N>-<zone>-vs-target.jpg` (in game | target, all 9).
  - The board for the owner shows, per zone, one FP and one aerial as **BEFORE | AFTER | TARGET**, then the ΔE00 table.
    It is one image. Jake: *"desktop mockups are way too tough for me, can you do portrait only"*. For a phone-only
    shard, shoot the god views portrait too.
  - Lead the board with structure, not the LUT. Jake on the LUT's before / after: *"What does color grade do I can't
    tell."*
- **The gap list per angle** says what the target has that the game lacks. Make each gap concrete and countable, and tag
  it with a track letter:
  - "a shell or pebble every ~1–2 m, a driftwood log every ~8 m" (M4);
  - "a 3–8 m sawtooth foam sheet → 2–3 thin 0.3–1 m lace lines" (W);
  - "a hard straight-edged dark wedge" (W).

  Driftwood's letters: L look, W water, M models, M4 ground cover. Pine Hollow's: G ground, C grade, T trees, R rock,
  U understory.
- **The TOP-10** merges the angles, ranked by visual impact: area of the frame × how many of the 9 frames show it. Each
  row names its track and owner, and after the round it reads **Fixed / Partly / Out of scope (whose lane)**.
- Write down the non-look finds too. Driftwood's pier ended 33 m short of the beach in all 9 frames: that was a
  level-owner call, and it moved P for round 6.

## Step 5: ΔE00 per palette region (`scripts/palette-delta.py`)

Write `scripts/palette-regions/<shard>.json`:

- **`regions`**: material → `[[frame, [x0, y0, x1, y1]], …]`, as normalised rectangles, the same for capture and target.
  - Keep the rectangles on the FP 2:3 recompositions wide: the filters pick the material.
- **`filters`**: `[hue lo, hue hi (deg), min sat, min val, max val(, max sat)]`, so a palm crossing the sand rectangle
  does not pollute the sand's mean.
  - A shadow material is `{"shadowOf": "ground", "below": 0.72, "vmin": 0.05, "excludeHue": […]}`: the lit material's
    pixels darker than 72 % of its median.
- **Leave out a material whose game colour is a bug.** Pine Hollow's black pond was PH-L9's bug. The LUT must not learn
  it.

```bash
python3 scripts/palette-delta.py --shard <slug> <round dir with mockup-<n>-*.jpg> '<captures>/capture-r2-{n}.jpg'
```

It prints the mean-colour ΔE00 per region, mockup vs game. **Bar: every region under 6 pooled over all frames, reported
per zone too.**

- A per-zone miss can be the target's fault. At the ridge and den, codex painted a paler zenith than at the other four
  zones, while the game's sky is one dome everywhere. Say so and trust the pooled number.

## Step 6: fix, then the learned LUT (`scripts/fit-lut.py`)

**Order matters: fix structure first, colour last.** Ground, density, lighting, fog and models come before the LUT. A LUT
can hit ΔE < 6 on a frame that still looks empty (Driftwood v0.2: palette on target, parity ~70 %). Then:

1. Capture the loop **without the LUT**, same cameras: set pause ▸ Settings ▸ Debug ▸ Look ▸ Learned LUT to Off (in a
   capture script: localStorage `ws.settings.v1` = `{"learnedLut":"off"}` before the load). A new page or a lab uses a
   Settings ▸ Debug row or its own API. Never a URL switch.
2. Fit the LUT:

   ```bash
   python3 scripts/fit-lut.py --shard <slug> <mockup dir> '<nolut dir>/nolut-{n}.jpg' public/assets/lut/<slug>.bin [pred dir]
   ```

   - Frame numbers run 1..9 per zone, and zones concatenate: 1–9, 10–18, ….
   - What it does: per region, a Reinhard transfer in CIELAB gives (source, target) pairs. A 33³ lattice is displaced by
     a Gaussian kernel (σ 0.08, λ 2), smoothed, and each move is capped at 0.22. Identity anchors leave unseen colours
     alone: the sword, the hands, the HUD.
   - It prints the predicted ΔE per region.
3. Tune the fit in the regions JSON:
   - `greyAnchor`: Driftwood 3 (the default). Pine Hollow 1, so the greys can move.
   - `fitWeights`: Pine Hollow 1.5 on sky / rock / trail and 2.5 on shadow.
4. The runtime is `src/world/lut.ts`, a `LUT3DEffect` as the **last** grade step. The file is 33³ RGBA8 (144 KB), sRGB
   in and out.
5. Re-measure in game with the LUT on (step 5). **Refit every round over all frames of all zones.** The fit tracks
   whatever the fixes changed.
   - A refit is global. Pine Hollow's six-zone refit pushed the Hollow's rock 4.6 → 6.2. Re-read the per-zone table.
   - If the fog must match a painted sky, keep the sky region near identity (Nalati's advice).

| Driftwood E43, before → after the LUT | shallow | deep | sand | sand shadow | grass | foliage | sky horizon |
|---|---|---|---|---|---|---|---|
| ΔE00 | 5.4 → 1.8 | 5.7 → 1.8 | 4.4 → 0.2 | **16.0 → 5.8** | 4.6 → 0.4 | 6.3 → 0.9 | 6.3 → 2.1 |

## Step 7: the rulers (every round, clean export vs clean export)

- **Draw calls and triangles** per frame of the 9, on the sheet, and at the phone ruler poses (`pine-hollow-perf.mjs`).
  Name the delta, e.g. "cabin 154 → 155 calls, 1.53 → 1.76 M tris".
- **Program count**, before and after, and while walking. None may be added mid-play: every program is a ~150 ms Metal
  compile on the iPhone. Check that the other shards' **program-source SHA is unchanged**, so their look did not move.
- **30 fps lock** (phone tier, 4× CPU throttle): % of intervals at 33.3 ms and work p95.
  - Measure on a **quiet machine** (load average ~2).
  - Under a load of 8–10 from other lanes, HEAD and the change both read 18–30 ms: that is noise, not a verdict.
  - Interleave HEAD and the change in one session.
- **Fill rate.** Alpha-card overdraw was 20.5 layers per pixel on Pine Hollow (Jake's iPhone read "14 fps 71 ms"), and
  headless 4×-CPU runs never showed it. A density fix must report overdraw, not only calls and tris.
- **Frame cost by toggling.** The browser GPU timer query is wrong on this Mac. Switch each feature off and measure.
- If geometry moved: `physics-baseline.mjs --mode=walk` (and `--trails`) must show 0 stuck, and re-bake the navmesh.
- A lab page reports ms/frame at 1206×2622 and draws (`__nd.bench`).

## The loop and when to stop

- Re-shoot the same `cameras.json` after each round of fixes. Refit the LUT, re-run palette-delta, and rebuild the board
  as BEFORE | AFTER | TARGET.
- **Stop a zone when:**
  - the owner signs off its 3×3;
  - every region is ΔE00 < 6;
  - the rulers held (calls within budget, 30 fps lock, no new programs);
  - the walk-around shows no cutout, seam or pop.
- **Stop a lab loop** when a stranger could not tell your crop from the target's at phone size, or when you know *why*
  this way can't get there. Then write it down and change approach (LAB-RULES).
- **Widen** once a zone is signed off: next zone, same method (Pine Hollow Hollow → pond → old-growth → ridge → den →
  hamlet; Driftwood V-L1 hut plateau → wreck cove → shrine → lookout).
- **Budget per round:**
  - Round 1 took ~70 min wall-clock: captures 8 min, and 9 parallel codex runs of 30–45 min each on the old copy flow.
  - With the polling runner, a target lands in ~3 min.

## Pitfalls that cost time

| Pitfall | Fix |
|---|---|
| **Explore camera deep link ignored** (`?explore=world&cam=`): `Explore.open` placed the camera, then `setMode('world')` re-homed it (`Explore.ts:232` at the time) | Fixed in `f286e6e` (a `cam` now wins). Still pose the camera from an `onLate` hook: FreeCam re-applies its Euler each frame |
| image_gen changes the aspect, recomposes or stretches FP targets | Resize a stretched one back to the capture's aspect. Keep region rects wide. Take layout from the capture |
| codex hangs 10+ min copying its own PNG | `run_codex.py` polls `generated_images/<session id>` and kills the run |
| codex reads AGENTS.md and files a "Generate…" ask | Say "not a user ask; touch no file but your output" in every prompt. Check `git status` after the batch |
| Targets disagree with each other (a paler zenith at two zones) | Judge the pooled ΔE. Don't chase one target's quirk |
| HEAD changed mid-round (the render fix `1305f2d` darkened the pond's trail) | Before and after from clean exports. Note what landed mid-round |
| A creature or the viewmodel in the frame | Park animals within 24 m. Hide `camera.children` in god shots |
| `tod` in the cameras query can't be overridden | Use a separate cameras file per time of day |
| The anchor moved (the pier extended onto the beach) | Keep the old cameras for the before, and resolve new ones for the after. Say so on the board |
| LUT learned a bug colour, or hid a structural gap | Exclude bug materials from the regions. Fix structure before fitting |
| Near-black bloom squares in a round's frames | That is one NaN pixel smeared by bloom. Clamp `pow(1 − N·V)` bases (`69df233`) |
| fps readings under other agents' load | Quiet-machine re-run, HEAD and change interleaved |
| The shared dev server crashed boot (another lane's WIP) or reloaded mid-shot | Shoot from your own clean export, never :5173 |
| NaNs show only on the iPhone, never headless | `scripts/pine-hollow-nan-scan.mjs`-style scan of every loop camera |
| **Gaming the 9 cameras**: the Nalati clean room looked right from its cameras and was "cardboard cutouts … a scam" once Jake moved | A walk-around strip every round. No painted plate or sprite in the playable space |

## Scripts

| Script | Use |
|---|---|
| `scripts/pine-hollow-views.mjs --cameras=<json> --out=<dir> [--only=<anchor>] [--tag=r2] [--query=…] [--url=<clean export>]` | Shoot the 9 × N anchors, write the sheets, log calls / tris. Copy it for a new shard or a lab page |
| `scripts/nalati-camp9.mjs --tag=<step>` | Re-shoot fixed poses per render step, with an **engine \| target pairs sheet** and a budget table |
| `scripts/nalati-chunk-views.mjs --views=<json>` | Arbitrary god views of a whole chunk |
| `scripts/nalati-paintover.mjs` | Batch paint-over targets (the prompt shape above) |
| `scripts/horizon-matte/run_codex.py <jobs.json>` | Parallel codex image_gen with the polling copy |
| `scripts/mockup-local.sh --ref <capture> --prompt-file <p> --out <png> [--mask] [--seed]` | The fast local target (Qwen, ~30 s, model lock) |
| `scripts/palette-delta.py --shard <slug>` | ΔE00 per region |
| `scripts/fit-lut.py --shard <slug>` | Learned 33³ LUT → `public/assets/lut/<slug>.bin` |
| `scripts/palette-regions/<slug>.json` | Regions, filters, fit weights, greyAnchor. Copy Pine Hollow's for a multi-zone loop |
| `scripts/pine-hollow-perf.mjs`, `scripts/pine-hollow-fps.mjs` | Phone ruler (calls / tris) and the 30 fps lock |
