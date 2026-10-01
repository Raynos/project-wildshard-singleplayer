# Plan: game normalization v2 (E127 → E357). The Wildshard engine: engine · game · kit · shard plugins

**State:** `in progress` 2026-10-01 — **~70 %.** F0–F12, **S1 Nine Dragon, S2 Pine Hollow, S3 Nalati and S4 Driftwood built** (S4.4: `main.ts` 3 lines, engine boot 51; ratchet no-shard-branch 81 → 0, no-active-chunk 80 → 0; Pine + Nalati walk/combat/colliders exact to pre-S2 20fcbf54 bar B65's 4 elite yaws; the Drowned Captain's fight replays frame-exact, B54/B57). X3 (asset slice), X4, X6, X8, X9 done; X1 input, X2 UI layers, X5 world/look (Opus), X7 tiers/budgets in flight; X3 leftovers: chunk groups (B69), CI wiring, staged steps, retry/Simulator. Next: M1 + M2 pin (B33: milestone re-baseline record, memory reading), Z1 template → Z2 docs → Z3 the two new shards (desert + whip; agent's choice) → Z4 archive. Pushed c7f3da22, gate green. Build log 13 B1–B69.

## Specs (the executable detail) and the definition of ready

This file is the index. The executable detail lives in [game-normalization/](game-normalization/):

| File | What |
|---|---|
| [00-traceability](game-normalization/00-traceability.md) | Every decision, audit finding and research row → the row / section that covers it, or why it's out |
| [01-architecture](game-normalization/01-architecture.md) | The interfaces (TypeScript) and rules: app, events, scope, services, manifest + plugin, boot, saves, input, UI, scheduler, render / tiers / budgets, physics, audio, animation, world, combat, AI, game layer, kit, lint |
| [02-foundations](game-normalization/02-foundations.md) | F0–F12 step by step |
| [03-harness-gate](game-normalization/03-harness-gate.md) | The parity harness, the GPU gate, the deploy pin, the nightly perf |
| [04-move-map](game-normalization/04-move-map.md) | Every file → its layer and destination |
| [05-nine-dragon](game-normalization/05-nine-dragon.md) · [06-pine-hollow](game-normalization/06-pine-hollow.md) · [07-nalati](game-normalization/07-nalati.md) · [08-driftwood](game-normalization/08-driftwood.md) | Each shard's migration: every gate line → its replacement, the full manifest, the plugin, the milestone |
| [09-combat-ai](game-normalization/09-combat-ai.md) | Every weapon's profile (today's values), effects, the damage pipeline, events, species, brains, bosses |
| [10-sweeps](game-normalization/10-sweeps.md) | X1–X9 |
| [11-finish](game-normalization/11-finish.md) | Z1–Z4: the template shard, docs, shard 5, the archive |
| [12-process](game-normalization/12-process.md) | The council, the lock, deploys, lanes, commits, boards, risks, estimate |
| [13-lead-resolutions](game-normalization/13-lead-resolutions.md) | The lead's answer to every question the spec writers raised, and where each is applied |
| reviews/ | The council's rounds: every finding and its response |

**Definition of ready** (Jake, E357: *"the plan is not done and ready for execution until various independent review
and auditors, including Codex, … have found no holes"*): a clean-room council of 3 seats per round (Codex GPT 6.1 Sol:
architecture + scenario battery; Claude: coverage + code audit; Claude: red-team execution battery) finds no
must-fix / should-fix **two rounds in a row**. Only then is the State `ready` and Jake asked for the go.

## 0. Read this first

Jake, E127 (2026-09-25): *"I want one implementation of a thing. I want the three shards to be built on a shared
baseline. I want the shards to be standalone things on top of the core gameplay features. I don't want 100s of if
statements. This is pure refactor and removing duplicate code and normalizing the shards to share one core game
thing."*

Jake, E357 (2026-09-30), in substance:
- The shards are generic shards bolted onto a **base, flexible game engine with interfaces**.
- Anyone can write a new shard on it, a fifth, sixth or seventh.
- A shard is **a directory that implements an interface**, like a plugin. It is "almost dynamically loaded".
- Code the shards share that isn't engine goes into **a shared library**.
- **No shard `if` in `main.ts`.** Push as much as possible into the shared baseline, and everything shard-specific
  into the shard's directory.
- *"We're touching everything related to the engine now, we may as well do it properly"*: ENGINE-FIT is redone and
  folded in, and AAA and mobile practice set the bar for long-term success.

**The finish line:** a fresh agent, given only `docs/SHARDS.md` and the template shard, builds a small, real, playable
5th shard with **zero engine edits**.

## 1. Why v1 was rewritten (the audit, short)

- **The goals were right, but one layer was missing.** v1 had core + shard. Bow and Longbow, `Boss`, the elite base,
  weather, the day clocks and the model kits are each used by 2–3 shards and aren't engine.
- **No 5th-shard test.** v1 called the job done at "`main.ts` ≤ 150 lines". A 5th shard needing no engine edits was
  never tested.
- **A second plugin concept.** v1 invented `ShardModule`, while the code had already grown lazy strategy hooks on
  `ChunkDef`. Nine Dragon uses them, and they already split its code into its own chunk.
- **The numbers doubled while it waited.**
  - Shard branches: ~240 → 269 in 70 files.
  - `main.ts`: 829 → 1,336 lines, ~140 of them shard-gated.
  - Every duplicate group grew except grass. Weather stacks (~2,200 lines) and Longbow-as-a-fork-of-Bow were missed.
- **Its process was overtaken.** The full freeze and the exact-replay golden master never started. This session now
  holds the lock, and `scorecard.mjs` is ~70 % of a parity harness.

Research behind v2 (all in [docs/design/engine-fit-v2/](../design/engine-fit-v2/)):
- [engine-fit](../design/engine-fit-v2/engine-fit.md): still no engine switch. Borrow Bevy's App / Plugin shape, own
  the parts, contain GLSL for a future WebGPU port.
- [aaa-architecture](../design/engine-fit-v2/aaa-architecture.md): Lyra's experiences = shard manifests. Also covers
  GAS-lite, cues, param rows with parents, HFSM + utility AI, input contexts, UI layers, versioned saves.
- [mobile-web-practice](../design/engine-fit-v2/mobile-web-practice.md): MW1–MW22. The web platform side is ahead;
  budgets, the GPU gate and the save schema are behind.
