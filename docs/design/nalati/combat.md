# Nalati — combat: bow, sabre, spear, javelins, and the saddle

Round 2 design section for ASKS E11 / `project/archive/2026-09-23-nalati.md` decision N2. The user's pick: **A horse archery ·
C recurve bow on foot · D mounted sabre · B spear (+ javelins)**; the eagle hunter is parked. Style B (painterly)
is locked, so every mockup below is a re-render of a round-1 pick in that look with the reference HUD.

## Mockups (round 2, painterly)

| shot | file | what it pins down |
|---|---|---|
| Horse archery | `art/nalati-grasslands/round-2/1-combat/combat-A-horse-archery.jpg` | DRAW (left) / GALLOP (right) discs, amber STEED bar under VITALS, the ears-and-mane frame at gallop |
| Parthian shot | `art/nalati-grasslands/round-2/1-combat/combat-A2-horse-archery-turn.jpg` | looking back over the rump while the horse runs straight; REAR SHOT chip |
| Bow on foot | `art/nalati-grasslands/round-2/1-combat/combat-C-bow-foot.jpg` | full draw, dotted arrow-drop arc + landing ring, WIND chip, ARROWS count |
| Mounted sabre | `art/nalati-grasslands/round-2/1-combat/combat-D-mounted-sabre.jpg` | SLASH / GALLOP, the wide slash trail, the HIT chain counter |
| Spear brace | `art/nalati-grasslands/round-2/1-combat/combat-B-spear-brace.jpg` | spear planted at a charging boar, BRACE disc, THROW disc, JAVELINS 3 pips |
| Javelin throw | `art/nalati-grasslands/round-2/1-combat/combat-B2-javelin-throw.jpg` | release pose, dotted throw arc, a spent pip |
| Weapon swap | `art/nalati-grasslands/round-2/1-combat/combat-E-weapon-swap.jpg` | the 4-slot strip above VITALS + the hold-to-open radial wheel with slow-mo |

Round-1 versions (content reference, other art styles): `art/nalati-grasslands/round-1/2-combat/`.

## The four weapons at a glance

| | Bow (composite recurve) | Sabre (kylysh) | Spear | Javelin |
|---|---|---|---|---|
| role | the main weapon; long range, on foot and mounted | melee, and the mounted pass | reach melee + the anti-charge brace | a heavy ranged hit at short range |
| touch primary | hold **DRAW** disc (left) to draw, release to loose; a TAP on the LOOK pad = snap shot | tap LOOK pad = combo swing; hold **SLASH**/AIM disc = heavy | tap LOOK pad = thrust; hold **BRACE** disc (right) | hold **THROW** disc (left) to wind up, release to throw |
| desktop | hold LMB draw, release loose; RMB = steady (1.3× zoom) | LMB combo, RMB heavy (Sword.ts) | LMB thrust, hold RMB brace | hold LMB wind-up, release throw |
| damage (body / head) | 40–48 at full draw, ×2.5 head | 24 / 24 / 32 combo, 48 heavy | 30 thrust; brace 60 + 8 × charge speed | 55, ×2 head |
| ammo | quiver 24, arrows recoverable | — | — | 3 carried (5 with the camp upgrade), recoverable |
| mounted | yes (the whole of A) | yes (single wide pass slash) | couched lance at canter+ | yes, horse speed added |

For scale: the player walks 4.3 m/s, sprints 7.2, crouches 2.2 (`Player.ts`); a deer has 60 hp, a boar 100,
a wolf (new) 70; the crossbow bolt flies at 62 m/s and does 32–40 body (`Crossbow.ts`, `Animal.ts DAMAGE`).

## A · Horse archery (bow from the saddle)

The fantasy is the Kazakh / Scythian horse archer: gallop past, loose, keep running.

- **Steering and looking are decoupled.** On the horse the MOVE stick steers the *horse* (x = turn, y = gait) and
  the LOOK pad turns the *rider's head* up to ±170° off the horse's heading. You can ride dead straight and aim
  anywhere, including backwards — that is what makes the Parthian shot fall out for free.
- **Gaits on the stick** (y deflection): 0–30 % walk 1.8 m/s · 30–70 % trot 4.5 · 70–100 % canter 8.5.
  **GALLOP** (right disc, hold) = 13 m/s while STEED stamina lasts.
