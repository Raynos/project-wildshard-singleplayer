# Nalati — grass stealth and steppe storms

Round 2 design section for ASKS E11 / `project/archive/2026-09-23-nalati.md` features F2 (living grass + stealth) and F3
(steppe storms). Both run on the same **wind** and the same **grass**: the grass is the terrain, the cover
and the weather gauge at once.

## Mockups (round 2, painterly)

| shot | file | what it pins down |
|---|---|---|
| Hidden | `art/nalati-grasslands/round-2/3-features/stealth-1-crouched-hidden.png` | crouched in chest-high grass, the closed-eye HIDDEN pip, the GRASS cover meter, a wolf passing unaware |
| Detected | `art/nalati-grasslands/round-2/3-features/stealth-2-detected.png` | the pip turned to an amber-red "!" DETECTED, red vignette + threat chevron, the wolf staring |
| Front approaching | `art/nalati-grasslands/round-2/3-features/storm-1-front-approaching.png` | shelf cloud, rain curtains on the far hills, gusting grass, STORM IN 0:45 / WIND chip |
| In the storm | `art/nalati-grasslands/round-2/3-features/storm-2-in-the-storm.png` | rain, low visibility, lightning on the highest tree, horses bolting, flattened grass, GET LOW warning, dimmed minimap |
| After | `art/nalati-grasslands/round-2/3-features/storm-3-after.png` | rainbow, wet shine, puddles, the struck spruce smoking, the herd returning |

Round-1 versions (content reference): `art/nalati-grasslands/round-1/4-new-features/feature-grass-stealth.png`,
`feature-steppe-storm.png`.

## Grass stealth

### The rule the player learns

**Crouch in grass taller than your crouched body, keep still or creep, stay out of the wind's path to them —
and they walk right past you.** Everything else is numbers under that sentence.

### Inputs

- **Crouch**: touch — the JUMP disc becomes **CROUCH** whenever the player stands in grass ≥ 0.7 m (a tap
  toggles crouch; tapping again stands; JUMP comes back out of tall grass). Desktop: `C` / `Ctrl` (the
  existing `Player.crouching`: eye 1.68 → 1.03 m, speed 2.2 m/s). The crouch/jump control question in general
  is N6 (`controls.md`); this is the grass-specific behaviour.
- Nothing else. There is no stealth button — the HIDDEN pip reports the state.

### Detection model

Every animal already carries an **awareness** meter 0..1 fed by a sight cone and a hearing radius
(`AnimalManager.ts` `HuntTuning`: `sightRange`, `sightCone`, `hearStill / Crouch / Walk / Sprint`,
`noticeRate`, `alertAt`, `boltAt`). Stealth changes *how much of the player each sense gets*:

**Sight** — the effective sight range to the player is `sightRange × V`, where the visibility `V`:

```
g        = grassHeightAt(player.x, player.z)                 // 0 .. 1.3 m, from the grass field itself
h        = crouching ? 1.05 : 1.75                           // visible body height
cover    = clamp((g - 0.15) / (h - 0.15), 0, 1)              // how much of you is behind blades
screen   = mean cover of 3 samples along the ray from you toward the observer at 1.5 / 3 / 5 m
V        = (1 − 0.9 · max(cover, 0.7 · screen)) × motion × light
motion   = still 0.3 · creep (≤ 2.2 m/s) 0.7 · walk 1.0 · sprint 1.5 · just shot (1 s) 1.5
light    = day 1.0 · dusk 0.7 · night 0.4 · in a storm 0.6
```

So a crouched player in 1.1 m feather grass, still, by day: cover 1.0, V = 0.1 × 0.3 = 0.03 — a wolf with a
35 m sight range sees you at 1 m. The same player standing: cover 0.6, V = 0.46 × 0.3 = 0.14 → 5 m. Walking
upright in short grass: V = 1 → 35 m.

**Hearing** — the existing radius by speed, × 1.25 when *moving* in grass ≥ 0.7 m (the rustle), × 0.5 in a storm
(the wind covers it).

