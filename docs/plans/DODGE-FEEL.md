# Plan: a better dodge (E60)

**State:** `draft` 2026-09-23 — three storyboarded variants (T lean + smear · U afterimage · V grounded roll-dip) in `art/combat/round-2-dodge/`; recommended **T** (+ U's rim flash as the i-frame tell later). Nothing is built until Jake picks a letter. The agent was stopped at wrap-up (usage), so the main session reviews this draft before asking Jake.

Jake (E60): "Make a sequence of mockups for how to have a better, cool animation for dodge. The placeholder animation for
dodge is a lot better than what it was previously, but I think we can still do a couple of steps better."

The DODGE cooldown clock-sweep on the disc is E59 (another agent). The frames show it as a disc with a partial dark sweep
only, so they read true. It is not designed here.

## Boards

All frames are codex edits of one live 390×844 capture: `?touch&tier=phone&skipintro&nolock&weapon=sword`, on the Driftwood
pier, with the stick held right. Only the world's camera motion, the motion FX and the sword pose were added. The graphics
and the HUD are the live ones. Each storyboard dodges to the RIGHT. Its four frames are anticipation (0–40 ms), burst
(60 ms), peak (150 ms) and recovery (350 ms).

| board | what it shows |
|---|---|
| `art/combat/round-2-dodge/board-0-overview.jpg` | BEFORE (today, mid-dodge) + the peak frame of each of T / U / V |
| `art/combat/round-2-dodge/board-T-lean-smear.jpg` | BEFORE + **T1–T4**: camera roll into the dodge (8° at peak), a horizontal smear on the outer thirds, the sword lagging out to the left and whipping back |
| `art/combat/round-2-dodge/board-U-afterimage.jpg` | BEFORE + **U1–U4**: a cyan rim flash on the sword, 3 cyan ghost copies of sword + glove left behind in the world, shard flakes, cyan-tinted streaks, a brief fringe, a corner glow (the i-frame window) |
| `art/combat/round-2-dodge/board-V-roll-dip.jpg` | BEFORE + **V1–V4**: the eye dives to crouch height and rises, a strong FOV punch, dust + splinters kicked up off the planks, a vignette pulse, the sword tucked flat |

Re-rolled: V2 once (codex turned the wooden blade into steel) and V4 three times (codex kept squashing the HUD discs into
ellipses; the fourth take is used). The other ten frames are first takes. `ref-live.jpg` is the clean live frame that
every edit started from; `before-live.jpg` is today's dodge mid-dash, captured in a ×0.1 slow-mo.

## Today (what the storyboards start from)

- `Player.dodge()` (`src/player/Player.ts`): 3 m in 0.25 s (12 m/s) toward the stick, or a backstep with no input. 0.6 s
  cooldown. Brakes to 25 % on the last frame.
- Feel (E35, `84951d0`):
  - a 7 cm eye dip on the `landImpulse` spring;
  - a camera roll of `0.06 rad` (3.4°) at t = 0 that only decays (`exp(-7t)`), so it is biggest on the very first frame
    and never builds;
  - FOV +5°, held while the dash runs, eased out after;
  - speed streaks at 0.55 (`src/ui/SpeedLines.ts`, CSS);
  - `Audio.dodge()` (body whoosh + scuff);
  - a 10 ms haptic (Android only).
- **The sword does nothing.** `Sword.ts` composes rest / swing / charge / sprint + sway + look lag + walk bob. No term
  reads the dash, so the blade sits rigidly in frame while the world lurches. The live capture confirms it
  (`art/combat/round-2-dodge/before-live.jpg`). This is the biggest gap. All three variants fix it, differently.
- There is no anticipation beat and no recovery beat. The roll is at full size on frame 1 and the FOV stays kicked while
  the dash runs, so the dodge reads as "the view shifted", not "I threw my body".

## Research: how first-person games sell a dodge

These notes are from the games themselves, not from measurements. The frame counts are community-measured and approximate.

- **Doom Eternal (dash):**
  - an instant burst of about 0.15 s with no wind-up;
  - a hard FOV punch and radial speed lines;
  - no camera roll;
  - a sharp air-burst sound.
  - The *lack* of anticipation is the point: input to motion on the next frame. Lesson: never delay the move for the
    animation. Anticipation must be cosmetic and overlap the burst.
- **Titanfall 2 (slide, wall-run):**
  - the camera drops, rolls a few degrees and gains FOV;
  - the viewmodel dips and tilts against the motion;
  - the roll eases in over ~100 ms rather than snapping.
  - Lesson: a roll that *builds* reads as body lean. A roll that snaps reads as a camera glitch.
- **Mirror's Edge:**
  - the body is the camera: arms swing into frame on every burst;
  - the camera leads, the arms lag and then catch up with a small overshoot.
  - Lesson: viewmodel lag + overshoot is what makes first-person motion feel physical.
- **Ghostrunner (air dash, sensory boost):**
  - horizontal smear / blur along the dash axis;
  - chromatic fringe;
  - a blue tint.
  - Lesson: directional smear tells you which way you went even in peripheral vision.
- **Dishonored (Blink):**
  - a tunnel vignette and an FOV stretch;
  - a desaturated warp during the teleport, then a snap back;
  - a crisp magical "chk".
  - Lesson: a *magical* dodge can own a colour and a sound. Wildshard's colour is the shard cyan.
- **Elden Ring / Dark Souls (third person, but the timing):**
  - a roll is very short start-up, i-frames up front (~13 frames at 30 fps, ≈ 0.4 s for a medium roll), then a longer
    vulnerable recovery;
  - the i-frames sit at the *start*.
  - Lesson: make the start the loudest moment (sound, haptic, flash), and let recovery be the quiet part.
- **Dying Light (dodge / roll):**
  - the camera dips and tilts;
  - the hands swing wide;
  - a heavy foot-plant sound on landing.
  - Lesson: a second sound on the plant (the end of the dash) gives the dodge a clear end.
- **Chivalry 2 (sidestep dodge):**
  - a short lateral hop;
  - a small roll;
  - the weapon pulled in;
  - a cloth / armour rustle.
  - Lesson: tucking the weapon signals "I'm defending", not "I'm attacking".
- **VR melee (Blade & Sorcery, Boneworks-likes):**
  - artificial dashes get a comfort vignette (tunnelling) and never roll the horizon.
  - Lesson: roll is the most nausea-prone lever. Cap it, and give it a setting. None exists today (`src/ui/Settings.ts`),
    so D1 adds a Settings ▸ Gameplay ▸ **Reduce motion** switch that scales every camera value below to 30 %.

What they share:

- The move starts on the next frame.
- The camera *builds* into the lean over ~100 ms and recovers with one small overshoot.
- The viewmodel lags against the motion and whips back.
- There is one strong audio / haptic hit at the start and a lighter one at the plant.
- The screen FX live in the periphery and never cover the crosshair.

## Shared timeline (all variants)

The dash itself is unchanged: 3 m, 250 ms, input on the next frame. Everything below is cosmetic, driven by one
normalised clock `dodgeT` (ms since the dodge started) and `dodgeSide` (−1 left … +1 right, 0 for a backstep).
Player.ts exposes both.

| phase | ms | what happens |
|---|---|---|
| anticipation | 0–40 | the "load": the first 2 frames of the dash. Cosmetic only: a small dip, a small pull-in of the sword. The body is already moving. |
| burst | 40–120 | the camera builds to its peak; the FX snap on; the viewmodel lags hardest |
| peak | 120–250 | hold / slow decay until the dash ends (250 ms) |
| recovery | 250–450 | everything springs back with one small overshoot; the foot-plant sound at 250 ms |

The envelope helper is `env(t) = t < 40 ? 0.25·(t/40)² : t < 120 ? 0.25 + 0.75·easeOutCubic((t−40)/80) : t < 250 ? 1 − 0.15·((t−120)/130) : spring`.
It is ~15 lines in `Player.ts`, and every value below is `peak × env`. The recovery is an underdamped spring
(ζ ≈ 0.55, ω ≈ 13 rad/s), which gives one overshoot of about 10–15 % at ~390 ms and is settled by 450–500 ms.

A backstep (no input) uses `dodgeSide = 0`: no roll, a 1.5° pitch-up instead, and the sword pulls straight back.

## Variant T — "lean + smear"

The body leans into the dodge like a skier, the world smears sideways, and the sword is flung the other way and whips back.

- **Camera roll:**
  - peak **7°** (0.122 rad) × `dodgeSide`, built on `env`;
  - the horizon's far end on the dodge side goes up;
  - recovery overshoots to about −1° at ~390 ms;
  - replaces today's `dashRoll` decay;
  - the storyboard peak draws ~8° for legibility; build at 7°.
- **Camera lateral lead:** the eye leads 4 cm into the dodge side at peak (the head leaning over the feet). Back by 450 ms.
- **Dip:** keep today's 7 cm, but on `env` (2 cm by 40 ms, 7 cm at 120 ms) instead of an instant impulse.
- **FOV:** +5° (as today), built over 40–120 ms instead of on frame 1, eased out 250–450 ms.
- **Smear:**
  - horizontal streaks on the outer left / right thirds, never the centre 40 %;
  - phone: CSS, a second mode of `SpeedLines`: a `repeating-linear-gradient` of 1 px horizontal lines at 10–18 % alpha,
    masked to the side thirds, `translateX` sliding against the motion. It is one composited layer and touches the WebGL
    frame not at all, so it costs **≈ 0 ms GPU** on the phone.
  - desktop: optionally a real 5-tap horizontal blur inside the existing merged `EffectPass` (`Game.ts`), masked by
    `|uv.x − 0.5|` and gated by a uniform. That is ~0.2 ms at 1080p while it runs, and it needs a precompile so the first
    dodge doesn't hitch (`src/boot/precompile.ts`).
- **Viewmodel (Sword.ts, camera space, added after the sway / look lag, before the portrait framing):**
  - a lateral spring `dodgeLagX`: at the start it gets a velocity kick of `−2.2 m/s × dodgeSide`, spring k = 160,
    damping c = 14;
  - that peaks at **−0.09 m** at ~95 ms and overshoots **+0.011 m** at ~390 ms;
  - `pos.y += −0.35 × |dodgeLagX|` (the hand drops ~3 cm as it swings out);
  - the blade leans with the lag: roll `rotZ += 3.5 rad/m × dodgeLagX` (≈ 18° at peak), yaw `+ 1.2 rad/m × dodgeLagX`;
  - the arms follow through the existing `ARM_FOLLOW`;
  - in the 0–40 ms load, the hand is pulled 1.5 cm toward the centre first (anticipation);
  - the same offsets on `Crossbow.ts` / `Rifle.ts` at 60 %.
- **Sound (`Audio.dodge()`):**
  - keep the body whoosh, but pan it across the dodge (`pan −0.4·side → +0.4·side` over 200 ms);
  - add a cloth flap at 40 ms;
  - add a soft foot-plant at 250 ms (`lowpass 400 Hz`, 60 ms).
- **Haptic:** `[12, 230, 6]`: the push-off, then the plant (Android).
- **Phone cost:**
  - ≈ 0 GPU (camera maths + one CSS layer);
  - no new programs, no new draws.
- **Files:**
  - `src/player/Player.ts` (`dodgeT`, `dodgeSide`, `env`, roll / lead / dip / FOV on it);
  - `src/player/Sword.ts` (`dodgeLagX` spring);
  - `src/player/Crossbow.ts`, `src/player/Rifle.ts` (the same offsets);
  - `src/ui/SpeedLines.ts` + `src/ui/styles/game.css` (smear mode);
  - `src/audio/Audio.ts`, `src/ui/haptics.ts`.
  - Optional desktop smear: `src/core/Game.ts`, `src/boot/precompile.ts`.

## Variant U — "afterimage"

The shard magic carries you: a cyan echo of the sword is left where you were, and the world gets a brief magical fringe.
Closest to Dishonored's Blink and Ghostrunner.

- **Camera roll:** peak **3°** on `env`: a light lean, because the ghost does the talking.
- **Dip:** 5 cm on `env`.
- **FOV:** **+7°**, snapped in 30 ms, held to 250, eased out by 450.
- **Rim flash (0–60 ms):**
  - the sword and glove materials get a cyan (`#8fe3ff`) emissive / fresnel rim, ramped 0 → 1 → 0 over 0–60–200 ms;
  - one uniform on the existing viewmodel material, **0 cost**.
  - Once R11 i-frames exist, this flash doubles as the "you are invulnerable" tell: the rim holds for exactly the i-frame
    window.
- **Ghosts:**
  - at 0, 40 and 80 ms, snapshot the sword + forearm world matrices into **3 ghost copies**. They share geometry with one
    additive `MeshBasicMaterial` (cyan, a fresnel rim via `onBeforeCompile`, `depthWrite: false`);
  - they are left in the *world*, not the camera, so they slide away across the screen as you move;
  - opacity 0.5 → 0 over 300 ms, ease-out;
  - a pool of 3, reused, never allocated in the loop;
  - the phone tier uses **2** ghosts.
- **Shard flakes:** 12 cyan points (one `THREE.Points` draw) spawned along the ghosts, drifting against the motion, fading
  over 400 ms. The phone tier uses 8.
- **Streaks:** `SpeedLines` at 0.7 with a cyan tint (`--speed-tint`, CSS).
- **Chromatic fringe:**
  - offset pulse 0 → 0.004 → 0 over 0–150 ms, edges only;
  - the stylized Driftwood chain has no `ChromaticAberrationEffect` today (only the PBR chain does), so adding one costs
    3 taps per pixel every frame;
  - desktop only; the phone tier skips it.
- **Corner glow (i-frame window):** a CSS cyan radial vignette at 25 % over 40–240 ms. It becomes meaningful once R11
  (dodge i-frames) and enemy damage land; until then it is decoration.
- **Viewmodel:**
  - the real sword pulls in 2 cm and turns 6° flat for the dash (a light tuck);
  - no big lag: the ghosts carry the "left behind" read.
- **Sound:**
  - the body whoosh plus a crystalline shard "shing": a sine glint 2.4 → 1.8 kHz over 120 ms + a high bandpass shimmer tail;
  - a reversed shimmer swell at −20 ms is not possible (no look-ahead), so the tail carries it.
- **Haptic:** `[6, 20, 10]`, a double tick (Android).
- **Phone cost:**
  - +2 ghosts × the sword's draws (~6–8 draws, a few hundred triangles, small additive overdraw low-right);
  - +1 points draw;
  - one new program (the ghost material): **precompile it**, or the first dodge hitches;
  - estimated 0.2–0.4 ms GPU for 300 ms.
- **Files:**
  - new `src/fx/DodgeGhost.ts` (the pool, the flakes);
  - `src/player/Sword.ts` (rim uniform, the tuck, exposing the rig for snapshots);
  - `src/player/Player.ts` (`dodgeT` / `dodgeSide` / `env`);
  - `src/ui/SpeedLines.ts` + `game.css` (the tint, the corner glow);
  - `src/core/Game.ts` (desktop fringe);
  - `src/boot/precompile.ts`;
  - `src/audio/Audio.ts`, `src/ui/haptics.ts`, `src/main.ts` (wiring).

## Variant V — "grounded roll-dip"

A low, heavy combat roll: the eye dives toward the planks and rises, dust kicks up, and the sword is tucked flat to the body.
Closest to a souls roll or Dying Light, felt from inside.

- **Dip:**
  - **22 cm** (vs 7 today), on its own curve;
  - 5 cm by 40 ms (knees load), −22 cm at 150 ms (ease-out quad), held to 200 ms;
  - rises 200–400 ms with a **+1.5 cm** overshoot at ~380 ms, settled by 450 ms.
- **Pitch:** −4° (the view tips down toward the landing spot) at 150 ms, back with the rise.
- **Roll:** **3°** into the side (the dip does the work; the storyboard draws it larger).
- **FOV:** **+10°**, reached at 60 ms (ease-out quad), held to 200 ms, eased back by 450 ms. This is the strongest punch
  of the three.
- **Vignette pulse:** the existing `VignetteEffect.darkness` 0.35 → 0.6 → 0.35 over 0–150–450 ms. It is already in the merged
  pass, so it is a uniform write: **0 cost**.
- **Dust:**
  - 8–14 soft sprite puffs (one instanced / points draw, one soft round alpha texture);
  - spawned at the feet, just ahead of the camera's lower frustum, in world space so they are left behind;
  - life 600 ms, size 0.2 → 0.6 m, sand `#d8c8a6`;
  - + 6 splinter flecks on wood;
  - the surface comes from the footstep surface, `StepSurface`: sand → dust, wood → dust + splinters, shallow water →
    white spray.
  - Phone tier: 8 puffs.
- **Viewmodel:**
  - a new `TUCK` key in `SwordMoves.ts`: REST `(0.27, −0.33, −0.52)` → TUCK `(0.20, −0.37, −0.42)`;
  - the blade rolled ~+0.9 rad to lie nearly flat pointing left, pitch −0.3 rad;
  - blend in over 0–60 ms, hold to 200 ms, blend out 200–400 ms through a small spring (overshoot ~8 %);
  - the ranged kits tuck to their sprint pose instead.
- **Sound:**
  - the body whoosh, pitched down 15 %;
  - a chest thump (sine 90 → 50 Hz, 80 ms) at 0;
  - a sand / plank scuff (bandpass 1.2 kHz noise, 120 ms) at 40 ms;
  - a heavier foot-plant at 250 ms. Reuse the step bank if the E33 SFX set has a surface-matched plant.
- **Haptic:** `[14, 220, 12]`, push-off + plant (Android).
- **Phone cost:**
  - +1 draw (the dust) with some soft overdraw at the bottom of the frame, ~0.2–0.3 ms for 600 ms;
  - one new program (the dust sprite): precompile it.
  - The 22 cm dip and +10° FOV repeated every 0.6 s is the most motion-heavy of the three, so it must respect the new
    reduce-motion setting.
- **Files:**
  - `src/player/Player.ts` (the dip / pitch / FOV curves, `dodgeT` / `dodgeSide`);
  - `src/player/SwordMoves.ts` (`TUCK`);
  - `src/player/Sword.ts` (the tuck blend);
  - new `src/fx/DodgeDust.ts`;
  - `src/core/Game.ts` (the vignette uniform);
  - `src/boot/precompile.ts`;
  - `src/audio/Audio.ts`, `src/ui/haptics.ts`, `src/main.ts`.

## Comparison

| | T lean + smear | U afterimage | V roll-dip |
|---|---|---|---|
| reads the direction | strongest (roll + smear + the sword flung the other way) | good (ghosts left behind) | medium (the dust trails, the view shifts) |
| feels like | agile, a fencer's sidestep | magical, shard-powered | heavy, grounded, a souls roll |
| blocks the view of an enemy | no (the centre stays sharp) | a little (ghosts low-left) | yes, briefly (dust + vignette + dip) |
| motion comfort | medium (7° roll, cap it) | best | worst (22 cm dip + 10° FOV every 0.6 s) |
| phone GPU | ≈ 0 | 0.2–0.4 ms × 300 ms, +1 program | 0.2–0.3 ms × 600 ms, +1 program |
| build size | S | M | M |
| an i-frame tell (R11) | needs one added | built in (rim + corner glow) | needs one added |

## Recommendation

**T**, with U's cyan rim flash kept aside as the i-frame tell for when R11 lands. Why:

- It fixes the real gap: the sword ignoring the dodge.
- It costs nothing on the phone.
- It keeps the crosshair and the enemy readable mid-dodge, which matters once the lock-on (E50, whose side-hop reuses
  `dodge()`) and enemy damage arrive.

V's foot-plant sound + haptic is also cheap and worth folding into whichever letter wins.

## Levers (built only after a pick)

| # | lever | variant | size |
|---|---|---|---|
| D1 | `dodgeT` / `dodgeSide` / `env()` in Player.ts; roll / dip / FOV on the envelope; a new Reduce motion setting (`Settings.ts`, `Menu.ts`) that scales them | all | S |
| D2 | viewmodel dodge offsets (T: lag spring · U: light tuck · V: `TUCK` key) on the sword; 60 % on crossbow / rifle | all | S |
| D3 | the plant beat: the foot-plant sound at 250 ms + the two-pulse haptic | all | S |
| D4 | SpeedLines smear mode (T) / cyan tint + corner glow (U) | T, U | S |
| D5 | `DodgeGhost` pool + flakes, the rim uniform, precompile | U | M |
| D6 | `DodgeDust` by surface, the vignette pulse, precompile | V | M |
| D7 | desktop-only shader smear (T) / fringe (U) in the merged EffectPass | T, U | S |
| D8 | verify: a slow-mo capture at 390×844 (`performance.now` / rAF scaled ×0.1, as for these boards) + a phone fps check with 5 dodges in a row | all | S |
