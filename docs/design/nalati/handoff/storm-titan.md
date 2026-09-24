# Handoff: B14, Jel Ata the Storm Titan

**Status (2026-09-23, Phase C): ✅ done** — B14 built (`2691bde`: three phases, checkpoints, `weather.hold`,
Naizagai + the Sky-Marked Saddle at the cairn) and its look pass (`5717952`, `stormTitanLook.ts`); both "small fixes
from B12" are in (`cb56bf5`: elites and your horse get no combat nameplate; `ride.taming` → `elites.bind`). The
"not started" state below is the history of the handoff.

**State (2026-09-23):** not started in code. The work stopped (wrap-up call) after the design read and the code survey.
**No Storm Titan code exists, and no file was changed for it.** The shard boots exactly as before. What follows is the
survey, the decisions, and the build order, so the next agent can start at step 1 without re-reading everything.

Spec: `docs/design/nalati/elites-and-bosses.md`, "The Storm Titan fight, step by step" (the full fight: phases, damage
numbers, the reward). Mockups: `art/nalati-grasslands/round-3/2-storm-titan/titan-1..5*.png` (portrait phone).
Plan row: `docs/plans/NALATI.md` B14 (it needs B7 riding, B10 weather and B13 the boss system).

## The coordinator's decisions (they win over the design doc)

- **Only during a NATURAL storm.** The design doc says tying the strip *calls* the storm. The decision is otherwise:
  the cairn prompt works only while `weather.weather.stormActive` is true. Outside a storm the prompt should say why
  (for example "The wind is quiet — come back in a storm"). During the fight set `weather.weather.hold = true`, so the
  storm cannot run out mid-fight, and clear it at victory or disarm.
- **Fought on horseback.** Riding is `src/player/Mount.ts` (`mount.mounted`, `mount(a)`, `dismount(thrown)`,
  `whistle()`, `teleport(x, z, yaw)`). Being thrown is `dismount(true)`.
- **Phase checkpoints**: already in `Boss` (a death restarts the phase you reached).
- **Reward:** the **Naizagai** storm sabre, a variant of `src/player/Sabre.ts` in the way `src/player/GoldenBow.ts` is
  over `Bow` (an `apply()` upgrade, re-applied at boot once owned), plus the **Sky-Marked Saddle** mount skin (owned only;
  B15 wears skins).
- **The start:** tie a cloth strip at the Wind Cairn, `pois.cairnTieSpot` (`src/world/nalati/index.ts:55`, a
  `THREE.Vector3 | null` set by `buildCairn`), **while mounted**. On foot the prompt reads "The wind wants a rider".
- **Dev param** `?boss=storm-titan` (optionally `&bossPhase=2|3`, `&bossGod=1`, as for the Golden King). Gate everything
  unfinished behind it.
- **Visuals in your own files.** A new render path is being ported behind `?look=v2` (`src/nalati/look/`). Do not build
  on the old painterly sky; the Titan's cloud body, lightning, rings, fire and storm wall are your own meshes and materials.

## What already exists to build on

- **`src/game/Boss.ts` + `src/ui/BossBar.ts`** (B13): the generic boss.
  - It owns the state machine (armed → intro → fight ⇄ beat → victory), the name card with HOLD TO SKIP, the wide bar
    with phase notches and the shield shimmer, and the phase captions.
  - It also owns checkpoints and the retry card, and the reward orb (a legendary `WeaponPickup` whose `grant()` runs once
    ever, persisted in `ws.boss.v1`).
  - A fight is a `BossScript`: `inArena`, `reset(phase)`, `seal`, `intro(t)` (returns the point the camera faces),
    `begin`, `enterPhase`, `update`, `hpFrac`, `shielded`, `dead`, `clampHp`, `setInvulnerable`, `victory`, `rewardPoint`
    and `respawnPoint`.
