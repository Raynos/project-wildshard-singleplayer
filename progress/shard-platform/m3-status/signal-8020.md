# Signal Dunes toward 80/20: inventory and move list (SF72, lane sf72-signal-sdk, 2026-10-08)

Measured with `node scripts/shard-platform.mjs` (per-file classification copied from its `classify`).

**At the start (HEAD `d5f6e9ec7`):** public 42 / custom 4359 (0.95 %), runtime + trusted 927 / 965. Proofs: headless,
replay, ledger and compatible true; boot false, gridReady false, transitional true.

80 % means custom ≤ public / 4. The shard's 4401 code lines are about 3,500 view code (world, look, models, the whip's
mesh) and about 900 behaviour. **No runtime move gets there.** The share only moves when the view code goes into
`generators/` as a real offline bake (the classifier lets a generator import anything because it never runs in the
client), and the behaviour becomes declared rows that SDK systems run.

**After this lane's slices:** public 185 / custom 4117 (4.3 %), runtime + trusted 832 / 965; proofs unchanged
(the witness re-runs byte-identical to `test/proof/sunscar-dunes/compatibility.json`).

| Slice | Commit | public / custom | share | runtime + trusted |
|---|---|---|---|---|
| start | `d5f6e9ec7` | 42 / 4359 | 0.95 % | 927 / 965 |
| home keeper → `@wildshard/game/shardfile/homeKeeper` | `4dca8153a` | 42 / 4281 | 0.97 % | 849 / 965 |
| layout / strings / brazierFlag → public folders; boss row → `@wildshard/game/shardfile/bossRow` | this commit | 185 / 4117 | 4.3 % | 832 / 965 |

## How the classifier reads Signal

- A file is **public** only if it sits in `data/`, `behaviour/`, `quests/`, `generators/` or is `shard.config.ts`, AND
  everything it imports is a published `@wildshard/sdk/*` export (not `sdk/runtime`) or another public shard file.
  A generator root is public whatever it imports.