- **STEED stamina** (amber bar under VITALS): 100; gallop drains 12/s (≈ 8 s of gallop), canter is neutral,
  trot / walk regenerate 15/s. At 0 the horse drops to canter for 3 s and snorts. Wolves biting the horse
  cost 15 stamina a bite and raise its panic (see `wolves-horses-taming.md`).
- **Draw on horseback**: 0.9 s to full (0.75 on foot). Aim spread by gait (the cone the arrow leaves in,
  full draw): still 0.3° · walk 0.8° · trot 3.0° (the bumpy one — horse archers avoid it) · canter 1.5° ·
  gallop 1.8°. The painterly reticle shows it as a ring that breathes with the hoof beat; loosing on the
  "float" of the gallop stride (the ring's smallest moment, every 0.42 s) halves the spread — a skill beat,
  not a requirement.
- **The arrow inherits the horse's velocity.** Shooting forward at gallop adds 13 m/s (and ~+20 % damage
  via speed); shooting sideways you must lead less than you think. The aim-assist (`AimAssist.ts` friction +
  tracking, touch only) is allowed a wider cone mounted: 6° instead of 4°.
- **Parthian shot** (`combat-A2`): once the rider's view is > 110° off the horse's heading the REAR SHOT chip
  appears; the draw is 0.2 s slower and spread +0.5°, but a hit on a *pursuing* animal (closing on you)
  staggers it (0.6 s) — the counter to a wolf pack chasing a rider.

## C · The recurve bow on foot

- **Hold to draw, release to loose.** Draw curve: the power `p` rises 0 → 1 over 0.75 s (ease-out). Loosing
  below p = 0.25 drops the arrow at your feet (no shot, no ammo spent). Hold at full: steady for 2.5 s, then the
  sway grows (±1.5° over the next 1.5 s); at 4 s the arms tire and the bow lets down.
- **Snap shot**: a quick TAP on the LOOK pad (the existing fire gesture, < 12 px, < 300 ms) auto-draws to
  p = 0.6 and looses 0.35 s later — the "I'm in trouble" shot.
- **Arrow flight**: speed 30 + 28 × p m/s (58 m/s at full draw), drag 0.015, gravity **5.0 m/s²** (half real —
  the arc must be visible and readable, not a laser and not a mortar). Drop at full draw: 0.7 m at 30 m, 2.9 m
  at 60 m, 7 m at 90 m. Range to a 1.5 m drop ≈ 42 m.
- **Damage**: (40–48) × (0.35 + 0.65 × p) body, × 2.5 head; the existing distance falloff (to 60 % from 40 to
  90 m) stays; a shot from **HIDDEN** (see `stealth-and-storms.md`) is a sneak shot, × 2.
- **Wind drift**: the arrow is pushed toward the wind velocity: `a_side = 0.25 /s × (wind − v_side)`. At full
  draw that is 0.2 m at 30 m and 0.75 m at 60 m in a 6 m/s breeze; 2.7 m at 60 m in a 22 m/s storm. The WIND
  chip under the minimap (`combat-C`: `WIND ← 6 m/s`) is always on in Nalati — the grass waves show the
  same wind (one wind object, plan F2).
- **The arrow-drop arc** (`combat-C`): on foot, at full draw, held ≥ 0.3 s, a dotted cyan arc and a landing
  ring are drawn, *including* wind drift. A pause-menu switch "Hunter's eye" (default ON on touch, OFF on
  desktop). Mounted, the arc is never drawn — the ring reticle only.
- **Arrows**: quiver of 24 (the HUD strip reads ARROWS 18). A stuck arrow in the ground or a carcass is
  recovered by walking over it (70 % survive; a broken one just vanishes). Bundles of 12 in the camp.
  This replaces the crossbow's bolt count and reload: a bow has no reload, the draw *is* the reload.

## D · The sabre (kylysh), on foot and mounted

- **On foot it is Driftwood's sword** (`Sword.ts` / `SwordMoves.ts`) with a new curved-blade viewmodel: the same
  SLASH → BACKHAND → FINISHER chain, COMBO_GAP 0.6 s, the charged HEAVY (hold 0.45 s). Damage 24 / 24 / 32,
  heavy 48 (the iron sword is 28 base; the sabre is lighter and quicker: `total` of each move × 0.9). Reach
  2.2 m, stagger values unchanged.
