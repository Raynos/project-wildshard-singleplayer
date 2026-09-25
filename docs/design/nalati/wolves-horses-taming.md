# Nalati — wolves, wild horses, taming, and riding

Round 2 design section for ASKS E11 / `project/archive/2026-09-23-nalati.md` decisions N3 (enemies) and F1 (mounts). The
user's pick: **wolf packs, wild horse herds, taming the stallion** — plus ambient sheep. The snow leopard, the
Kurgan King and the ghost riders are in `elites-and-bosses.md`.

## Mockups (round 2, painterly)

| shot | file | what it pins down |
|---|---|---|
| Pack hunt | `art/nalati-grasslands/round-2/2-creatures/wolf-1-pack-hunt.jpg` | three grass wakes converging, the lead wolf breaking cover, red flank chevrons at the screen edges |
| Alpha howl | `art/nalati-grasslands/round-2/2-creatures/wolf-2-alpha-howl.jpg` | dusk, the alpha on a kurgan with a balbal, pack at the base, the PACK ALPHA name banner |
| Wild herd | `art/nalati-grasslands/round-2/2-creatures/horses-1-wild-herd.jpg` | grazing herd, foals, the black stallion on the rise watching you |
| Stampede | `art/nalati-grasslands/round-2/2-creatures/horses-2-stampede.jpg` | the herd in full flight, dust, STAMPEDE chip |
| Taming 1 · approach | `art/nalati-grasslands/round-2/2-creatures/taming-1-approach.jpg` | crouched, OFFER disc, TRUST arc, the stallion's ALERT ear |
| Taming 2 · bucking | `art/nalati-grasslands/round-2/2-creatures/taming-2-bucking.jpg` | on its back, tilted horizon, LEAN L / LEAN R, the HOLD ON arc, TAMING 3/5 |
| Taming 3 · bonded | `art/nalati-grasslands/round-2/2-creatures/taming-3-bonded.jpg` | the hitching rail, the TULPAR name tag, the MOUNT prompt |
| Sheep flock | `art/nalati-grasslands/round-2/2-creatures/sheep-1-flock.jpg` | ambient: flock, sheepdog, mounted shepherd, yurts |

Round-1 versions (content reference): `art/nalati-grasslands/round-1/3-enemies/enemy-1-wolf-pack.jpg`,
`enemy-3-herd-stallion.jpg`.

## Steppe wolves

**Stats**: 70 hp (a full-draw arrow body hit is 40–48 → two arrows, or one headshot), trot 4.0 m/s, run
**9.5 m/s** (faster than your 7.2 sprint — you cannot outrun a pack on foot; slower than a galloping horse at
13 — you can on horseback, while the STEED bar lasts). Bite 12 damage (18 from the alpha); a bite on the horse
costs the horse 15 stamina and +25 panic. Pack of 3–5, larger and more common at dusk and in storms.

### Pack AI — roles

A pack is one `Pack` object with shared state; each wolf has a role that can change mid-fight.

| role | who | job |
|---|---|---|
| **Alpha** | 1, the largest (variant `alpha`, 110 hp, name banner e.g. GREYMANE) | picks the target, calls the phase changes (howl = regroup), holds back until the player is hurt or turned away |
| **Flankers** | 2 | take slots on the ring *outside* the player's view cone; move only inside tall grass when they can |
| **Lunger** | the one wolf that holds the **attack token** | commits a lunge from behind / the side; after it, it breaks off and hands the token on |
| **Scout** | the youngest (0.85 scale) — in packs of 4–5 | probes first, runs early, gives the pack away with a yip |

### Pack AI — the hunt, phase by phase

1. **Roam** — the pack moves between grass patches at a trot, 60–120 s per leg.
2. **Scent** — the player is sensed by *smell* downwind (inside 60 m and within ±35° of the wind's direction
   from the player) or by the normal sight / hearing loop (`HuntTuning`: sight 35 m, cone 70°, hearing
   4 / 8 / 16 / 30 m still / crouch / walk / sprint). Scent ignores grass cover — wind matters for stealth.
3. **Shadow** — follow at 30–40 m, low, inside grass taller than 0.6 m, never in the open if a grass path
   exists. This is when the player sees the grass wakes (`wolf-1`).