- **`src/nalati/kurganBoss.ts`**, the template to copy for the glue:
  - `GoldenKingFight` implements `BossScript`. `KurganBoss.bind(play)` builds the `BossBar`, the `Boss` and the host
    (lockInput / respawn / interactables / skipHeld / music), and the reward's `grant`.
  - It also runs the dev hook: `?boss=` puts you at the door; `devStartAt(phase)`.
  - `wireKurgan(ctx)` is the one call from `src/nalati/index.ts` (the Golden King's marked section).
  - main.ts calls `nalatiNow()?.boss.bind({...})` and routes deaths to `boss.onPlayerDeath()`.
  - A second boss follows the same shape: `src/nalati/stormTitan.ts` (`wireStormTitan`), plus its own marked section in
    `index.ts` and a bind block in main.ts. Those two files belong to the integrator, so keep each change to one small
    marked section.
- **Only one boss bar is ever up**, and while a boss bar shows no elite bar may show. `src/game/Elite.ts` (B12) has no
  "boss active" gate yet; add one (for example `elites.suppress = boss.engaged`).
- **Lightning and weather:** `src/nalati/weather.ts` exposes `w.weather` (`.stormActive`, `.onPhase(fn)`, `.onStrike(fn)`,
  `.hold`, `.force(phase)`), `w.clock`, and `w.fx` (rain etc.).
  - Its own line 250 sets `weather.hold = indoors` every frame, for the Golden King. The Titan's hold must be OR-ed with
    that, not overwritten by it. That is a one-line change in B10's file; say so, or ask the weather agent.
  - `wildEnv.wind` is the wind vector: the fire spreads downwind, and arrows drift in it.
- **FX pieces to reuse** (no new shader programs):
  - `fxMaterial(mode, color, alpha, additive)`, `FX`, `annulus()` from `src/world/nalati/KurganDungeon.ts`.
  - `GroundTell` from `src/game/Elite.ts`, a terrain-draped ring or lane. A ring does not depth-test (it reads over
    everything); a lane does. Use it for the Sky Spear's forked ring, the chain-lightning rings and the storm riders'
    Wind Charge lanes.
  - Qyran's gold beam line in `src/nalati/elites.ts` shows the "streak + edge chevron" pattern. `EliteBar.chevron()` is
    the edge-chevron cue the design reuses for riders charging from behind.
- **Storm riders (phase II adds):** B11's ghost-rider rig (`src/entities/species/ghostRider.ts` +
  `src/nalati/ghostRiders.ts`: `spawnRider({x, z, yaw, variant})`, a puppet steered through `mem.tx/tz/v/turn`) is the
  closest thing. A cloud-grey tint and ×1.6 scale would give the 8 m cloud horsemen. For the ×3 flank window, use
  `eliteDamageMul` / `setEliteDamage` (`src/entities/eliteBrain.ts`), as Qara Batyr does.
- **Hitting the heart:** the Titan stands 120–200 m out, beyond the rim, and is not an animal. Two ways:
  - (a) A hidden, floating `Animal` of a small custom species (body + head rig, `yOffset` to lift it, hp 2600) placed at
    the heart each frame. Arrows, the kill, `Progress.recordKill` and the achievement then all work unchanged. Check that
    the arrow range and the hit capsule reach it at 150 m.
  - (b) A sphere test chained into the Targets ray, like B11's `night.target` / `riders.riderTarget` in `nightEnemies.ts`.
    That still needs an `Animal` to put the damage on.
  - Recommended: (a), with the cloud body "IMMUNE" handled by the species' `damageMul`, which returns 0 unless the heart
    is open.

## Build order

1. **`src/nalati/stormTitan.ts` skeleton.**
   - `StormTitanFight implements BossScript`, with the arena a 160 m circle on the Sky Grassland's south-central rim
     (coordinates in `docs/design/nalati/geography-and-map.md`; check against `pois.cairnTieSpot`).
   - `inArena` = mounted, inside the circle, and the strip tied. `respawnPoint` = the cairn, mounted.
   - `wireStormTitan(ctx)`, with the dev hook `?boss=storm-titan`: force a storm (`weather.force('storm')`), mount the
     player on a horse near the cairn, and `arm()`.