- [engine-internals-audit](../design/engine-fit-v2/engine-internals-audit.md): EI1–EI25.
- [combat-ai-audit](../design/engine-fit-v2/combat-ai-audit.md)
- [tooling-pipeline-audit](../design/engine-fit-v2/tooling-pipeline-audit.md): TP1–TP18.
- [budget-design](../design/engine-fit-v2/budget-design.md)
- [ci-gpu-options](../design/engine-fit-v2/ci-gpu-options.md)

## 2. The target

### 2.1 Four layers

| Layer | Folder (alias) | Holds | May import |
|---|---|---|---|
| **Engine** | `src/engine/` (`#engine`) | Generic mechanisms that know no Wildshard idea. Loop and states, events, tags, services, saves, input, UI layers, render pipeline, physics, audio, animation, combat (GAS-lite, the Weapon and Tool contracts, blocks), creature AI, boss / elite / encounter / quest / loot runtimes, weather and day-cycle mechanisms, Explore, practice and playground frameworks | three, Rapier, valibot; nothing above |
| **Game** | `src/game/` (`#game`) | Wildshard's own rules. The shard manifest type and generated registry, the title deck, the Bag, coins, loot tables, compendium, feats, travel | engine |
| **Kit** | `src/kit/` (`#kit`) | Content shared by 2+ shards. Weapon families (Melee, Bow, Crossbow, Firearm, Thrown), shared species (boar, bear), look kits (the grass trample and field, particles, the viewmodel arm rig), the rain curtain, the NPC rig, the hoverboard Tool, the starter effects | engine, game |
| **Shards** | `src/shards/<slug>/` (`#shards`) | One folder per shard. A node-safe `manifest.ts` (data the bakers, title deck and checks read) and a lazy `plugin.ts` (code). Everything only that shard uses | engine, game, kit; **never another shard** |

The layer rules:
- **Mechanism vs content.** A mechanism (rules, state, wiring) is engine. Content (a model, a look, a sound, tuning,
  one weapon or creature) is kit when 2+ shards use it, otherwise shard.
- **The rule of two.** One-shard things (riding, stealth, the Fei Zhua grapple) stay in their shard until a second
  shard wants them. A mechanism then moves to the engine, content to the kit.
- **The public API only.** Shards and the kit import `#engine` / `#game` / `#kit` index exports, never deep paths.
  The kit uses nothing a shard can't, so a shard can build anything a kit family can.
- **Extractable engine.** `src/engine/` never names a shard, the Bag, coins or any Wildshard idea. It could become its
  own package later; it isn't extracted now.
- **Enforced from day one.** A `wildshard/layer` lint rule with a ratchet file (`lint/ratchet.json`) where counts may
  only go down (F4).

### 2.2 A shard = a manifest (data) + a plugin (code)

The manifest is typed data and node-safe. It is Lyra's "experience" and today's `ChunkDef`, grown up:
- **Identity:** slug, name, `biome`, card art, `label` (today's `gridCoords` string) and `placement` (`grid`, `size`: its own
  origin and its place on the Wildshard map).
- **Look:** style, the `LookStrategy` strategy loader.
- **Mechanisms:** `uses`, the opt-in list: only the 15 mechanisms of 01 §6 (engine `weather`, `dayCycle`, `bosses`,
  `elites`, `spawns`, `quests`, `swim`, `hover`, `explore`, `practice`; game `coins`, `loot`, `compendium`, `feats`,
  `bag.pack`). Nothing is on unless listed, and each manifest lists exactly what the shard runs today (R1-02). A
  shard's own verbs (riding, stealth, the grapple) aren't mechanisms: its plugin installs them.
- **Content:** loadout, species and encounter rows, loot tables, effects, audio (ambience, score, cue map).
- **Budgets and tiers:** budget inputs per tier (§2.6), tier overrides.
- **Boot:** steps, assets (files, packs, audio, Explore, precache).
- **Ground:** a terrain spec or structures, the spawn.
- **Fight rules:** hit cap, cap-exempt kinds, attackers.
- **Input:** contexts and touch verbs.
- **Contract:** `api` version and `load: () => import('./plugin')`.

**The engine never reads a manifest (R1-01).** `#game` builds an engine-side `LevelSpec` from it (01 §5a) and calls
`app.loadLevel(spec, hooks)`. The plugin has **staged hooks** `world(ctx)`, `kit(ctx)` and `play(ctx)`, each awaited
in its boot stage with the engine's work in between (R1-24). They may only use the fixed plugin verbs (`ShardContext`,
every verb bound to the shard's scope, 01 §7, R1-25):
- add systems (id, phase, before / after, run condition);
- add events and `ask` handlers;
- add content rows;
- add input contexts;
- add HUD widgets, disc relabels, reserved verb slots, world-anchored pins (`hud.pin`) and Bag tabs;
- add registry pieces;
- add Debug rows and playgrounds;
- declare its own tier knobs (`ctx.tiers.knobs`) and put debug handles on the probe (`ctx.debug.expose`).

Everything a shard creates goes through its **scope**, which owns every texture, geometry, listener, physics body,
sound and timer. Unloading frees all of it, and the gate has a load → unload → back-to-baseline leak test. That is the
hard part of seamless travel, done ahead of time (decision 60).

**Behaviour is a subclass, tuning is data.** For example `class GoldenBow extends Bow`, `class AntlerKing extends
Boss`, while `LONGBOW` is a typed profile row with a parent. Names are dot-case typed strings (`damage.dealt`,
`creature.wolf`, `cue.hit.flesh`), and shards extend the unions.

```ts
// src/shards/pine-hollow/manifest.ts (an excerpt; the full manifest is 06 §3) — node-safe: the title deck, bakers and checks read it
export default defineShard({
  slug: 'pine-hollow', api: 1, style: 'pbr', label: '(+3, −2)', placement: { grid: [3, -2], size: [500, 500, 500] },
  uses: ['weather', 'dayCycle', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice',
         'loot', 'compendium', 'feats', 'bag.pack'],   // exactly what Pine runs today (06 §3): no coins
  loadout: { start: ['weapon.crossbow'], pickups: [{ id: 'lever', at: 'cabin-3' }] },
  species: ['creature.deer', 'creature.elk', 'kit:creature.boar', 'kit:creature.bear', 'creature.thrall'],
  audio: { ambience: 'ambience.pine', score: 'score.pine', cues: () => import('./audio/cues').then((m) => m.CUES) },
  budgets: { phone: { fps: 30 }, desktop: { fps: 60 } },   // inputs: the numbers are derived (§2.6)
  load: () => import('./plugin'),
});
```