4. **Encircle** — the pack takes slots on a ring of 12–16 m around the player, spaced 360° / n, and prefers the
   slots outside the player's 90° view cone. When the player turns, slots re-assign (the wolves drift, they do
   not teleport). Red **threat chevrons** appear at the screen edge for any wolf inside 20 m that is off-screen.
5. **Probe and lunge** — one **attack token** (two when the target is mounted: one at the horse, one at the
   rider). The token goes to the wolf with the best angle (most behind the player). The lunge: a 0.4 s crouch
   telegraph (a snarl, ears flat), a 9.5 m/s dash, a bite at 1.4 m, then a hard break-off back to the ring. A
   lunge that is hit (any weapon) is staggered; one that meets a braced spear dies. 2.5–4 s between lunges.
6. **Regroup** — when a wolf dies or the pack's total hp drops under 50 %, the **alpha howls** (`wolf-2`), the
   pack pulls back to 30 m and re-encircles, bolder: one more wolf may lunge at once for 10 s.
7. **Break** — the pack flees (full run, 60 m, then it's gone for this visit) when the alpha dies, or the pack
   is down to one wolf, or a stampede / a lightning strike lands within 20 m.

**Against a rider** the pack runs *with* the horse (`combat-A2` Parthian shot): flankers pace at the horse's
flanks, the lunger bites the horse's hind legs. Galloping out-runs them only while STEED lasts — the pack
rewards wheeling around and fighting, not fleeing forever.

**Wolves read the grass too**: a wolf in tall grass (≥ 0.8 m) is hidden from the minimap's red dots and from
aim assist until it is within 10 m or it moves (the wake shows it). Standing still in short grass it is always
visible. (Same `grassHeightAt` model as the player's stealth — `stealth-and-storms.md`.)

## Wild horses — the herd

**The herd**: 8–15 horses (chestnut, bay, dun, grey), 2–3 foals, one **black stallion**. Horse: 150 hp, walk
1.8, trot 4.5, canter 8.5, gallop 13 m/s. Foals 0.6 scale, 0.8× speed.

**Herd AI** (a light boids layer on top of the manager's grazing loop):

- The **lead mare** picks the next grazing spot 30–60 m away every 60–120 s; the herd drifts after her at a
  walk. Members keep **cohesion** (pulled toward the herd centre past 12 m), **separation** (pushed apart
  under 2.5 m) and, while moving, **alignment** (heading averaged with neighbours within 8 m). Foals stay
  within 4 m of their mother.
- Senses reuse the deer tuning shape (`DEER_TUNING`), a little sharper: sight 45 m head-up, 20 m grazing,
  cone 70°; hearing 4 / 8 / 15 / 30 m. An alarm spreads through the whole herd within 20 m in 0.2–0.8 s.
- **Flight** is a herd action: everyone gallops in one direction — away from the threat, bending around
  obstacles and the slab edge — for 80–120 m, then trots, stops, and looks back.
- **The stallion** does not graze with them. It keeps a *guard point* between the herd centre and the nearest
  threat (player or wolf), 10–20 m out. Its states: *watching* (head high, `horses-1`) → *warning* (a snort,
  a stamp, ears pinned at < 30 m) → *display* (rears at < 20 m if you're standing) → *charge* (at < 10 m and
  TRUST under 20: a 12 m/s charge, 25 damage and a knock-down) → *lead the flight*. Wolves are driven off:
  the stallion charges a wolf that gets inside 15 m of a foal.
- **Stampede** (`horses-2`): when a shot lands within 15 m of the herd, a wolf kills a foal, lightning strikes
  within 60 m, or the player *gallops into* the herd, the flight becomes a stampede — anything in the path
  (player, wolves) takes 30 damage and is knocked down. You can ride *with* a stampede (the herd flows around
  a rider moving at their speed) — a spectacle moment.
- Wolves hunt the herd's foals (a pack in `shadow` may pick a foal instead of you) — emergent scenes the
  player can intervene in, and a way to earn the stallion's trust faster (driving off a pack from the herd:
  +30 TRUST).

## Taming — step by step

The only way to get a horse. One stallion per herd; the herd itself stays wild.

**0 · Find him.** The horse plains POI; the stallion is on the minimap as a gold horse icon once seen.

**1 · Approach** (`taming-1`). Inside 40 m of the stallion the **TRUST** arc appears (0–100) with the
stallion's **ALERT** ear icon (grey → amber → red).

| what you do | TRUST | ALERT |
|---|---|---|
| crouched, moving ≤ 2.2 m/s, inside 25 m | +2 /s | — |
| holding **OFFER** (left disc; salt / an apple from camp) inside 12 m while ALERT is grey | +8 /s | — |
| approach from downwind | ×1.5 on the above | — |
| stand up / walk | 0 | +10 /s |
| run / gallop, or look straight at him (reticle on his head) for > 3 s — a challenge | −5 /s | +25 /s |
| shoot anything within 40 m | −30 at once | full |
| you drove a wolf pack off this herd today | +30 once | — |
| nothing / out of range | −1 /s (floor 0) | −15 /s |

ALERT at amber: he snorts and stamps (stop moving). ALERT at red: he rears (`display`) — back off within 3 s
or he charges (TRUST < 20) or leads the herd away (TRUST ≥ 20). A flight costs 30 TRUST; he can be found
again after the herd settles (~60 s). TRUST 100 and inside 3 m: a **MOUNT** prompt (the existing USE button,
`.ws-touch-use`) — the rope in the off hand (`taming-1`) is the horsehair halter you slip over his head as you
swing up; it is not a lasso you throw.

**2 · Break him** (`taming-2`). You swing up bareback and he bucks. **Five rounds** (TAMING n/5), each 3–4 s:

- The **HOLD ON** arc is a balance gauge; a cyan marker is pushed by the horse's moves — a *buck* (a big shove
  toward one end), a *spin* (a steady drift), a *rear* (a fast swing that reverses). Each move is
  telegraphed 0.3 s early by the horse's head and the camera.
- You counter with **LEAN L / LEAN R** (the two discs; `A` / `D` on desktop; optional phone tilt from the
  pause menu). Keep the marker in the green middle third.
- Each round is harder: the shoves grow 20 % and come faster. Survive a round → the next.
- The marker in a **red end for > 0.4 s** → you are thrown: 10 damage, TRUST −40, he runs with the herd.
  Try again from step 1 (TRUST starts from what is left).
- The camera: horizon tilted with the balance (up to 25°), heavy shake, FOV kick on each buck — clamped by the
  existing motion-comfort setting.

**3 · Bonded** (`taming-3`). After round 5 he stops, blows, and lowers his head. He is **yours**: a name card
(default **TULPAR** — the winged horse of Kazakh legend; rename it at the rail), a saddle and a felt blanket
appear on him at the camp. He waits at the camp's **hitching rail** (the respawn point for the horse).
MOUNT from the rail or anywhere next to him; **whistle** (hold the minimap, or `V`) and he comes at a gallop
from anywhere within 150 m. Titles: *Horse Lord* (the first tame).

## Riding (F1) — summary

The full combat-from-the-saddle numbers are in `combat.md`. The horse itself:

- **Mount / dismount**: USE next to him (0.6 s swing-up animation) / USE again while at walk or stopped.
- **Gaits on the MOVE stick**, steer with its x; **GALLOP** (right disc, hold) at 13 m/s; **STEED** stamina
  100, gallop −12/s, trot / walk +15/s. The eye rises from 1.68 to **2.6 m**; the ears, mane and bridle frame
  the bottom of the view (every mounted mockup).
- **Free look ±170°** on the LOOK pad; the horse keeps its heading.
- **Jump**: JUMP disc (while the weapon's right disc isn't GALLOP — i.e. at walk / trot): 1.2 m obstacles, a
  2.5 m ditch at canter+.
- **Panic**: 0–100; wolves' bites +25, a lightning strike within 60 m +50, a stampede +30; decays 10/s. At 100
  he rears and throws you (10 damage), then stands 10 m away snorting. The pack will go for you *on foot*.
- **The horse's hp**: 150; if it hits 0 he doesn't die — he bolts to the camp and rests (no horse for 3 min).
  Losing Tulpar forever is not on the table.

## Sheep (ambient life)

`sheep-1`: flocks of 20–40 fat-tailed sheep around the camp, a sheepdog that circles the flock (the flock AI
is the same boids with stronger cohesion, the dog a herding `think` that pushes stragglers back), a mounted
shepherd NPC on a loop. Sheep flee from wolves; a pack may raid the flock at dusk (a camp-defence moment).
Sheep are not huntable (the camp's property); shooting one angers nobody but costs you the camp's arrow
restock for the day. Also ambient: marmots that whistle when they see you (and so warn anything nearby —
awareness +0.3 to animals within 30 m), kites circling, cranes on the river.

## Engine notes — what exists, what is new

**Builds on:**

- `src/entities/species/registry.ts` + one file per species (`bear.ts`, `boar.ts`, `deer.ts`, …): a species is
  a single file with `registerSpecies({...})`, dropped in, no case to add. **New files**: `wolf.ts`,
  `horse.ts`, `sheep.ts`, `sheepdog.ts`, `marmot.ts`. The quadruped rig and pose generators in
  `src/entities/Animal.ts` already have walk / trot / **gallop** gaits, alert look-at, flinch, stagger and death
  — a horse and a wolf are new proportions (`AnimalDims`), fur, tints and variants (`alpha`, `black-stallion`,
  `foal`) on the existing rig.
- `src/entities/AnimalManager.ts` — the 10 Hz AI tick, the `HuntTuning` awareness loop (sight cone / hearing
  by player speed / freeze / bolt / flee / herd alert), `herds`, `addHerd`, `onCharge` for damage to the player,
  the bear's `stalk` (the closest thing to a hunter). Horses use the tuning loop almost as-is (deer shape,
  sharper numbers) plus a boids pass in the herd; the stallion and the wolves are **`think` species** — the
  pattern Driftwood's crab / monkey / sailor use (`SpeciesDef.think`, `ThinkCtx`, `animal.mem`,
  `setStrafe`, `startAttack`), which skips the flee loop but keeps hit tests, blood, health bars, onKill.
