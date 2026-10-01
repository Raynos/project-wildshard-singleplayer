# GAME-NORMALIZATION v2 · 11 — The finish line (Z1–Z4)

## Z1 — The template shard `src/shards/_template/` (decisions 43, 72)

**Purpose.** It proves every plugin verb works with zero engine knowledge of the shard. It is the teaching example
`docs/SHARDS.md` walks through, and it is booted by the gate on every push. The gate runs it as a fifth job next to
the four real shards. It is **hidden**: `status: 'hidden'`, shown only through Debug ▸ Developer tools ▸ "Template
shard".

**Look:** grey-box (72): flat-shaded ground and primitives, a plain gradient sky, no LUT.

**Contents: one of everything**

| Plugin verb / manifest field | The template's use |
|---|---|
| `ground.terrain` | a 200 × 200 m gently rolling heightfield (one noise octave) with one trail |
| `sky` / `atmosphere` / `grade` | a plain gradient sky, linear fog, neutral grade |
| `render` | a minimal `LookStrategy` (`mode: 'extend'`) that only passes the engine chain through (the "nothing custom" case) |
| `uses` | **all 15 mechanisms** (01 §6, decision 54, R1-02), so each one is exercised: engine `weather`, `dayCycle`, `bosses`, `elites`, `spawns`, `quests`, `swim`, `hover`, `explore`, `practice`; game `coins`, `loot`, `compendium`, `feats`, `bag.pack` |
| `ctx.piece` | one grey-box hut (a box collider + a door interactable) and one ramp with stair treads (the physics rules) |
| `loadout` + `rows` | a kit weapon (the iron-sword profile from `#kit/weapons`), plus a **custom weapon**: `class TemplateWhip extends Weapon`, built from `blocks.viewmodel` + `blocks.melee` with a `lane` sweep |
| a Tool | `class TemplateLantern extends Tool` in the off hand, with its own action `toggle` in `verb.1` |
| `species` + a brain | the kit boar (a kit species), plus one template-only creature `greyBlob` with a two-strike `StrikeSpec` and a `CreatureBrain` subclass |
| an encounter | one elite (a named boar) and one mini-boss `BossBrain` with two HP phases |
| effects | the kit's `effect.poison` on the whip's heavy |
| a quest step | "Reach the hut" → "Beat the blob" → a reward row (a coin burst into the per-shard purse) |
| `inputContext` | `template.lantern` (the lantern's toggle) |
| `hud` | one widget in a band (a lantern-oil meter), one relabel, and one world pin (`hud.pin`: a marker over the hut door, 01 §11) |
| `tiers.knobs` | one shard tier knob, `template.propCount` (phone 10, desktop 20), read by the grey-box prop scatter (01 §7) |
| `debug.expose` | the template runtime as `window.__wildshard.shard.template` (01 §7) |
| `bag` | one tab ("NOTES") with one fragment |
| `debugRow` | one row in Developer tools |
| `playground` | one playground: a 3-pad jump course |
| `strings` | a string table for every player-facing line |
| audio | the forest ambience from the kit and a silent score; the cue map points every cue at kit sounds |
| budgets | inputs for phone 30 and desktop 60 |
| `assets` | none: no ground sets, no KTX2 table (a shard with none boots without it, R3-08), no `assetGlobs` (R3-09) |
| saves | one shard-scoped key (`template.notes`) |

**Tests**
- The contract test boots it headless in node (the fake Game) through every stage.
- The gate job boots it on `macos-15`, walks to the hut, kills the blob, and runs the leak test.

**Done when**
- The gate's template job is green on every push.
- `wildshard/layer` shows the template imports only the `#engine` / `#game` / `#kit` indexes.

## Z2 — Docs (decision 50)

| Doc | Contents | Owner check |
|---|---|---|
| `docs/ENGINE.md` | The public API of `#engine`, `#game` and `#kit`: every contract, block, event, ask, tag, cue, action, context, UI layer, service, save key rule, lint rule and plugin verb, each with one short example. Layout: one section per 01-architecture § | A node test lists every export of the three index files and fails if `docs/ENGINE.md` doesn't mention it (no drift) |
| `docs/SHARDS.md` (rewrite) | **How to write a shard.** Copy `_template` → fill the manifest → the plugin verbs → the weapon ladder (profile, extend, custom) and Tools → creatures (species rows, brains, strikes) → the look (`LookStrategy`) → audio (cues, ambience, score) → budgets and tiers → saves → strings → the checklist to go from template to playable to `live` (the gate, boards, `status` flags). It replaces today's `docs/SHARDS.md` (227 lines). The history section is kept at the end | Z3 is the test: a fresh agent follows it |
| `src/shards/<slug>/README.md` ×4 (+ template) | What the shard declares; its custom code and why it's custom; its budgets; its look; its open asks | Written at each shard's milestone (M1–M4) |

AGENTS.md: the "No URL switches" section's Settings.ts steps are rewritten (a shard declares its own option keys
and rows through `ctx.debugRow`, so no shard name lands in `src/ui/Settings.ts`; 13-lead-resolutions 05/06#12). The "Physics" and "Local models"
sections are updated for the new paths (`src/engine/physics/`,
`#engine/...`), and a short "Engine layers" section links `docs/ENGINE.md`.

## Z3 — Shard 5, built by a fresh agent (decisions 51, 73)

**Protocol**
0. **Before the agent starts, the lead** (R2-12) files the run's ask (`scripts/ask-new.sh`, giving `<id>`), picks the
   new shard's slug (a folder id; the shard's display `name` comes from Jake's pick in step 2), and commits the slug
   into `.github/lock.json` `reopened` with the **default asset globs for a new shard** (R3-06), in its own commit
   carrying the lead's `E357-Lead: yes` trailer:
   `public/assets/<new-slug>/**`, `public/assets/gpu/<new-slug>/**`, `public/assets/baked/<new-slug>/**`,
   `public/assets/music/<new-slug>/**`, `public/assets/sfx/<new-slug>/**`, `public/assets/horizon/<new-slug>/**`,
   `public/assets/title/<new-slug>/**`.
   No manifest exists yet, so the list is this fixed default, not a copy; the agent's manifest declares the same
   folders as its `assetGlobs` (R3-09), and a folder outside them is an API gap (step 4). That commit is the only
   `.github` edit Z3 needs, and the agent never makes it.
1. **A fresh general-purpose subagent** (clean room: never saw this plan's conversation) gets a brief with only:
   - "build a small real 5th shard";
   - its slug `<new-slug>` and its ask file `docs/tasks/asks/<id>.md`;
   - `docs/SHARDS.md`;
   - the template;
   - `docs/ENGINE.md`;
   - the AGENTS.md rules.
   The E352 caps apply. **It does not carry the `E357-Lead: yes` trailer** (12 §4 item 10 excepts it; R2-12), so the
   `commit-msg` lock check holds every one of its commits to the reopened-shard allowlist for `<new-slug>`: the one
   definition in 02 F0 step 5 (R1-09, R2-19), referenced here and not copied. It covers the shard's code, tests,
   baselines, art, asset folders and bakes, its Blender scripts, the hunks naming the slug in the four line-scoped
   files (R2-F2), and `docs/tasks/asks/**`. The check refuses any other path.
   - It commits no generated file, **except its own `src/shards/<new-slug>/ktx2.generated.ts`** (R2-04, R3-06), which
     needs `basisu` and is committed by its lane once it bakes KTX2 art; a shard without one boots without it (R3-08).
     `shards.generated.ts` is built at build and test time.
   - Its gate job and baselines appear by themselves: the matrix is derived from the registry, and a shard with no
     baselines gets a bootstrap record on its first gate run.
   - **"Zero engine edits" means no change under `src/engine`, `src/game`, `src/kit`, `lint`, `.github` or `scripts`,
     and no generated file**, with exactly these exceptions (R3-06; 02 F0's allowlist gives the slug each of them):
     - its own `scripts/blender/<new-slug>/`;
     - the hunks naming the slug in the four line-scoped files (R2-F2): `scripts/blender/targets.json`,
       `art/README.md`, `scripts/bake-ktx2.list.json` and `scripts/bake-ktx2.cache.json`;
     - its own `src/shards/<new-slug>/ktx2.generated.ts`.
2. **Pick.** The agent first proposes **3 small shard ideas as portrait mockups**: biome, look, custom weapon,
   creature. It uses `scripts/mockup-local.sh`, or codex `image_gen` for the finals, and saves them to
   `art/<new-slug>/round-1-proposals/` (inside its allowlist; R2-12). Jake picks one through AskUserQuestion (73).
3. **Build.** The agent builds the pick:
   - its own look (`LookStrategy`);
   - at least one custom weapon (rung 2 or 3 of the ladder);
   - one creature with its own brain;
   - one quest step;
   - budgets, strings, a README.
   It ships as `status: 'experimental'`.
4. **Engine edits.** Every time the agent needs something outside its folder, it **stops and files an "API gap"** in
   its ask file (`docs/tasks/asks/<id>.md`, inside its allowlist; R2-12) instead of editing. The lead copies each gap
   into the council's `docs/plans/game-normalization/reviews/shard5-gaps.md` (a lead commit) and fixes it in the
   public API (with a test and an `ENGINE.md` entry). Then a **new** fresh agent restarts the shard from the updated
   docs, under the same slug and ask.
5. **Done** when a run finishes with **zero engine edits and zero gaps**, the gate is green (the shard's own job
   added), and Jake plays it.

## Z4 — The permanent gate and archiving

- **The per-push gate stays** (FINISH-LINE S1, decision 7). It covers:
  - the `macos-15` jobs for every shard + the template;
  - the node checks (layers, ratchets, contract tests, the asset audit, gen-shards `--check`, coverage);
  - the nightly `gpu-perf` from Jake's Mac.
  AGENTS.md gets a "Before you push" line for it.
- **The ratchets stay.** They sit at 0 for every rule that reached 0, and any rise fails lint forever.
- **The plan is archived** to `project/archive/<date>-game-normalization.md` in the commit that finishes it:
  - its State line reads `archived (finished <date>)`;
  - every leftover (for example gamepad, auto-rollback, the heat governor, TP18's per-shard `public/assets`,
    ANIMATION-REMASTER A3–A7, NINE-DRAGON-STACK's re-plan) is an **open ask**, listed in the archived plan;
  - links to the plan are fixed.