- **Mounted it is a single wide pass** (`combat-D`): a tap on the LOOK pad (or the SLASH disc, which replaces
  AIM while mounted with the sabre drawn) swings on whichever side the nearest target is relative to the horse
  (left target → a backhand on the left). Reach 2.8 m from the saddle, the hit fan pitched 20° down (wolves are
  low). Damage 24 × (1 + v / 12) where v is horse speed: 50 at gallop, 41 at canter. Cooldown 0.7 s — one
  slash per pass, you ride through and wheel round.
- **The pass chain** (`2 HIT` chip): mounted hits within 3 s of each other chain, +10 % damage per link up to
  ×1.4; the chip fades at the end of the window. Rewards riding *through* a pack instead of stopping in it.
- A sabre hit on a wolf that is mid-lunge staggers it heavily (1.5 m / 0.8 s — `Animal.stagger` strength 1).

## B · The spear and javelins

- **Thrust**: tap the LOOK pad → 0.35 s thrust (0.12 s wind-up, 0.1 s active), reach **3.2 m** (a metre more
  than the sabre — the spear keeps a wolf at bay), damage 30, light stagger (0.5). A narrow fan
  (yaw ±0.1 rad) — it's a point, not an edge.
- **BRACE** (`combat-B`, right disc — replaces JUMP while the spear is held; RMB on desktop): hold to plant the
  butt (0.25 s to set), the player stops moving but can still turn at half rate. Anything that runs onto the
  point — enters 3.2 m inside ±30° of your facing at > 4 m/s — takes **60 + 8 × its speed** (a charging boar at
  7.5 m/s takes 120: dead; a lunging wolf at 9.5 m/s takes 136) and its charge ends; the player takes nothing.
  Brace held max 4 s, then 1 s cooldown. A charge from outside the ±30° cone hits you as normal — facing is the
  skill. The faint cyan BRACE ring at the point is lit only while set.
- **Couched lance** (mounted, spear held, canter or faster): the spear levels automatically; a target inside
  2.5 m ahead ±15° takes 40 + 6 × v. No input — you aim the horse.
- **Javelins** (`combat-B2`): hold THROW (the left disc when the spear or javelin slot is held) to wind up —
  0.4 s to full, release to throw. Speed 28 m/s (+ horse velocity mounted), **full gravity 9.8** (a short, heavy
  arc: 1.1 m drop at 15 m, 4 m at 30 m), damage 55 body, ×2 head, heavy stagger. Effective to ~30 m. Carry 3
  (JAVELINS pips), 5 with the camp's quiver upgrade; they stick and are recovered like arrows (90 %).

## E · Switching between four weapons on a phone

The engine today swaps two weapons with a SWAP pill and Q (`Weapons.ts`). Four needs something better. The
proposal (`combat-E-weapon-swap.jpg`) has two layers, both always available:

1. **The weapon strip** — four small square slots in a row directly above VITALS (bow / sabre / spear /
   javelin, ammo in the corner). **Tap a slot = select it** (the existing 0.25 + 0.25 s holster / raise
   animation). Always visible, zero learning, one tap. The equipped slot is outlined.
2. **The wheel** — **hold the left disc (AIM / DRAW / THROW) for 0.3 s** or **flick up from the strip** →
   the radial wheel blooms around the thumb with four wedges (BOW top, SABRE right, SPEAR bottom, JAVELIN left),
   the world drops to **0.3× time** and desaturates, slide the thumb into a wedge, lift = select. This is the
   in-fight swap: no looking down at the strip, and the slow-mo makes a mounted swap mid-gallop fair. (Single
   player: time scaling is fine.)
3. **Last-weapon toggle**: a double-tap on the strip swaps to the previous weapon (bow ⇄ sabre is the common
   pair).

Contextual discs change with the held weapon, so the two discs are always the two things that weapon does:

| held | left disc | right disc (on foot) | right disc (mounted) |
|---|---|---|---|
| bow | DRAW (hold) | JUMP (CROUCH in tall grass) | GALLOP |
| sabre | HEAVY (hold) | JUMP | GALLOP (SLASH on the LOOK tap) |
| spear | THROW (a javelin) | BRACE | GALLOP |
| javelin | THROW | JUMP | GALLOP |