- `src/entities/Enemies.ts` — the Driftwood pattern for placing enemy groups and the extra world bits their
  AIs need. A Nalati `Wildlife.ts` does the same: packs, herds, flocks, the pack / herd shared objects.
- `Animal.stagger()` and `Animal.variant / rarity / label` — the alpha's name banner is the variant label.

**New:**

- `Pack` (shared hunt state: phase, ring slots, attack token(s), alpha) and `Herd` boids (cohesion / separation
  / alignment, lead mare, flight direction) — 10 Hz, CPU, for ≤ 15 animals each.
- **`Mount.ts`** + `Player.mount` — a riding mode beside `Player.hover` (`setHover` already switches off crouch
  / sprint / swim and owns the camera blend; the mount follows that pattern): eye 2.6 m, gait blend by stick,
  stamina, panic, free look relative to the horse, collision as a 0.9 × 2.4 m capsule. The horse *is* an
  `Animal` (the `horse.ts` rig) whose AI is switched off while ridden — the manager drives its `setMotion` from
  the rider's input. A first-person **horse head/neck/mane viewmodel** is a separate close-up mesh (the far
  rig's LOD is not good enough 1 m from the camera).
- **Taming** — a `Taming.ts` state machine (approach → mount → 5 rounds → bonded) with the TRUST arc, ALERT
  ear and HOLD ON gauge in the HUD; persistence of the tamed horse (name, saddle) in `game/Progress.ts`.
- HUD: STEED bar, TRUST arc, HOLD ON gauge, threat chevrons, name banner, the horse's name tag, the whistle.
- Species budget: a wolf / horse is the same lit program as the other animals; fur shells stay capped
  (`SHELL_DIST` 18 m, `SHELL_MAX` 4). A 15-horse herd + a 5-wolf pack + a 30-sheep flock in view at once
  needs the sheep as an instanced crowd (one skinned mesh, GPU-animated), not 30 `Animal`s.

## Open questions for the user

1. Tamed horse name: default **TULPAR** and renameable — or let the player name it at the bond moment?
2. One horse ever, or can you tame each herd's stallion (a stable of mounts with different stats)?
3. Should the horse be killable (permadeath stakes) or always come back after a rest (proposed)?
4. Sheep raids at dusk (wolves attack the camp flock) — a recurring camp-defence event, or keep the camp safe?