**Loading:**
- The manifests are static, and each shard's code is **one lazy chunk**.
- Chunks stay few and big: three.js, engine + game + kit, then one per shard (Vite 8 `codeSplitting.groups`). X3
  writes that config and a build check that no shard plugin module is in the main chunk (read from Vite's manifest),
  and re-tests E188's import retry on iOS 27 in the Simulator.
- The service worker still downloads every shard's code at install, so any shard boots offline (decision 29).
- Switching shards stays a page reload for now.
- A plugin that throws while loading shows a full-screen error with the stack, reported to Sentry (decision 69).

### 2.3 The engine's systems

| System | Today | Target | Rows |
|---|---|---|---|
| **App** | `Game.ts` phases (input / fixed pre-step-post / update / late), flat lists, registration order; 32 hand-ordered calls in `main.ts` | Systems `{id, phase, before, after, when}` with a topological sort, app states with enter / exit, run conditions | EI1, EI2 |
| **Events** | 48 hand-merged `onFoo =` fields, 29 hand-chained hooks, 8 `ws:*` DOM events | A typed bus: `emit` (queued, fans out) + `ask` (synchronous veto / modify: parry, stealth bonus, hit cap) | EI20 |
| **Services + scope** | ~160 closure locals, 6 `active*()` singletons, 52 `window.__*` | Typed services on the app, a per-shard scope with resource ownership; one typed test probe `window.__wildshard` | EI17, EI18, TP4 |
| **Saves** | 36 keys by hand in 28 files, `ws.*.v1` | `SaveStore`: namespaced per shard, versioned, a migration chain from now on (**a reset now is fine**), `navigator.storage.persist()`, export / import in Settings | EI19, MW7, MW15 |
| **Input** | 179 raw listeners in 47 files, ~12 mode flags, touch USE fakes an `E` key | Actions + a context stack (on foot, swim, ride, board, grapple, menu, explore, dialog), **key rebinding**, **input buffer 120 ms + coyote 100 ms** (two numbers per shard). Touch: contexts relabel the existing discs **and** fill named reserved verb slots. No gamepad now | EI9–EI12 |
| **UI** | 42 files append to `#hud` / body, ~10 overlays with their own Escape, 24 z-index values | UI layers (hud / gameMenu / menu / modal) with push / pop / back; HUD slot bands the manifest orders; registered Bag tabs | EI13–EI16 |
| **Scheduler** | Everything far away ticks every frame | Tick-rate classes per system in **three distance bands** (decision 85): near 0–60 m brain 20 Hz + body every frame, mid 60–160 m brain 10 Hz + body every 2nd frame, far 160 m+ paused; instant interrupts in every band; an active boss / elite and quest actors never paused; strike phases on the body clock. Every brain keeps today's 10 Hz until S2.6 | MW6 |
| **Render** | 8 shard branches in `Game.ts`; Nalati's own composer; 87 `onBeforeCompile`, 112 `ShaderMaterial` | Every shard's look through `LookStrategy`, post blocks in the engine. **WebGPU contained, no switch**: the renderer type only in `engine/render`, one shader-patch registry, one precompile. Tiers as data | EI5, EI24 |
| **Physics** | Rapier 0.20; the legacy `player.colliders` bridge | **Rapier 0.21**; one collision path (the registry); `player.colliders` and `bridge.ts` retired (PHYSICS-POLISH F3) | F11, F12 |
| **Audio** | `Audio.ts` 1,597 lines; 3 ambience classes, 2 voice engines, 3 SFX routings | One mixer and positional voice engine, ambience zones, a music engine with score sources, sounds mapped from cues by each shard | D12–D14 |
| **Animation** | Per-species code | One rig loader, clip naming, an animation state machine for creatures / NPCs / viewmodels, the rig contract a species row declares (the engine half of ANIMATION-REMASTER) | X4 |
| **World** | 3 sky setups, 3 day clocks, 2 weather stacks, 6 water bodies, 4 `fog_fragment` writers in implicit order | Terrain optional (structure-first shards), a sky rig + backdrop strategy, `DayCycle` with keyframes as data, a `Weather` mechanism (its one shared FX, the rain curtain, in the kit), a `WaterBody` interface (built in S4.1 for the sea), one `WindField`, one fog-patch order | S2.4, S4.1, X5 |
| **Determinism** | 254 `Math.random`, 242 `performance.now` | A seeded RNG and a game clock, ratcheted: tests, the harness and a future netcode layer all need them | F4, F8 |
| **Boot** | 16 fixed forest-shaped steps; `manifest.ts` / `extras.ts` branch on the shard (Explore preloads only on Driftwood) | Staged load from the manifest; every shard declares its assets | EI3, EI4, TP9 |

### 2.4 Combat: GAS-lite (engine) + weapon families (kit)

- **Attributes and effects.**
  - Health and friends are attributes.
  - An effect is instant, timed or permanent, with add / multiply modifiers and stacking.
  - It ships with **every effect the game has today**: keepsake charms, the boar-tusk dodge guard, Nalati's stealth
    bonus, hit caps, Pine's finishes and bolt mods.
  - It also ships a **starter set in the kit**: poison, burn, bleed, slow, stun. Each has a cue and a HUD status
    icon, and they get tuned on the creatures board.
- **Moves are data with tags** (blocked-by, cancels).
- **One damage pipeline** for every hit:
  - Every hit carries tagged sources (`creature`, `boss`, `env.fall`, `env.lightning`).
  - The occlusion check is on by default.
  - The hit cap and the dodge guard apply to creature and boss hits, which fixes the Storm Titan, but not to falls
    or lightning.
  - Player health moves into the engine; the 5 hand-written hurt blocks in `main.ts` go.
- **Cues.** The engine names a cosmetic cue (`cue.hit.flesh`), and each shard maps it to its look and sound. That is
  how one combat core serves toon, painterly, PBR and neon.
- **The aggression director** (from `fightRules`) is engine-wide, with today's numbers: Driftwood 2, the others
  unlimited.
- **Equipment base → two contracts.**
  - **Weapon**: main hand, the swap ring and hotbar.
  - **Tool**: its own slot or the off hand, its own buttons. It runs *alongside* the weapon: the Fei Zhua while
    holding the jian, a torch in the off hand.
  - Both share the Bag entry, unlocks, saves, input actions, rig pieces, cues and HUD slots.
- **The weapon ladder:**
  1. **Profile:** a family plus data.
  2. **Extend:** `class X extends Bow`, overriding pieces.
  3. **Custom:** a new weapon from the engine's blocks (viewmodel shell, aim ray, projectiles, melee sweep, ADS,
     hit-stop, ammo, the pipeline, cues).