**Smell** (wolves, the stallion, the snow leopard): inside `scentRange` (wolf 60 m, horse 40 m) **and**
downwind of you (the observer within ±35° of the wind's direction from the player), awareness rises at the
hearing rate *regardless of grass*. The WIND chip is a stealth instrument.

**Tracks** — trampled grass (below) stays flattened 20 s; a wolf that crosses your fresh trail gets +0.3
awareness and turns to follow it.

### What the player sees (the eye pip)

| pip | when | look |
|---|---|---|
| **HIDDEN** | crouched, cover ≥ 0.85, and every animal within 40 m below 0.2 awareness | closed eye, calm cyan (`stealth-1`) |
| **NOTICED** | any animal between 0.2 and its `alertAt` | half-open eye, amber, its fill = the highest awareness; a small chevron points at that animal |
| **DETECTED** | any animal at `alertAt` or above | wide eye becomes an amber→red **"!"**, red vignette pulse, threat chevron (`stealth-2`) |
| — | not crouched / not in tall grass | no pip |

Plus the thin **GRASS** cover meter on the left edge while crouched (the `cover` value above), so the player
can see *why* a spot is good.

### What stealth buys

- **Sneak shot** — an arrow or javelin loosed while HIDDEN does **× 2** damage (a crouched headshot kills a wolf).
  Loosing reveals you (motion 1.5 for 1 s).
- **Taming** — the approach (`wolves-horses-taming.md`) is a stealth mini-game: TRUST only builds crouched.
- **Letting a pack pass** — a pack in `shadow` that loses you (awareness decays under 0.2) goes back to roam.
- **Symmetry** — wolves use the same grass: in grass ≥ 0.8 m they drop off the minimap and out of aim assist
  until they move (their wake shows them) or come within 10 m.

## Living grass — the engine side of stealth (F2)

- **`grassHeightAt(x, z)`** — the grass carpet (`src/world/Grass.ts`) seeds every 4 m cell from a hash of the
  cell coordinates and the terrain splat, so the CPU can compute the same height the GPU draws without any
  readback: one function shared by the cell seeder and the senses. Nalati adds a **height field** to the
  grass (short grazed turf 0.15 m near the camp and trails, 0.6 m meadow, 1.1–1.3 m feather-grass
  *stealth fields* in folds and along the river) painted from the chunk's own layout.
- **Movers bend the grass**: a uniform array of up to 16 movers (player, horse, wolves, herd leaders) — `vec4
  (x, z, radius, strength)` — read by the grass vertex shader to push blades away (the wakes in `wolf-1`).
- **Trample persistence**: a small `DataTexture` (128 × 128, R8, 0.5 m texels = 64 m around the player,
  scrolled with the player) where movers stamp "flattened" and it recovers over 20 s; updated at 10 Hz on
  the CPU (16 KB). The vertex shader reads it to lay blades down. Herd roads and your own trail show.
- Still **one draw call**, still 75k clumps (22k on phone — `TIER_CONFIG.grassSlots`); the stealth fields need a
  denser near field (painterly style note in the plan) — that's a budget item for checkpoint N4.

## Steppe storms (F3)

### Lifecycle

A seeded `Weather` state machine. Never in the first 10 minutes of a session, then one storm every 20–30
min of play; never during a boss fight; a dev switch `?weather=storm`.

| phase | length | sky & light | wind | rain / visibility | cue |
|---|---|---|---|---|---|
| **Clear** | 20–30 min | the normal sky | 3–7 m/s, gusts | — | — |
| **Building** | 90 s | a shelf cloud climbs from one horizon, sun still gold on the near grass, the planet dims (`storm-1`) | 7 → 12 m/s | rain curtains on far hills | chip **STORM IN 0:45** at 45 s left; distant thunder; herds lift their heads |
| **Gust front** | 20 s | the cloud passes overhead, light drops 50 %, grade goes slate | 14–18 m/s, a visible wave across the whole plain | dust, first big drops | the grass flattens in one travelling wave; flags snap |
| **Storm** | 2–3 min | slate-violet, flicker of lightning in-cloud | 18–24 m/s | heavy slanted rain, fog to ~60 m | lightning strikes; **STORM** chip; the minimap dims with static |
| **Clearing** | 60 s | the back edge of the cloud, sunbeams | 12 → 6 m/s | rain tapers, mist | — |
| **After** | 3 min | low gold sun, **rainbow** at 42° opposite the sun (`storm-3`) | 3–5 m/s | wet shine, puddles, steam | birdsong, the herd comes back |

### Gameplay effects

| system | effect during the storm |
|---|---|
| **Arrows / javelins** | the wind is 3–4× the calm value: 2.7 m drift at 60 m (full-draw arrow, 22 m/s wind); the WIND chip flashes |
| **Stealth** | sight × 0.6 both ways (`light` factor), hearing × 0.5 — the storm is the best time to sneak… |
| **Wolves** | …and the wolves know it: packs roam in the storm, one extra attack token, they lose their fear of the camp |
| **Horses** | the herd bolts on the first strike within 60 m (a **stampede**, `storm-2`); your horse's panic +50 per near strike — ride the storm and you may be thrown |
| **Lightning** | strikes every 6–15 s at the **highest exposed thing** within 250 m of a random strike cell: the score is height above the local ground, + 1.5 m for a mounted rider, + 1 m on a ridge crest, × 0 under a yurt or in a hollow. Telegraph: 1.2 s of crackle and a faint violet glow on the target. A strike does 60 damage within 4 m and knocks a rider off; a struck tree burns and smokes for the rest of the storm and stays scarred (`storm-3`) |
| **GET LOW** | the amber chip shows when *you* are the highest thing within 30 m (mounted on a ridge, standing on a kurgan) — crouch or get off the high ground |
| **Shelter** | inside / right beside a yurt: no rain, no lightning, the fire keeps you warm; the camp's people pull the door flaps (`storm-1`) |
| **After** | wet ground holds **tracks** — animal prints glow faintly to the hunter's eye for 3 min; mushrooms and herbs pop up (forage items) |

### Engine notes (storms)

**Builds on:**

- `windUniforms` (`src/world/TreeFactory.ts`: `uTime`, `uWindStrength`) already drives trees and grass (the
  gust-front wave in `Grass.ts`'s vertex shader, `params.windStrength`). The storm is **one wind object**
  (plan F2) that owns strength *and direction* (a new `uWindDir`), and that projectiles and the WIND chip read.
- `src/world/Atmosphere.ts` — `fogUniforms` and the underwater blend (`updateUnderwater`: capture the dry set,
  smoothstep toward another set). The storm fog is the same move with a third set (dense, slate).
- `src/core/Grade.ts` — the final colour grade (`shadowTint`, `highTint`, lift / gain / gamma per chunk): the
  storm lerps it toward a cold slate grade and the "after" toward a saturated wet one.
- `src/world/Particles.ts` — dust motes as a camera-wrapped `Points` box (mod-wrapped in the vertex shader,
  zero CPU). **Rain** is the same trick with streak quads stretched along the wind: 6k streaks on the phone,
  one draw.
- `src/world/Sky.ts` — sky, sun, the planet, CSM; the storm dims the sun and the planet and swaps the cloud
  deck.

**New:**

- `src/world/Weather.ts` — the state machine above; outputs a `WeatherState { phase, t, wind: Vector2, rain,
  cloud, wet, fog, lightning events }` that every other system reads (no system owns the weather).
- **Shelf cloud and rain curtains** — painted billboards on the horizon ring (the painterly cloud cards).
- **Lightning** — a bolt as a branching ribbon mesh (built once per strike, 0.2 s), a scene flash (sun
  intensity + exposure spike, 2 frames), a point light at the strike for 0.3 s, a scorch decal, thunder delayed
  by distance / 343 m/s.
- **Wet** — a global `uWet` uniform in the painterly lit material: albedo × 0.85, roughness × 0.4, a
  sky-reflection boost; **puddles** as decals in the heightfield's concave spots along trails.
- **Rainbow** — drawn in the sky shader: a 42° ring (40–42°, spectral) around the anti-solar point, fading with
  `wet` and sun visibility.
- AI hooks: `Weather.onStrike(point)` → `AnimalManager.disturb(point, strength)` (the herd bolts; the
  existing disturbance hook) and the horse's panic; `light` / hearing multipliers into the sense loop.
- Audio: rain bed by intensity, wind layers by speed, thunder by distance, the grass roar of the gust front.

## Open questions for the user

1. Storm frequency: every 20–30 min of play (proposed) — more, less, or tied to the day/night clock?
2. Lightning hitting the *player* on a horse on a ridge (60 damage) — keep the teeth, or make it cosmetic?
3. The arrow-drop arc and the HIDDEN pip are "assist" UI — both on by default?
4. Stealth fields (tall feather grass) as hand-placed zones (clear design) or everywhere the terrain folds
   (more organic, harder to read)?
