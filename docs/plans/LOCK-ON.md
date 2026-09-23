# Plan: Zelda-style melee lock-on (E50)

**State:** `draft` 2026-09-23 — research + design + mockups done (E50); nothing is built. Waits on **Jake's picks**: the LOCK button (board 1, J / K / L / M), the locked HUD (board 2, N / O / P / Q), the storyboards (R flick-switch, S orbit), and the open questions at the bottom. Jake approved none of it yet.

Jake (E50, voice note): a Breath of the Wild / Ocarina of Time style lock-on for the Driftwood melee. A HUD button turns it on;
it locks the nearest enemy near the centre of the view; while locked the LOOK panel stops turning the camera, the MOVE stick
circle-strafes around the target, and a flick on LOOK (left / right, up / down for flyers) switches target. Free aim stays.
Melee only; the bow question is open. "Makes the game more deterministically playable."

Boards (all edits of one live 390×844 capture of the crab tidepool north of the wreck, layout E with E46's 45 / 55 split
injected from the working tree, since E46 had not shipped yet):

| board | question | letters |
|---|---|---|
| `art/combat/round-1-lockon/board-1-button.jpg` | where the LOCK button goes, shown in its "available" state | **J** disc on the right-thumb arc (left of DODGE) · **K** chip on top of the LOOK pad · **L** no button, tap the enemy · **M** LOCK half of the HOVER pill |
| `art/combat/round-1-lockon/board-2-locked.jpg` | what the locked view looks like | **N** Zelda triangle + brackets + name tag on the enemy, edge chevron, SWITCH pad, ORBIT stick · **O** ring reticle + fixed top banner, diamonds on other enemies, FLICK pad · **P** ground ring + one line under the crosshair, bare chevron, vignette · **Q** dot reticle that turns amber on a wind-up, bottom banner |
| `art/combat/round-1-lockon/board-3-storyboards.jpg` | how it moves | **R** flick LEFT on the pad → the lock jumps to the next crab (2 frames) · **S** hold MOVE left → circle the crab (2 frames) |