- **Families (kit):**
  - Melee: Sword, Sabre, Spear, the jian.
  - Bow: Bow, Longbow, Golden Bow.
  - Crossbow, with bolt mods.
  - Firearm: Rifle (the LeverRifle is a Firearm subclass in Pine's folder: only Pine uses it).
  - Thrown: javelins (3, decision 87).
- **Every weapon keeps its own behaviour** (Jake: *"why can't we have multiple bows with different behavior, that
  should be a requirement"*). Every difference today becomes profile data: zoom, flight, hit-stop, swing speed, the
  Spear's lunge. If the family can't express one, that's a bug in the family. Nothing converges.

### 2.5 Creatures and AI (engine) + species (kit / shard)

- **The engine AI runtime:**
  - **Creatures:** a hierarchical state machine (idle → alert → fight → flee) with weighted utility attack picks.
  - **Attack timing:** `StrikeSpec` data (wind-up, hit, recovery; shapes arc / lane / ring / wedge / point; Pine's
    `LaneCharge` is the seed).
  - **Bosses:** a goal stack with health-threshold phases. The Kurgan Boss, the Storm Titan, the Antler King and the
    Drowned Captain become subclasses, each fight unchanged.
  - **Elites and spawns:** one elite runtime; one weighted-table format for spawns and loot.
  - **`canReach` everywhere.** Today creatures on non-melee shards hit through walls.
- **Where species go:** boar and bear are in the kit (2+ shards). The horse stays in Nalati (its only other user, the
  horse playground, is Nalati's). Every other species stays in its shard.

### 2.6 Budgets and gates

- **Budgets are derived, not guessed** ([budget-design](../design/engine-fit-v2/budget-design.md)).
  - **Frame budget:** the phone targets 30 fps sustained *hot* (33.3 ms ÷ 1.3 = 25.6 ms), split CPU / GPU. It is
    60-ready: fps is an input to the formula.
  - **Desktop:** 60 fps on a mid gaming PC (RTX 3060 class); laptops below it get the phone tier. X7 picks the tier at
    first boot (a renderer-string table, else a 2 s GPU micro-benchmark, cached in a `device` save key) and derives the
    desktop budgets from the M5 calibration × a documented M5 : 3060 ratio.
  - **Memory:** 1.8 GB loading (justified by the phone's kill limit) and 1.0 GB in world (kept; the E271 rule).
  - **Calibration:** a scene (Debug ▸ Developer tools, and `scripts/calibrate.mjs` headless) measures unit costs on the
    M5; the phone's are the M5's × the E283 hot ratio (~10×), stated as an assumption (decision 99).
  - **The manifest holds the inputs, and every number is recomputed.**
  - **Rollout:** a shard over a provisional number keeps its worst as a ceiling that only goes down. Over budget fails
    the gate.
- **The gate** ([ci-gpu-options](../design/engine-fit-v2/ci-gpu-options.md)).
  - **Every push:** GitHub's free `macos-15` runner, one job per shard, Chromium with ANGLE Metal (it fails at once if
    the renderer isn't Metal).
  - **What it checks:** the boot fingerprint, counts against budgets, a walk (0 stuck), a swing and a shot to a kill
    and loot, a pause → resume with the state identical, poses against runner-recorded baselines, and the leak test.
    A Linux job checks that every asset URL's case matches its file (macOS disks ignore case).
  - **Nightly:** Jake's Mac posts a `gpu-perf` status from a launchd poller, never a runner: frame ms, GPU bytes, the
    full scorecard, a Simulator memory run (each shard's WebContent footprint against 1.8 / 1.0 GB, a regression
    check) and a 20-minute soak bot per shard (stuck states, errors, heap and GPU-byte growth, fps trend).
  - **The iPhone** stays the only memory and stability evidence.

### 2.7 Also in the engine and game layer (decisions 74–80, 84)

- **Strings**: every player-facing string goes through a string table, English only (engine table + one per shard).
- **Analytics**: a sink on the event bus (`death.cause`, `quest.step`, `weapon.used`, `shard.time`, `boss.attempt`)
  batched anonymously to `api/`, with a digest in the session brief.
- **Capture mode**: the engine clock runs fixed-step for trailers, board clips and the harness's poses.
- **Across shards** (`#game`): coins stay per shard; items are self-contained, with a `travels` flag (default off);
  progress, compendium and feats are per shard plus a read-only Wildshard summary on the title deck; abilities are
  per shard. X9 builds the `travels` flag, the summary and the travel type.
- **Accessibility**: none in this plan (84).

### 2.8 Doors left open (built for, not built)

- **Multiplayer:** simulation state (health, effects, AI, quest steps, saves) stays apart from visuals and input, and
  gameplay randomness goes through the seeded RNG. The `wildshard/sim-no-render` lint rule (F4) and the node-only actor
  tests (F5) enforce it. No netcode.
- **Seamless travel between shards:** resource ownership (§2.2), and each shard keeps its own origin plus its map
  position. The travel verb lives in `#game`: X9 builds its type and hand-off with today's page reload as the one
  implementation.
- **Other games:** the engine is extractable (no Wildshard words, lint-enforced).
- **Other authors:** shards come from Jake, agents, or PRs to the public repo. The API may change as long as every
  in-repo shard moves with it.

## 3. How it runs

- **The lock.** No other agent works in the repo. Each shard's folder reopens to content agents at its milestone:
  Nine Dragon first. The engine, game and kit stay locked until the plan is archived.
- **Deploys.**
  - Production is pinned to a frozen release while main moves.
  - A build reaches Jake's phone only at a **shard milestone**: the shard is a plugin, the gate is green, and Jake
    gets the summary + boards and plays it.
  - Bug fixes land on main and ship with the next milestone.
- **Lanes.**
  - The lead builds the spine in order.
  - Up to 3 short subagents take disjoint jobs: a weapon family, the audio engine, one shard's world move.
  - Each subagent works within ≤ 90 min, ≤ 400k context, ~200 turns, with a Handoff in `docs/tasks/asks/E357.md`
    (E352).
- **The refactor bar.** Every step is identical under the harness, except:
  - (a) **small differences** that must change, batched into **one before/after board per wave** (weapons, creatures,
    input / HUD, audio, look);
  - (b) **bugs found are fixed inline**, each with a test.
- **Every commit** (12 §5, R1-10 / R2-22 / R2-25): pathspec commit → the per-commit parity run on that commit's own SHA
  (`--export=<sha>`, never `HEAD`) → before every push the full run → `scripts/push-main.sh`. No `--amend` under the lock. A red result is reverted, not patched
  forward.
- **Tests.** A fake `Game` (no WebGL) lets node tests drive weapons, strike timing, effects, AI, bosses, quests and
  saves. Every public API gets a contract test, and every bug fixed gets a test. A coverage gate on `src/engine/`
  ratchets up from today's level.

## 4. Rows

Estimate: ~25–34 agent-days, ~3–5 weeks of wall clock, the council included (12-process §9). Each shard phase pulls in the engine systems it is the first to
need; the X rows collect what is left.

### F — Foundations (before the first shard)

**Order:** F0 → F3.1 (the deploy pin, first: F2's probe is the first `src/` change and would otherwise ship hourly) → F1 →
F2 → F3.2 (the gate) → F4 → F5 → **F7 before F6** (delete the dead before moving the living) → F8 → F9 → F10 → F11 →
F12. The table lists the rows in that order; the detail is in [02-foundations](game-normalization/02-foundations.md).

| Row | What | Done when | Size |
|---|---|---|---|
| **F0** | Declare the lock: an AGENTS.md note and a session-brief line. The overlapping plans' State lines point here; ENGINE-FIT is archived as folded in | Every live plan agrees on who owns what | S |
| **F3.1** | **The deploy pin** (decision 32; runs right after F0, before the first `src/` change). `.github/deploy-pin.json` + `scripts/deploy-pin.mjs`; `deploy.yml` and `ota-promote.yml` ship only the pinned release (the first pin is the build live when F3.1 lands), and the pin moves at a milestone | The hourly deploy doesn't move production or the OTA channel between milestones | S |
| **F1** | **Tooling before any move** (TP1–TP3). An alias spike: `#engine/#game/#kit/#shards` as package.json subpath imports, proven against tsc, Vite 8, vitest, oxlint, `bake-loader.mjs` and the URL-param lint. `check-paths.mjs` in `pnpm test`. Non-empty asserts on every `import.meta.glob` test | A baker and a lint key both resolve through `#engine/…`; a moved file can't make a test pass vacuously | S |
| **F2** | **Parity harness v1** (TP4, TP5, MW1). A typed probe `window.__wildshard`, plus `scripts/parity.mjs` built from scorecard, physics-baseline, nalati-boot-check, bench-load and test-facade-instancing. For 4 shards × phone / desktop it records: a boot fingerprint (systems in phase order, registry, scene census, programs, draws, triangles, audio beds, HUD slots, save keys), 3 poses, and a scripted walk + swing + shot to a kill and loot, then a pause → resume whose gameplay state must be identical (FINISH-LINE S1). Baselines come from today's HEAD. Nine Dragon joins | Green twice on unchanged HEAD; red on a planted one-line change | M |
| **F3.2** | **The GPU gate** (TP6, ci-gpu-options; runs after F2). `macos-15` jobs, one per shard, phone tier, Metal-or-fail, plus a Linux `asset-case` job (every asset URL's case matches its file), posting a `gpu-gate` status. A nightly `gpu-perf` launchd poller on Jake's Mac (desktop tier, timing, GPU bytes, the Simulator memory run, the soak bot) posts with the Mac's `gh` login | A broken shard or a wrong-case asset URL turns the status red; the soak catches a planted leak | M |
| **F4** | **Ratchets** (MW2). `wildshard/layer` (the arrows in §2.1, no shard ↔ shard, public API only), shard-name branches outside `src/shards/`, raw `localStorage`, `Math.random` / `performance.now` outside the RNG and clock, and `wildshard/sim-no-render` (simulation modules import no renderer or DOM, decision 56). Counts live in `lint/ratchet.json` and may only go down | Adding a branch or a raw save fails lint | S |
| **F5** | **Actor tests** (TP15, MW4): a fake `Game`, the first contract tests (in node: no DOM, no WebGL), the coverage ratchet on `src/engine/` | Strike timing, a sword combo and a save round-trip run in node | M |
| **F7** | **Delete the dead** (TP13, TP16; runs **before** F6), in one reviewed list: `src/dev/` and `dev/*.html` (6,553 lines in `src/dev`, incl. the nd-lab's 4,771), Nine Dragon's unimported `look/post.ts` and `world/hero/paifang.ts`, `world/spruceMask.ts`, `meleeGeo.ts`'s dead half, `chunks/_template.ts`, the 7 images under `src/explore/img/` nothing shows; `world/interact/validate.ts` is reviewed there and kept (two tests import it). Scripts (decision 88): one-offs of finished asks go, and any script not run in the last 5 days goes, unless package.json, a hook, CI, a skill or a doc references it; live ones are ported to the probe | ≥ 5,200 dead lines gone; `check-paths` green | S |
| **F6** | **The big move** (TP7–TP12), by a codemod from one mapping table (04's reviewed `move-map.json`, its only input): `git mv`, imports, globs, script strings, `targets.json`. <br>• Engine folders go to `src/engine/`. <br>• `src/game/` and `src/kit/` are created. <br>• `src/chunks/<slug>` becomes `src/shards/<slug>/` (defs → `manifest.ts`, `ChunkDef` → `ShardManifest`). <br>• `src/nalati`, `src/pinehollow` and the ~100 single-shard files in engine folders (~42k lines) go to their shard; the 5 files 2+ shards already use go to the kit (the viewmodel arm rig and `rigArms`, particles, the grass trample and field); weapon families, species and weather FX wait for their rows (04 §1.3). <br>• The composition root stays at `src/`'s root, outside the layers (01 §0): `src/main.ts`, and `src/entry.ts` → `src/entry.ts` (`index.html` loads `/src/entry.ts`). <br>• 34 tests go to `test/shards/<slug>/`, generated files to `src/engine/boot/`. <br>• `public/assets` is **not** moved (it would re-download for every player) | Every layer rule has a ratchet count; parity green; bakers bake the same bytes | L |
| **F8** | **The spine** (EI1, EI2, EI17, EI20). App systems with ordering and run conditions, app states, the typed event bus (`emit` / `ask`), typed services, the per-shard scope with resource ownership + the leak test, the seeded RNG and game clock. The one RNG deletes Nine Dragon's `util.ts` `Rng` and `world/facade/rng.ts` (RNG ×3 → 1) | Phase-list fingerprint identical; load → unload returns to baseline; one `class Rng` in `src/` | L |
| **F9** | **The shard registry** (EI8, TP8, MW20): a generated `shards.generated.ts` (manifests + lazy `load`), the `ShardManifest` type with `api` version, the full-screen error on a failed load | The title deck and the bakers read the registry; no hand-kept shard list | M |
| **F10** | **SaveStore** (EI19, MW7, MW15): one namespaced, versioned store with a migration chain and four scopes (`global`, `shard`, `device`, `session`). Today's saves are reset (Jake: fine); the 3 pre-boot keys survive (`ws.dev` a `device` key, the two resume keys `session`). A save that fails its schema is set aside, defaulted and reported, never a crash. `storage.persist()` on home-screen launch; export / import in Settings | 0 raw `localStorage` outside the store | M |
| **F11** | **Retire the old machinery**: the resident host (EI6: ShardHost's park / activate / evict, the 76 `shardSlot`s) and `player.colliders` + `src/engine/physics/bridge.ts` (PHYSICS-POLISH F3). The `addEventListener` patch stays (396 listeners rely on it for teardown). The `wildshard/no-global-listener-patch` ratchet counts it, and X1 / X2 remove it | One collision path; walk + trails 0 stuck | M |
| **F12** | **Rapier 0.21** (decisions 45, 89: +~413 KB gz on a cold load, accepted) | Walk + trails 0 stuck; nav bake `--check` green; a Simulator load reading within 1.8 GB (decision 98: no physical-iPhone reading) | S |

### S1 — Nine Dragon Stack becomes a plugin (milestone M1)

| Row | What | Size |
|---|---|---|
| S1.1 | Nine Dragon becomes a **full shard** (boot packs, prefetch, the every-shard tests; it was listed as a prototype). The manifest and plugin. The def hooks (`render`, `structures`, `sword`, `roster`, `traversal`, `fov`, `bounds`) fold in. The 5 slug gates (boot fragility → manifest boot data; `isNine`; Fei Zhua) go, and so do `Game.ts:210 / 290` (AO as tier data) | M |
| S1.2 | **The Equipment base, the Weapon contract and the Melee family** in the kit. Sword, Sabre, Spear and the jian (12 damage, a real field now) become profiles and subclasses, each keeping its feel. Fixes inline: the Spear thrust, brace and couched lance, and Naizagai's crescent all hit through walls | L |
| S1.3 | **The damage pipeline, cues and the effects core** (today's effects). Player health moves into the engine; the 5 hurt blocks go | M |
| S1.4 | **The Tool contract.** The Fei Zhua becomes a Tool, and its playground a shard-registered playground (EI22). The first input context (grapple), with touch relabel | M |
| S1.5 | **Nine Dragon's own audio** (decisions 44, 71). It builds the first slice of the engine audio (score sources, ambience beds, cue maps), which S3.5 continues: its ambience and score (MiniMax Music 3), its SFX (MOSS + Stable Audio 3, the better take), a cue map. A listening page for Jake | M |
| S1.6 | **The budget calibration scene**, and Nine Dragon's budgets from the formula | M |
| **M1** | Gate green. Jake gets the summary, the **weapons board** (the wall fixes, any spot a profile couldn't match) and the audio page, then plays it. Nine Dragon's folder reopens; NINE-DRAGON-STACK is re-planned for the new engine (decision 66) | — |

### S2 — Pine Hollow (M2)

| Row | What | Size |
|---|---|---|
| S2.1 | The manifest and plugin. The 7 `install*` calls, `fieldModels`, streams, the hamlet, landmarks and Sets move into the plugin. The Pine tier override (`PINE_HOLLOW_PHONE`, deleted here) and the `pine-hollow` gates go | M |
| S2.2 | **The ranged families** in the kit, each weapon keeping its feel: Bow (Bow, Longbow as a profile), Crossbow (+ bolt mods), Firearm (Rifle; Pine's LeverRifle a subclass in Pine's folder). Projectiles, DropArc, ADS and brass become engine blocks | L |
| S2.3 | **The AI runtime**: HFSM + StrikeSpec + the aggression director, the boss runtime (Antler King), one elite runtime (Pine's and Nalati's bases merged), night thralls, the weighted spawn and loot tables. The **AI debug overlay** (Debug ▸ Developer tools: per-creature HFSM state, utility scores, tick band, pinned flag). `BOSS_NAMES` becomes a content registry fed by boss rows, and `TargetHit` moves to the engine combat types (EI23). Fix inline: `canReach` everywhere (Pine's boar, bear, elites and bosses stop hitting through walls) | L |
| S2.4 | **Weather and the day cycle** as engine mechanisms: three clocks → `DayCycle` + keyframes, two weather stacks → `Weather` + the rain curtain in the kit (puddles stay per shard, lightning is Nalati's). Driftwood's and Nalati's clocks and Nalati's storm move onto it here too (one implementation, parity identical on all three) | L |
| S2.5 | **The quest runtime** (Pine's quest on `quest/core`), the **starter effects** in the kit, and `#kit/npc` seeded from Pine's `npcRig` | M |
| S2.6 | **The tick-rate scheduler** with decision 85's three bands (20 Hz / 10 Hz / paused), interrupts, pinned bosses / elites / quest actors and strikes on the body clock. Every shard's creatures switch here, Driftwood's far boars and bears included | M |
| **M2** | Gate green; summary; the **creatures board** (walls fixed, tick rates, starter effects); Jake plays. Pine Hollow reopens | — |

### S3 — Nalati Grasslands (M3)

| Row | What | Size |
|---|---|---|
| S3.1 | The manifest and plugin. `wireNalati` and the 18 `nalatiNow()` binds become plugin verbs and events | M |
| S3.2 | **The painterly look** as a `LookStrategy`: its fog and composer leave `Game.ts`, and `Terrain` and `Grass` lose their style branches | M |
| S3.3 | **The Nalati kit on the families** (Golden Bow, Naizagai, Sabre). **Riding** (the ride context, taming, reins) and **stealth** (the crouch action) stay shard mechanisms; the horse stays a Nalati species; the camp people join `#kit/npc` | M |
| S3.4 | **Bosses and elites on the runtime**: the Kurgan Boss, the Storm Titan (hit-cap fix), ghost riders, balbals | M |
| S3.5 | **The engine audio** (D12–D14), continuing the slice S1.5 built (score sources, ambience beds, cue maps): one positional voice engine, ambience zones, the merged SFX routing, the `Audio.ts` split. Steppe audio moves onto it, and so do Pine's and Nine Dragon's (one implementation, parity identical); Driftwood's island audio is parked in `legacyIsland.ts` until S4.3 | L |
| **M3** | Gate green; summary; the board; Jake plays. Nalati reopens | — |

### S4 — Driftwood Isle (M4)

| Row | What | Size |
|---|---|---|
| S4.1 | The manifest and plugin. The ~15 `isOcean ?` builders become the shard's world build; BlenderIsland, the iron-sword pickup. The `WaterBody` interface is built here for the sea (X5 converts the other bodies) | L |
| S4.2 | Enemies (crab, monkey, sailor) on the AI runtime; the **Drowned Captain on the boss runtime**, his fight unchanged, on the shared BossBar (decision 91, look board). The big crab hits for 14 (decision 86) | M |
| S4.3 | Adventure, keepsakes, first minutes, the shrine hum, the island SFX and ambience; the toon look as a `LookStrategy`. The Castaway and the Trader join `#kit/npc`; the `legacyIsland.ts` park is deleted | M |
| S4.4 | **`main.ts` → the composition root (≤ 20 lines, beside `src/entry.ts`) + `engine/boot.ts` (≤ 150 lines)** (EI7, 01 §0). 0 shard branches in engine / game / kit (the ratchet reaches 0) | M |
| **M4** | Gate green; summary; the board; Jake plays. Driftwood reopens | — |

### X — Sweeps (any a shard phase didn't already pull in)

| Row | What | Size |
|---|---|---|
| X1 | **Input**: every action and context, key rebinding, buffer + coyote, TouchControls drawn from the merged context stack (contexts are additive, R1-29), reserved verb slots (EI9–EI12). The hoverboard moves to `#kit/tools/` as a Tool. With X2 it moves the last listeners onto scopes, so the `addEventListener` patch is deleted. The **input / HUD board** (a late roof jump, a dodge pressed mid-swing, the verb slots) | L |
| X2 | **UI layers**, HUD slot bands and registered Bag tabs (EI13–EI16) | M |
| X3 | **Boot and assets from the manifest** (EI3, EI4, TP9, MW13, MW17): staged steps, per-shard asset lists (fixes Explore's offline preload on 3 shards), DEPLOYMENT_ASSET_TRIM T3 and the unused-assets KTX2 fix (TP17). **The chunk layout** (decision 2, EF10): Vite 8 `codeSplitting.groups` (three · engine + game + kit · one chunk per shard), a build check in the pre-push gate that no `src/shards/**` plugin module is in the main chunk (read from Vite's manifest), the shard chunk through E188's `retried()`, and an E188 import-retry re-test on iOS 27 in the Simulator (sim-lane). Nine Dragon already joined the boot packs in S1.1 | M |
| X4 | **The animation engine layer**: rig loader, clip naming, the animation state machine, the rig contract | M |
| X5 | **World and look leftovers**: <br>• the sky rig + backdrop (delete the painterly sky and cloud dome built then hidden on 2 shards); <br>• the fog-patch registry; <br>• the other water bodies onto the `WaterBody` interface S4.1 built; <br>• one geometry kit and one AO baker; <br>• one LUT loader; <br>• one particle pool (7 → 1); <br>• one RNG (3 → 1); <br>• helpers (`lin` ×6, smoothstep ×15, pan-from-yaw ×8, loop-at-offset ×5); <br>• one skin locker (3 → 1) | L |
| X6 | **WebGPU containment**: the renderer type only in `engine/render`; the 87 `onBeforeCompile` sites through one shader-patch registry; one precompile | M |
| X7 | **Tiers as data and budgets per manifest** (EI24, EI25). It deletes any shard-named knob S2.1 left. **Tier selection** (decision 36): the desktop tier only for a GPU at or above RTX 3060 class (a renderer-string table, else a 2 s GPU micro-benchmark at first boot, cached as a `device` save key); below it, the phone tier. Desktop budgets = the M5 calibration × a documented M5 : 3060 ratio, re-derived if a 3060-class reading is ever taken | M |
| X8 | **Session health** (MW10): how the last session ended, context losses, fps per shard → a crash-free-session rate per build in the session brief. Analytics, capture, strings. **Flag hygiene** (MW16): every Debug row gets an ask id and a review-by date, a test lists the overdue rows (the session brief prints them), and a count ratchet caps the rows | S |
| X9 | **The game-layer extras** (decisions 59, 75, 76): the `travels` flag on item rows (default off); the read-only Wildshard summary on the title deck, built from the per-shard saves (a `global` key; its look on the Look board); the travel type (`TravelRequest` / `TravelHandoff`) with the page reload as its one implementation, replacing `requestShard`. With tests | M |

### Z — The finish line

| Row | What | Done when |
|---|---|---|
| Z1 | **The template shard** `src/shards/_template/`, hidden in Debug. It uses every plugin verb: flat ground, sky, spawn, a prop, a kit weapon and a custom weapon, a tool, a creature, a quest step, a HUD widget, an input context, budgets | It boots in the gate on every push |
| Z2 | **Docs**: `docs/ENGINE.md` (the public API: every contract, block, event, tag, cue, action, layer and service, with an example), a `docs/SHARDS.md` rewrite (how to write a shard), a README per shard | A reader can answer "how do I add X" from them |
| Z3 | **Shard 5 by a fresh agent** from `docs/SHARDS.md` + the template alone: its own look, a custom weapon, a creature, a quest step. Every engine edit it needed becomes a public-API fix before the plan closes | Zero engine edits on the final run |
| Z4 | The per-push gate stays (FINISH-LINE S1). The plan is archived with its leftovers as asks | — |

## 5. The boards (one per wave, iPhone portrait, clips for motion and sound)

| Wave | When | What's on it |
|---|---|---|
| Weapons | M1 (+ M2 ranged) | The wall fixes (Spear, Naizagai), any spot where a family couldn't match a weapon's old behaviour |
| Creatures | M2 / M3 | `canReach` (Pine charges stop going through walls), the Storm Titan's hit cap, the three tick bands (decision 85) at M2, the starter effects tuned; at M4 the big crab at 14 and the crab / monkey / sailor bands |
| Input / HUD | X1 | Buffer + coyote (before / after clips), the reserved verb slots, the rebinding screen |
| Audio | M1 | Nine Dragon's ambience, score and SFX (a listening page) |
| Look | M4, X9 (+ any) | The Drowned Captain on the shared BossBar (decision 91, S4.2); the title deck's Wildshard summary strip, A / B (X9, decision 76); otherwise only a pose that differs beyond noise (nothing else is expected to) |

## 6. Done when

- **Structure:** four layers with the lint ratchet at 0: no shard names, no upward imports, no shard ↔ shard imports,
  no deep imports.
- **Wiring:** the composition root is `src/entry.ts` + `src/main.ts` (≤ 20 lines), `engine/boot.ts` ≤ 150 lines, and every shard is a manifest + plugin.
- **Duplicates:** every group in the audit has one implementation.
- **Weapons:** every weapon keeps its own behaviour.
- **Gate:** green on `macos-15` for the 4 shards + the template, including the leak test and the budgets.
- **The finish line:** Z3's shard 5 built with zero engine edits.
- **Docs:** `docs/ENGINE.md`, `docs/SHARDS.md` and the READMEs are current.

## 7. Found along the way (fixed inline, each with a test)

1. The Spear's thrust, brace and couched lance, and Naizagai's crescent, hit through walls (no occlusion check).
2. `canReach` runs only on melee shards, so Pine Hollow's boar and bear charges, both elite sets and all four bosses
   hit through walls.
3. The Storm Titan, lightning, ride and fall damage skip the hit cap and the dodge guard. After the fix, creatures and
   bosses obey both; falls and lightning are exempt by tag.
4. `boot/extras.ts` preloads Explore only when `def.ocean`, so Nalati, Pine Hollow and Nine Dragon miss it offline.
5. `ChunkDef.weapon: 'nalati'` is ignored; `main.ts` picks the kit by slug.
6. `ws.elites.v1` is one global store, shared by Nalati and Pine Hollow.
7. `Game.ts:290` decides Nine Dragon's AO on phone (core deciding for a shard).

## 8. Folded in and pointed elsewhere

- **ENGINE-FIT:** folded in and archived. Its E1–E3 were built earlier (PHYSICS). E4 input actions = X1 / F8. E5 shard
  modules = this plan. Its libraries were re-judged in [engine-fit](../design/engine-fit-v2/engine-fit.md).
- **FINISH-LINE:** S1 (the gate) = F2 / F3 / Z4; its pause-and-resume joins the harness's scripted run (pause →
  resume → state identical, 03 §5.6), and its desktop tier runs in the nightly on Jake's Mac (13-lead-resolutions
  02/03#7). S3 = this plan. S5 = X1. S6 (tests where the bugs are) = F5. S7 (budgets that run) = S1.6 / X7; its
  committed `latest.md` table is **replaced** by the gate's budget report artifact (`report.md` per shard, 03 §2.5,
  §15) and the nightly `gpu-perf` report (03 §14), not kept as a committed file. FINISH-LINE stays live for its other
  rows.
- **PHYSICS-POLISH:** F3 = F11. F7 goes with `src/dev`. F1, F2, F4, F5 and F6 stay there.
- **ANIMATION-REMASTER:** the engine layer = X4. The art (A3–A7) stays there and builds on the rig contract afterwards.
- **DEPLOYMENT_ASSET_TRIM:** T3 = X3. T2, T4 and T5 stay there.
- **NINE-DRAGON-STACK:** paused until M1, then re-planned for the new engine.
- **After this plan** (not in it; each becomes an ask at Z4, 13-lead-resolutions G13 / G14):
  - auto-rollback (MW21), the heat governor (MW8), gamepad, a per-shard `public/assets/` re-layout (TP18);
  - **MW12:** KTX2 on the phone for Nine Dragon (closing E248's image fallback, which this plan keeps as
    `tiers.phone.textures: 'img'`); it needs physical-iPhone evidence (AGENTS.md's E271 rule);
  - **MW22:** record / replay of input over the seeded RNG and the fixed step (the door F8 opens: seeded streams,
    capture mode);
  - from engine-fit: navcat's **crowd** module for herds and thralls (EF6); **pooled projectiles and a far crowd**
    as structure-of-arrays pools (EF3; X5 builds only the one `ParticlePool`); a kit **worker pool** for procedural
    generation (EF9: Pine's 150 ms long task); yuka-style **steering** behaviours (EF7);
  - the "borrow later" libraries: **three-mesh-bvh** for Explore's picking and tools (gameplay collision stays
    Rapier) and the **Needle Inspector** for dev (engine-fit §3).
- **Out, with the reason:** **MW14** (measure the Rapier wasm high-water across shard switches) is moot: switching is a
  page reload (decision 21), so the wasm heap never outlives its shard.

## 9. Jake's decisions (E357, 2026-09-30)

The verbatim table (decisions 1–100 and the revisions 12′, 28′, 55′, 90′) is in [docs/tasks/asks/E357.md](../tasks/asks/E357.md). In short:

| Area | Decisions |
|---|---|
| **Layers** | `src/engine/` + `src/game/` + `src/kit/` + `src/shards/<slug>/`. Mechanism vs content; the rule of two. The public API only. The engine is extractable, not extracted |
| **Shards** | Data first, code where needed (manifest + plugin verbs). Lazy per shard. Mechanisms are opt-in via `uses`. Own origin + map position. Every resource is owned by the shard's scope. Switching stays a page reload; the resident host is retired |
| **Combat** | Melee and ranged are engine. GAS-lite. The ladder: profile → extend (subclass) → custom. Families in the kit. **Every weapon keeps its own behaviour.** A Tool contract beside Weapon. One pipeline with tagged sources. The director at today's numbers. The jian keeps 12; the big crab hits for 14 (86); javelins stay 3 (87). The Drowned Captain gets the shared BossBar (91). Today's effects + a starter set |
| **AI** | HFSM + utility + boss phases. Species by the rule of two |
| **Engine** | Typed TS rows with parents. Subclasses for behaviour. Dot-case typed names. Three AI tick bands (85; 10 Hz until S2.6). WebGPU contained, no switch. Rapier 0.21 (+413 KB accepted, 89). One versioned save store (a reset now is fine). Context stack + key rebinding + buffer / coyote; touch relabel + reserved verb slots; no gamepad now |
| **Quality** | Small differences may merge (a board per wave); found bugs fixed inline. A fake Game + contract tests + a coverage ratchet. A full-screen error on a failed load. Budgets derived, over budget fails. 30 fps hot phone, 60-ready. Min desktop: a mid gaming PC. 1.0 GB in-world kept. Gate on free GitHub `macos-15`, nightly perf on Jake's Mac |
| **Process** | Foundations, then Nine Dragon → Pine Hollow → Nalati → Driftwood. Lead + short subagents. Deploys at shard milestones only; bug fixes ship at milestones. The lock: each shard reopens at its milestone. Summary + boards + play at each milestone |
| **Game layer** | Coins per shard. Items self-contained, travel-ready. Progress per shard + a Wildshard summary. Abilities per shard. String tables (English). Analytics from the event bus. Capture mode. No accessibility features in this plan |
| **Council** | Not `ready` until 3 clean-room seats (Codex GPT 6.1 Sol + 2 Claude) find nothing two rounds in a row. Jake sees only the decisions that need him |
| **Scope** | ENGINE-FIT folded in. Nine Dragon's own audio. Save safety + session health. Input actions. Delete dead + dev copies. Scripts: one-offs of finished asks and anything not run in 5 days go, unless referenced (88). The permanent gate. The template shard + docs + shard 5 by a fresh agent. Doors kept open for multiplayer and seamless travel |