Desktop: `1`–`4` select, `Q` last weapon, mouse wheel cycles, hold `Tab` opens the same wheel.

**Open question for the user**: the javelins can be their own slot (as mocked: 4 slots) *or* folded into the
spear (the spear slot throws javelins from its THROW disc, `combat-B`) — which leaves 3 slots and a simpler
strip. The recommendation is 3 slots (bow / sabre / spear + javelins), with the wheel keeping room for the
golden bow and fire arrows later.

## Engine notes — what exists, what is new

**Builds on:**

- `src/player/Weapon.ts` — the single-weapon contract (`tryFire`, `adsHeld`, `state`, `aimInfo`, `reach`, the
  hooks). Bow, sabre, spear and javelin each implement it, so HUD / Combat / TouchControls need no special case.
- `src/player/Weapons.ts` — the kit manager (holster blend `SWAP_TIME` 0.25 s each way, `select`, `swap`,
  `available`, `onUnlock`). Extend `WeaponId` with `'bow' | 'sabre' | 'spear' | 'javelin'`, add `previous` for
  the toggle, and a `strip` / `wheel` UI in `TouchControls.ts` that calls `select(id)`. Keys `1`–`4` already map
  to `available[n]`.
- `src/player/Crossbow.ts` — the projectile half of the bow: bolt pool (`MAX_FLYING` 8), `BOLT_DRAG` flight,
  stuck-bolt persistence (`MAX_STUCK` 200), impact puffs, tracers, `Targets.raycast`, `damageFor`. The bow is a
  new viewmodel + a draw state on top of this machinery; factor the flight / stuck / impact code out of
  `Crossbow` into a shared `Projectiles.ts` that the bow and the javelin both use (per-projectile speed, drag,
  gravity, wind coupling).
- `src/player/Sword.ts` + `SwordMoves.ts` — the combo / heavy / trail / fan hit test / hit-stop. The sabre is a
  new blade geometry + slightly faster keys; the spear thrust is a new `Move` (a forward key triple, a narrow
  fan, reach 3.2); the mounted slash is a `Move` chosen left or right at swing time.
- `src/entities/Animal.ts` `stagger()` / `applyDamage()` / `damageFor()` and `AnimalManager.onCharge` — the
  brace needs one new hook: the manager tells the weapon a charge is about to connect (`onChargeContact`), the
  spear can cancel it.
- `src/player/AimAssist.ts` — widened cone and tracking while mounted.
- `src/player/TouchControls.ts` — discs already swap by context (JUMP → DIVE while swimming); DRAW / THROW /
  BRACE / GALLOP / SLASH are the same pattern. DRAW and THROW are *held* discs (like DIVE), not toggles (like
  AIM).

**New:**

- `Bow.ts` (viewmodel: composite recurve, string that bends with `p`, nocked arrow; hold-draw-release; the arc
  preview) and `Javelin.ts`, sharing a new `Projectiles.ts` extracted from `Crossbow.ts`.
- `Sabre.ts` = `Sword` with the kylysh blade (or `Sword` gains `{ blade: 'sabre' }` like `'iron'`); `Spear.ts`
  (thrust + brace + couched lance).
- Mounted combat: every weapon reads `player.mount` (speed, heading) — arrow / javelin inherit velocity, the
  sabre switches to the pass slash, the spear to the lance. The mount itself is in
  `wolves-horses-taming.md` (F1).
- A global `Wind` object (plan F2) that the projectiles sample (`wind.at(x, z)` → m/s vector) and the HUD's WIND
  chip reads.
- HUD: STEED bar, ARROWS / JAVELINS strips (replacing BOLTS), weapon strip + wheel, REAR SHOT chip, HIT chain
  chip, arc preview (a `LineSegments2` like the tracers, dotted).

## Open questions for the user

1. Javelins: own slot (4) or part of the spear (3 slots)? Recommended: 3.
2. Arrow gravity at half of real (5 m/s²) so the arc reads — OK, or full 9.8 for the purists?
3. "Hunter's eye" arc preview on by default on phone — keep, or earn it (a skill / a title)?
4. Slow-mo while the weapon wheel is open (0.3×) — OK in a game with no multiplayer?