**Recommended:** **J** + **N** (the storyboards R / S use N's language). The rest of this plan assumes J + N, but every lever
below works with any pick.

## 1. What the research says

Sources are linked inline; "(unverified)" marks claims no source confirmed.

- **Ocarina of Time Z-targeting** ([manual](https://www.zeldadungeon.net/Resources/Instruction-Booklets/Zelda05-ocarina-of-time-instruction-booklet.txt),
  [decomp `z_actor.c`](https://raw.githubusercontent.com/zeldaret/oot/main/src/code/z_actor.c)).
  - **Modes:** there are two, SWITCH (the default, a toggle) and HOLD. In SWITCH, pressing Z again goes to the next
    target, or releases when there is none ([wiki](https://zelda-archive.fandom.com/wiki/Z-targeting)).
  - **Z with no target** re-centres the camera behind Link.
  - **First pick:** the nearest actor within **±60°** of Link's facing.
  - **Re-pick while locked:** candidates within **±90°**, with up to a **40 %** bonus on the squared distance for dead-ahead.
  - **Release distance:** the lock lets go at **1.5× the acquire distance** (350 → 525 units and so on).
  - **The stick while locked** circles the target (left = clockwise). **Z + a direction + A** side-hops or backflips.
  - **The rule came from a ninja show** where the enemies circled the hero and attacked one at a time, so Z-targeting and
    the "enemies wait their turn" rule are one design
    ([source](https://badlandgame.com/ninja-show-inspired-zelda-z-targeting/)).
- **Breath of the Wild / Tears of the Kingdom:**
  - **Controls:** you *hold* ZL to lock. X while locked side-hops or backflips, and a just-in-time dodge opens Flurry Rush
    ([source](https://zelda-archive.fandom.com/wiki/Flurry_Rush)).
  - **Switching has no stick flick:** you release ZL, point at the new enemy and lock again
    ([source](https://gamefaqs.gamespot.com/switch/189707-the-legend-of-zelda-breath-of-the-wild/answers/470897-is-there-a-way-to-change-targets-while-in-lock-on-mode)).
  - **The bow is free-aim only,** with slow motion in the air.
- **Dark Souls / Elden Ring:**
  - **Controls:** R3 toggles the lock, and a right-stick flick switches target. While locked the mouse / right stick *only*
    switches, so mouse jitter swaps targets by accident — a flick threshold is needed
    ([source](https://steamcommunity.com/app/1245620/discussions/0/3183486955454648217/?ctp=3)).
  - **Target choice** favours the enemy nearest the screen centre, not the one nearest the player.
  - **Two settings:** "Auto Lock-On" re-targets on a kill, and "Auto-Target" (a soft aim) works without a lock.
  - **Lock range** is data-driven: a base value per camera state plus a per-enemy `lockDist`
    ([source](https://soulsmodding.com/doku.php?id=ds1-refmat%3Aparam%3Alockcamparam)).
  - **The lock breaks** on distance, or when the target is off-screen too long.
  - **Big enemies** are a known camera problem (you end up looking up at ankles); Sekiro zooms out for them.
- **First person:**
  - **The *First Person Souls* mod removed lock-on** because it "interfered with movement and camera", and added aim assist
    instead ([source](https://www.nexusmods.com/eldenring/mods/3266)).
  - **Skyrim's target-lock mods** need separate first-person fix patches
    ([source](https://www.nexusmods.com/skyrimspecialedition/mods/87632)).
  - **Mordhau / Chivalry** have no lock and cap the turn speed during a swing.
  - **The lesson:** a *hard* camera lock is the part that breaks in first person. The view has to *ease* onto the target with a
    rate cap, and the player must be able to switch that assist off.
- **Accessibility:** automatic camera movement is a known motion trigger. Give a way to turn it off and adjustable speed
  ([Xbox XAG 117](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117),
  [GAG](https://gameaccessibilityguidelines.com/avoid-or-provide-option-to-disable-any-difference-between-controller-movement-and-camera-movement/)).
  No source publishes a turn-rate cap in degrees per second; ours below is our own tuning.
- **Mobile:** most action games on touch auto-target rather than hard-lock.
  - **Genshin** has no manual lock, and its auto-target misfires skills
    ([source](https://screenrant.com/genshin-impact-auto-lock-target-combat-bad-fix/)).
  - **Honkai Impact 3rd** offers Free / Precise / Auto lock modes, with the move stick picking the lock direction
    ([source](https://honkaiimpact3.fandom.com/wiki/Settings)).
  - **Wuthering Waves:** a press locks and a hold releases
    ([source](https://game8.co/games/Wuthering-Waves/archives/455867)).
  - **Tower of Fantasy** auto-locks, with a "Change Target" on Tab.
  - **CoD Mobile** is aim-assist friction only.
  - **Touch-switch methods** (swiping on the camera area, re-tapping the lock button, tapping the enemy) are common, but no
    source confirmed which game does which (unverified). A button of at least 44 pt / 48 dp near the attack thumb is the norm.
- **Ranged:**
  - **OoT:** a Z-locked bow auto-hits.
  - **Elden Ring:** a locked bow tracks the body, but weak points need manual aim
    ([source](https://attackofthefanboy.com/guides/how-to-aim-zoom-with-bows-crossbows-in-elden-ring/)).
  - **Horizon Zero Dawn** has no lock. Its assist only bends the arrow toward a nearby weak spot, and is off on the hard modes.
  - **Monster Hunter** has a press-once Target Camera that turns the view, not the aim
    ([source](https://steamcommunity.com/app/582010/discussions/0/1743356517513887959/)).

What we already have to build on:

- **`meleeLock` + `findLunge`** (`src/player/AimTargets.ts`, `Sword.ts`): the lunge soft-lock (≤ 4 m, heavy 5 m, ±25°,
  score = angle / cone + 0.3 · dist / range). This is already Elden Ring's "Auto-Target".
- **`LockOn.ts`:** the cyan corner brackets during the lunge.
- **`Combat.ts` `.ws-combat-hp`:** the "REEF CRAB" name + health tag.
- **`TouchControls.lungeTurn`:** the camera ease toward the target (6 /s, cap 150°/s).
- **`AimAssist`:** friction / snap / tracking.
- **`Player.dodge()`** (3 m in 0.25 s) and **`Player.dashTo()`**.

The hard lock is a layer on top of these, not a replacement.

## 2. The design (J + N)

### 2.1 Input

| | touch | desktop |
|---|---|---|
| lock / unlock | tap **LOCK** (a toggle, OoT's SWITCH mode) | **Z** (free; Q = swap, F = attack, Left Alt = dodge, E = use, H = hover, M = map, C / Ctrl = crouch) or **middle mouse** |
| switch target | **flick** on the LOOK pad / right-half look area (4-way) | a **mouse flick** past the threshold, or the **scroll wheel** (up = right, down = left) |
| nothing to lock | the tap levels the view to the horizon (OoT's "Z re-centres"), and LOCK flashes "NO TARGET" once | same |

**Toggle, not hold.** On touch, a hold would pin a thumb. The right thumb has to be free for ATTACK / DODGE / the flick, and the
left thumb never leaves the stick (E37 thumb-flow rule). OoT's own default was SWITCH. BotW's hold works because a pad has a
spare trigger finger, which a phone doesn't. Desktop gets the same toggle so both teach the same rule. A "hold" option is a
lever (L13).

**Why J** (the disc left of DODGE, above ATTACK):

- **The thumb:** it is the right thumb's arc (E37 R14). From ATTACK it's a ~70 px roll up-right. The left thumb keeps orbiting
  on the stick meanwhile.
- **Size:** it is the same size as DODGE, well over 44 pt.
- **Frequency:** you press LOCK once per fight, not every second, so it gets the spot next to the reflex buttons, not the reflex
  spot itself.
- **K** (the chip over the LOOK pad) is closer but small (24 px tall). A thumb resting on LOOK would hit it by accident.
- **L** (tap the enemy) needs no button but has problems:
  - It lands in the free-look area, so every look drag that starts on a crab would lock.
  - Small crabs at 8 m are ~30 px targets.
  - It's worth keeping as an *extra* way in (a tap under 12 px / 200 ms on an enemy's on-screen box), not the only way.
- **M** (a half of the HOVER pill) is reachable by either thumb, but it's at the bar's centre, away from both rests, and HOVER
  and SWAP already share that pill.
- **Double-tap ATTACK** was considered and dropped: a fast tap-tap is the light combo (E42), so a double tap can't mean two
  things.

### 2.2 Target acquisition

- **Candidates:**
  - alive, not hidden;
  - `kind` hostile (crab, boar, monkey, sailor, bear; deer and gulls never);
  - within **ACQUIRE = 12 m** (feet to body edge, as `findLunge`) and inside **±40°** of the camera forward;
  - **line of sight:** a ray from the eye to the body centre (`dims.bodyY`) clears terrain + `player.colliders`.
- **Score** (lowest wins; the Souls rule, screen centre first):
  `angle / 40° + 0.35 · dist / 12 m`. A mid-attack enemy (`animal.state === 'attack'`) gets −0.1, so the one about to hit you wins
  a tie.
- **The LOCK button's states:** the lock key runs every 0.1 s, not per frame.
  - **OFF:** dim ring, nothing lockable. The button stays visible; hiding it would teach nothing.
  - **AVAILABLE:** pulse + hollow triangle over the best candidate. This is J's frame.
  - **LOCKED:** filled cyan, "LOCKED".
- **Flyers:** the cone is measured in 3D (yaw *and* pitch), so a gull-sized flyer up at 30° is lockable. Up / down flicks read
  the pitch (§2.5).

### 2.3 Camera while locked (first person)

The eye is the camera, so "the camera is fixed" means **the view tracks the target**. How it tracks:

- **Engage:** yaw and pitch ease onto the aim point with the lunge turn's curve, faster: exponential **8 /s**, capped at
  **240°/s**. A target 40° off-centre centres in ~0.3 s.
- **Hold:** keep the aim point inside a **±2° dead zone**, following at **6 /s**, capped at **180°/s**. The dead zone stops the
  view from twitching with every crab step; the cap stops a boar running past from whipping the view (the sickness rule).
- **The aim point:** the body centre (`bodyY × scale`). For tall targets (the sailor, bear) it is the upper body, halfway to
  `headWorld`, like AimAssist. For a target taller than the view's 60 % (the big-enemy ankle problem), aim at the chest and
  don't pitch past **+35°** up. Pitch is clamped to **[−45°, +50°]**, with flyers allowed up to +60°.
- **LOOK drag while locked** is a **free offset**, not a turn: ±10° yaw / ±6° pitch at most, rubber-banded, back to 0 in 0.25 s
  after the finger lifts. The world doesn't feel dead under the thumb, and you can glance at a second crab without losing the
  lock.
- **A drag from ATTACK** (the E42 swing-and-turn) does the same offset.
- **Breaks:**
  - distance > **BREAK = 18 m** (1.5× ACQUIRE, OoT's ratio);
  - line of sight lost for **1.0 s**;
  - swimming, hover board, zipline, a menu / dialogue, a weapon swap to ranged;
  - the target's `hidden`.
  - A break plays the unlock sound, and the view stays where it is (no snap back).
- **The target dies:** **auto-next** if another candidate is within **8 m** and ±90° of the view (OoT's re-pick cone), after a
  0.35 s beat so the kill reads. Otherwise unlock. This is Elden Ring's "Auto Lock-On", a setting, default **on**.
- **Accessibility (XAG 117):** a Settings row "Lock-on camera: Follow / Gentle / Off".
  - **Gentle** halves the rates.
  - **Off** keeps the lock (the reticle, orbit strafing, lunge onto the target, switching) but never turns the view. It's the
    free-look lock, for players who get sick.

### 2.4 Movement while locked

- **MOVE = polar around the target:**
  - stick **x** → tangential speed along the circle (left = clockwise, as OoT);
  - stick **y** → radial (forward = close in, back = retreat).
  - At a pure sideways push, correct the radius each frame so the orbit stays at the radius you had instead of spiralling
    outward (a straight strafe from a tracking camera drifts out by r·(1/cos θ − 1)).
  - Minimum radius = `targetRadius + 0.9 m`, so you never walk into the crab.
  - Walk speed as now. Sprint only works forward (a charge in); a sideways sprint is ignored.
- **The HUD says so:** the "MOVE" label reads **"ORBIT"**, and two curved arrows hug the stick ring, the pushed side lit (S1).
- **DODGE while locked** is relative to the target, not the view:
  - **side** → a **side-hop**: 3 m of *arc* around the target, keeping the radius;
  - **back / none** → a **backstep**: the current dodge, straight away;
  - **forward** → a short **close-in** dash that stops at LUNGE_STOP from the body.
  - Cooldown, i-frames and feel stay as `Player.dodge()` (0.6 s cooldown).
  - A Flurry-Rush-style perfect-dodge window is a separate lever (L14), not part of v1.
- **LUNGE / swings:** `findLunge` returns the **locked target** when it is within LUNGE_RANGE (heavy: _HEAVY). The cone check is
  skipped, since the view is on it anyway. The lunge never picks a different crab while you are locked.
- **JUMP:** unchanged. A locked jump-attack (OoT's Z + A) is a lever (L15).

### 2.5 The flick switch (LOOK pad and the free-look area, while locked)

- **Flick vs drag:**
  - **Flick:** the touch travels ≥ **28 px** at a peak speed ≥ **600 px/s**, measured over any 60 ms window, and lifts or keeps
    going within **200 ms** of touch-down.
  - **Anything slower** is the free offset from §2.3.
  - This is the Souls "mouse jitter" fix: a slow thumb never switches.
- **Direction:** the dominant axis, 4-way, ±45° sectors.
  - **Left / right:** among candidates (ACQUIRE range, LOS), the nearest in *screen angle* on that side of the current target.
    It's measured as its bearing relative to the current target, not to the crosshair, so repeated flicks walk along the row.
  - **Up / down:** the same on pitch. With no flyers on Driftwood, up / down usually find nothing.
  - **Nothing on that side:** the edge chevron flashes once and a dull "tick" plays. The lock stays.
- **One flick = one switch:** a 250 ms refractory time follows each switch.
- **Desktop:** the mouse delta accumulates over 60 ms windows; > **120 px/s** horizontal *and* > 40 px is a flick. The scroll
  wheel steps right / left.
- **The pad says so:** "LOOK" becomes **"SWITCH"** with ‹ › chevrons and a solid border (N). The **edge chevron** (‹ / › at the
  screen edge, level with the next target, with its distance "4 M") shows where a flick goes (R1 → R2). A chevron shows only
  when a candidate exists on that side.

### 2.6 HUD feedback (N)

| element | now | locked (N) |
|---|---|---|
| on the target | brackets only during a lunge (`LockOn.ts`) | a solid cyan **▼ triangle** over the back + **corner brackets** always, sized from dims (LockOn.ts's projection); brackets tighten + brighten while lunging (today's `.lunging`) |
| name + health | `.ws-combat-hp` over the last-hit animal | the same tag, pinned to the **locked** target, above the triangle |
| other lockables | — | nothing (O's hollow diamonds are the alternative) |
| next target | — | the **edge chevron tab** ‹ / › + "N M" (only when a candidate is off-screen or near the edge) |
| LOCK button | — | OFF (dim) / AVAILABLE (pulse + hollow ▽ over the candidate) / LOCKED (filled, "LOCKED") |
| LOOK pad | "LOOK", dashed | "SWITCH", ‹ ›, solid border |
| MOVE | "MOVE" | "ORBIT" + two arc arrows, the pushed side lit |

- **Q's amber wind-up telegraph** (the reticle turns amber #ffb35c while the target winds up an attack) is worth a separate
  pick. It's the "tell" that makes a side-hop feel earned, and it fits any reticle. It's the one new colour; see question 4.
- **Sound:**
  - a short bright two-note "lock" chime (the Navi *ping* idea, not her voice);
  - a softer one-note "switch";
  - a low "unlock";
  - a dull "tick" for a flick with nothing there.
  - They come from the SFX bank, which the E5 audio agent generates.
- **Haptics** (`src/ui/haptics.ts` `buzz`, Android only): lock 12 ms, switch 6 ms, break 20 ms. iOS has no web vibrate; the
  native shell could map these later.

### 2.7 Out of scope: the bow (recommendation for later)

Lock-on for the Nalati bow / crossbow would kill the aiming skill if a locked shot always hits. Recommendation: with a ranged
weapon, LOCK is **camera-only (Monster Hunter's Target Camera)**.

- **What it does:** the view tracks the target and the flick switches.
- **What it doesn't:** the crosshair does not snap to the head. The bolt flies true from the crosshair.
- **Hits:** a body hit is easy because the view is on the body. A head / weak-point hit (the crit) still needs the player's own
  small offset (the ±10° free offset from §2.3 becomes the aim).
- **Range:** lock range 30 m for ranged, not 60.
- **Flyers:** birds in the sky become lockable, but hitting one still takes leading the shot.

This keeps "free aim vs lock-on" a skill gap (lock = consistent chip damage, free aim = crits) instead of deleting it
(Elden Ring's split).

## 3. Levers (build order; none approved)

| # | lever | what | files | size | depends on |
|---|---|---|---|---|---|
| L1 | Lock state | `lockOn: { target, state: 'off' \| 'available' \| 'locked', candidate }` next to `meleeLock` in AimTargets.ts; `acquire()` / `release()` / `candidates()` with the §2.2 score, LOS ray, hostile filter | `AimTargets.ts` (+ a new `src/player/LockOnTarget.ts`) | M | — |
| L2 | Break + auto-next | distance / LOS timer / state breaks, the death → auto-next rule | same | S | L1 |
| L3 | Camera track | engage + hold rates, dead zone, pitch clamps, the free offset spring, the Follow / Gentle / Off setting | `Player.ts` (`preUpdate`), `TouchControls.ts` (drag → offset while locked), `Settings.ts` | M | L1 |
| L4 | Orbit move | polar MOVE with the radius correction + min radius, sprint forward-only | `Player.ts` | M | L1 |
| L5 | Dodge / lunge while locked | side-hop arc, close-in dash, `findLunge` → locked target | `Player.ts`, `Sword.ts` | S | L1, L4 |
| L6 | Flick switch | the flick classifier (touch + mouse), 4-way pick relative to the current target, refractory | `TouchControls.ts`, `Player.ts` (mouse), `LockOnTarget.ts` | M | L1 |
| L7 | LOCK button (J) | the disc, three states, pulse; E46's arc tokens | `TouchControls.ts`, `touch.css` | S | L1; after E46 lands |
| L8 | Locked HUD (N) | triangle + brackets always while locked (evolve `LockOn.ts`), `.ws-combat-hp` pinned to the target, edge chevrons, the SWITCH pad + ORBIT stick states | `LockOn.ts`, `Combat.ts`, `touch.css`, `game.css` | M | L1, L6 |
| L9 | Desktop binds | Z / middle mouse toggle, mouse flick, wheel step; the key hint in the controls help | `Player.ts` / `Weapons.ts`, HUD help | S | L1, L6 |
| L10 | Sound + haptics | four SFX cues, three buzzes | `Audio.ts`, `haptics.ts`, SFX bank | S | L1 |
| L11 | Tap-the-enemy (L as an extra) | a short tap on an enemy's projected box locks it | `TouchControls.ts` | S | L1 |
| L12 | Tests | §5 | `test/`, `scripts/` | M | all |
| L13 | Hold mode option | Settings: Lock = Toggle / Hold | `Settings.ts` | S | L7 |
| L14 | Perfect side-hop | a side-hop in the ~0.2 s before a telegraphed hit lands → slow-mo + a free heavy (Flurry Rush) | `Player.ts`, `Sword.ts`, enemy attack states | M | L5 + Q's telegraph |
| L15 | Locked jump attack | JUMP then ATTACK while locked = a leaping overhead (OoT Z + A, 2× damage) | `Sword.ts`, `SwordMoves.ts` | M | L5 |

## 4. Tuning numbers (starting points)

| knob | value | why |
|---|---|---|
| ACQUIRE | 12 m (feet → body edge) | 3× the lunge; a crab group fits, the next group over doesn't |
| BREAK | 18 m | OoT's 1.5× acquire → release ratio |
| acquire cone | ±40° (3D) | the portrait view is only ~±20° wide (Hor+), so this reaches just off-screen, like OoT's ±60° on a wider view |
| auto-next | ≤ 8 m, ±90° of the view, after 0.35 s | OoT's re-pick cone |
| score | angle / 40° + 0.35 · d / 12 m − 0.1 if attacking | screen centre first (Souls), distance breaks ties |
| engage ease | 8 /s, cap 240°/s | ~0.3 s to centre a 40° target |
| hold ease | 6 /s, cap 180°/s, ±2° dead zone | no jitter, no whip |
| pitch clamp | −45° … +50° (flyers +60°), chest-aim cap +35° on tall targets | the big-enemy ankle problem |
| free offset | ±10° yaw, ±6° pitch, 0.25 s spring | glance without unlocking |
| flick | ≥ 28 px and ≥ 600 px/s, within 200 ms; 250 ms refractory | a slow thumb never switches |
| mouse flick | > 120 px/s and > 40 px in 60 ms | Souls jitter fix |
| LOS lost | 1.0 s | a palm trunk passing doesn't drop the lock |
| orbit min radius | targetRadius + 0.9 m | never inside the crab |
| side-hop | 3 m of arc, 0.25 s | = DODGE_DIST / DODGE_TIME |

## 5. Test plan

- **Unit** (vitest, `test/lockon.test.ts`):
  - **Score:** centre beats nearer-but-off-axis; the attacker wins the tie; LOS-blocked is excluded.
  - **Flick classifier:** fast-short is a flick; slow-long is a drag; diagonals go to the dominant axis; the refractory stops a
    double switch.
  - **Orbit:** 2 s of pure lateral input keeps the radius within ±0.15 m and sweeps ≥ 60°.
  - **Break / auto-next:** the rules in §2.3.
- **Live drive** (`scripts/lockon-drive.mjs`, Playwright `--use-angle=metal`, 390×844 `?touch&tier=phone&skipintro&nolock&weapon=sword`
  plus `&at=127.1,2.6,-9.8,-1.66,-0.3`, the tidepool used for these mockups; mind the 3-browser cap):
  1. Wait for `window.__world`, then assert LOCK is `.available` and the lock state is `available`.
  2. **Lock:** tap LOCK → state `locked`, the target is the centre crab; after 0.5 s the aim point's screen x is within 2 % of
     the centre.
  3. **Switch:** a pointer flick on the LOOK pad (40 px in 50 ms, leftward) → the target changes to a crab with a smaller
     screen x. A slow 80 px drag over 600 ms → the target is unchanged, and the view comes back to the target within 0.4 s.
  4. **Orbit:** hold the MOVE stick fully left for 2 s → the distance to the target changes by < 0.3 m and the bearing by ≥ 45°;
     the target stays centred.
  5. **Dodge:** DODGE with the stick left → the radius is kept ±0.3 m.
  6. **Auto-next:** kill the target (`target.damage(999)` via `__world`) → within 0.6 s another crab is locked.
  7. **Break:** teleport 25 m away → state `off`.
  8. **Screenshots** at steps 2, 3, 4 into `progress/NNN-lockon-*.jpg`.
- **Desktop:** the same drive with Z, a synthetic `mousemove` flick and the wheel.
- **Phone:** Jake on the iPhone at the tidepool, with a feel checklist:
  - does the engage turn feel sick at 240°/s?
  - does a flick ever fire by accident while dragging to glance?
  - is LOCK reachable without regripping?

## 6. Open questions for Jake

1. **Button:** J (disc left of DODGE), K (chip over LOOK), L (tap the enemy, no button) or M (LOCK | HOVER pill)?
   Recommended: J, with L's tap-the-enemy as an extra way in (L11).
2. **Locked HUD:** N (Zelda ▼ + brackets + tag on the enemy), O (ring + fixed top banner + diamonds on the others),
   P (minimal ground ring + one text line + vignette) or Q (dot reticle + bottom banner)? Mixes are fine ("N with O's
   diamonds"). Recommended: N.
3. **Toggle vs hold:** toggle (recommended), hold, or both behind a setting (L13)?
4. **The amber wind-up telegraph** (Q): in v1 or later? It's the one new colour in the HUD.
5. **When the target dies:** auto-lock the next crab (recommended default) or always unlock?
6. **The camera:** is a first-person view that *turns by itself* OK for you on the phone? The Gentle / Off setting ships
   either way. Should "Off" be the default for the first test?
7. **The bow:** lock = camera-only, crits stay free-aim (recommended, §2.7), full auto-aim like OoT, or no lock with ranged
   weapons at all?
8. **Perfect side-hop / flurry** (L14) and the **locked jump attack** (L15): wanted after v1, or not this game?