2. **The Titan model**, a far-field set piece. Billboard or instanced cloud puffs (one material, uniform-only variants),
   a helmet cone, the white lightning eyes, the lightning heart (an additive sprite), the spear. The intro rises him from
   the waist. Keep him at ≤ 20 draw calls and ≤ 150 k triangles for the phone.
3. **Phase I, the Sky Spear.**
   - The forked ring tracks the player until 0.5 s before the strike: 40 damage and `dismount(true)`.
   - Then the spear stays stuck for 3 s, the heart is open and 25 m up, and a full draw counts ×2.5.
   - Add 2–3 whirlwinds that throw you from the saddle (15 damage).
4. **Phase II, the Three Winds.**
   - A dome over the heart (`shielded`), and three storm riders at 250 hp each. Each rider that falls takes 8 %.
   - Wind Charge lanes last 1.2 s, then the charge does 30 damage and throws you. The flank is open 2 s at ×3 for the sabre;
     arrows do ×0.5.
   - When the last rider falls, the Titan is stunned for 4 s with the heart open.
5. **Phase III, the Grass Fire.**
   - The fire spreads downwind on a coarse grid (for example 4 m cells; the burnt cells turn black and are safe), with
     flame quads (instanced) and 8 damage per second.
   - The horse panics: it drains STEED and refuses to cross a fire line (Mount needs a hook).
   - Chain-lightning rings trail your path, each landing 0.6 s after it paints. The heart is always open.
6. **Victory.** The rain curtain, the fires out, the storm wall down, `weather.hold` released.
   - The reward orb at the cairn: `NAIZAGAI · Storm Sabre of Jel Ata`, prompt `TAKE NAIZAGAI`.
   - The Sky-Marked Saddle skin is owned. Achievement row *Weather Report*, title *Partly Cloudy*, in
     `src/game/achievements.ts`'s NALATI table.
7. **`src/player/Naizagai.ts`** (a `Sabre` upgrade like `GoldenBow`).
   - Mounted at a full gallop, a slash throws a 15 m lightning crescent (40 damage, arcing to one more target within 6 m).
   - On foot, a full HEAVY charge calls a bolt within 25 m (a 0.6 s ring, then 60 damage in 3 m).
   - In a storm, +25 % damage and two arcs.
8. **Screenshots**, phone (`?touch=1&tier=phone`, 390×844) and desktop, one per mockup, as
   `progress/nalati-B14-<nn>-<slug>.jpg` (JPEG ≤ 500 KB). Plus the phone perf (≤ 150 draw calls, ≤ 2 M triangles).

## Two small fixes from B12 still open (asked for with B14)

- **Hide the combat nameplate for elites.** `src/ui/Combat.ts` assigns a nameplate + cyan bar to the nearest animals (the
  loop around line 170–192). Skip animals that are a live elite (their own `EliteBar` shows). A cheap test: an exported
  `isElite(a)` in `src/entities/eliteBrain.ts` (the WeakMap there already holds every elite's damage rule).
- **Taming for the elites.** `wireRide` (`src/nalati/ride.ts`, it returns `{ mount, taming, … }`) is only called from
  the dev harness `src/dev/nalati-ride.ts` today, not from the real game. Once the integrator wires it into
  `src/nalati/index.ts` / main.ts, replace `taming: null` in main.ts's `elites.bind({...})` with `ride.taming`. Argymaq
  then hands over to it when BROKEN. The Storm Titan needs `ride.mount` from the same wiring.

## How to test (once built)

- Real game: `http://127.0.0.1:5188/?chunk=nalati-grasslands&skipintro=1&nolock=1&perf=1&boss=storm-titan`
  (`&bossPhase=2|3`, `&bossGod=1`, `&touch=1&tier=phone` at 390×844).
- The screenshot scripts from B12/B13 are a good start (`/tmp/claude-b12/rload2.sh` + `rshot.sh`: they load the real game
  with the HMR socket blocked, wait for a `window.__…` handle, aim at a target and log fps / draw calls / triangles from
  `.ws-perf`). `/tmp` may be gone by then; the B13 / B12 commit messages describe them.
- Keep the game-browser cap (≤ 3 machine-wide) and close every session.