- Today even `data/spawns.ts`, `data/items.ts`, `data/flags.ts` and `quests/signal.ts` are **custom**, because they
  import `../layout` and `../strings` (root files, not in a public folder), and `quests/signal.ts` imports
  `quest/brazierFlag.ts`. `shard.config.ts` is custom through `budgets.ts` → `@wildshard/engine/level/spec`
  (a type import; the template's `shard.config.ts` is custom for the same reason).
- `runtime/` lines count against the 965 ceiling whatever they import.

## Inventory (custom lines, what each is, where it can go)

| Group | Lines | What it is | Where it goes |
|---|---:|---|---|
| `world/` dressing 297, places 294, meshes 254, build 124, tower 117, buttes 104, dunes 83, rocks 46, resources 10 | 1,329 | code-built meshes: caravan, well, braziers, tower, buttes, rocks, dressing; the dune height field | **generators/**: bake to shardfile props / GLB + colliders (SF67 fix 3 "bake the code-built worlds" wants the same). `dunes.ts` is already half there (`generators/tiles.ts` bakes the terrain from it) |
| `world/fireFx.ts` 270, `world/stormFx.ts` 41 | 311 | runtime fire / smoke / ember shaders, the storm shell | **missing SDK system**: a generic fire / particle effect row (`@wildshard/sdk/runtime/effects` is trusted; needs a public effect row). Until then trusted |
| `look/` render 213, sky 89, families 77, groundTiles 57, minimap 43, cube 25, painted 23, light 21, dusk 14, far 12 | 574 | the look strategy, painted sky, dusk light curve, sand families, minimap palette | `minimap`, `far`, `dusk` numbers, `families` tables → `data/` look rows (template: `data/look.ts` + `generators/farLook.ts`). `render`/`sky` shaders: **missing SDK look-family rows** for a painted-sky + dusk-key shard; the shader code stays trusted until the SDK carries it |
| `species/` strider 74, duneRay 55, skitterer 48, manta 31, matriarch 22, skin 21; `models/gear.ts` 37 | 288 | creature rigs as code geometry, the Hunyuan models' register | **generators/**: bake each rig to a GLB (`@wildshard/sdk/bake/glb`), the look rows become data |
| `weapons/` whipModel 184, Bullwhip 151, lash 40, rows 11 | 386 | the whip's view model (cord sim), the browser weapon, the shared lash contact rule, the HUD row | lash rule → **generic SDK lash contact** (item row `shape: lash`); Bullwhip's crack / second lash / pull / stagger → a generic **whip item runtime** on `ItemRuntime`; whipModel → generators (baked GLB) + a generic cord viewmodel |
| `runtime/` homes 113, species 192, headless 78, quest 58, whip 54, interactions 49, matriarch 47, homeBrains 41, entries 36, brains 30, persistence 13, cues 18, index 2 | 731 | the trusted headless runtime and the shared species numbers | homes → **done** (platform keeper, below); species numbers → `data/`; quest + interactions → declared quest + interaction rows; matriarch → **generic boss-row runner** over `BossBrain`; whip → generic whip item; entries → the SDK entry proof (generic already, Signal's copy goes) |
| `combat/` matriarch 85, matriarchFight 75, creatures 11 | 171 | the browser boss view, the view-free fight script, the browser keeper binding | the fight script stays shard behaviour (the storm is Signal's) but its BossBrain wiring and flag record go generic |
| `quest/` install 70, scout 52, brazierFlag 2 | 124 | the browser quest install, Sefa the NPC, a flag helper | brazierFlag → `data/flags.ts`; install → declared quest + interaction rows; scout → an NPC row + baked model |
| top level: plugin 132, manifest 64, strings 42, layout 37, budgetCeilings 28, budgets 14, roster 7 | 324 | browser plugin, manifest, text, the world's coordinates, budgets | **strings + layout → `data/`** (pure data, no imports: this also turns spawns / items / flags / quests public); plugin shrinks as the rows above land; manifest / budgets stay custom (as the template's) |
| `boot/` 35, `data/` custom 31, `quests/` 31, `explore/` 5, `thumbs/` 4 | 106 | boot file list, data and the quest rows made custom by their imports | public once `layout` / `strings` are in `data/` |

## Ordered move list (line budget each frees)

1. **Home keeper → `@wildshard/game/shardfile/homeKeeper`** (done, `4dca8153a`): runtime −78, custom −78. Driftwood, Sky
   Reach and Pine can adopt it (rows, specs, scale ranges, a policy factory).
2. **`layout.ts`, `strings.ts` → `data/`; `quest/brazierFlag` → `quests/`** (done; `look/map.json` names
   `data/layout.ts` as a map input, map and physics bakes re-run from the candidate build): public +143 (layout 37, strings 42, spawns 14, items 13, flags 4+2, quests 31, cues/brains
   already public), share ≈ 1 % → ≈ 5 %.
3. **Boss-row runner over `BossBrain`** (done: generic `installBossRow` + `bossFlagRecord`: arm, intro lock,
   invulnerability answer, checkpoint death, flag record, one continuation): runtime −17, combat −4. Sky Reach's Roc has
   the same shape.
4. **Declared quest + interaction ports** (well / oil / waymark / fire as interaction rows the platform runs, the
   `script` command actor generic): runtime −≈ 80, quest/install −≈ 50.
5. **Generic lash item** (contact rule + whip crack, second lash, pull, stagger, command cooldown on `ItemRuntime`):
   runtime −54, weapons −≈ 190 (Bullwhip + lash).
6. **Species numbers → `data/`** (runtime/species/* minus their brains): public +≈ 120, runtime −≈ 120. Blocked on
   the SDK: the rows are typed by `@wildshard/engine/ai/species` / `ai/strikes` (and a `StrikeSpec` carries a `weight`
   function), so in `data/` they still read custom; it needs a published `@wildshard/sdk` species / strike row type with
   a data-only weight.
7. **Bake the world through `generators/`** (world/ minus fire / storm FX, models, species rigs, whipModel): public
   +≈ 1,800, custom −≈ 1,800. **This is the move that decides 80/20**; everything above together reaches ≈ 15 %.
8. **SDK effect + look-family rows** (fire, storm shell, painted dusk sky): custom −≈ 600.
9. What stays custom: manifest, budgets, the Matriarch's storm script, the skitterer / Matriarch policies (or as
   `behaviour/*.as`), a thin plugin: ≈ 500 lines against ≈ 3,000 public is 86 %.

## What `boot` and `gridReady` need

- **boot** is `test/proof/sunscar-dunes/boot.test.ts` existing and passing. The honest proof for Signal: in plain Node,
  parse `shard.config.ts` (already renderer-free) and boot it through the declared trusted headless factory
  (`runtime/headless.ts` via `createTrustedHeadlessAdapter`), then assert the 13 homes, the admitted terrain and the
  quest are installed. The witness already does everything except name it a boot proof; ≈ 15 lines on `witness.ts`.
- **gridReady** is `test/proof/sunscar-dunes/grid-ready.test.ts`, the template's `grid-ready.mjs` shape: a
  `GridAssembly` cell whose `load` creates Signal's trusted headless simulation behind the `ResidencyAllocator` lease,
  readiness false until admitted, `checkpoint` refused until durable, a frozen region while away, and the continuation
  restored on re-entry (the keeper's exact restore makes this direct). Needs `createShardfileSim` (or its grid caller)
  to take a trusted headless entry the way `HeadlessSimulation` does.
- `transitional` stays true while any `runtime/` line remains (`runtimeLines > 0`), so it only clears at the end of
  the list.

## Fidelity gaps the witness must not pass on (from the previous lane)

- **the whip-crack command cooldown**: the headless whip's creature contacts honour the row's 0.45 s / 0.9 s cooldown
  (`runtime/whip.ts` on `ItemRuntime`), but the world cracks (`SIGNAL_ACT.crank`, `SIGNAL_ACT.light + i` in
  `runtime/quest.ts`) have no cooldown at all: a tape could crack every tick;
- **prompt line of sight**: headless prompts are distance-only from the eye (`near()` in `runtime/quest.ts`, "not
  modelled"); the browser's interactables also need a clear line;
- **the browser whip's unroll delay, second lash, pull and stagger** stay the browser's; headless lands the light /
  heavy crack only.
All three belong to move 5 (the generic lash item), so the browser and the witness run one rule.
