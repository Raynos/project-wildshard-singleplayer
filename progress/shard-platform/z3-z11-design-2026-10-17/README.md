# Z3, Z10, Z11 (and Z4, Z5, Z7, Z8, Z9): technical design

Read-only investigation of `main` at `ef7f29ccd` (2026-10-17), for G480: *"Z3 (declared input/tiers/slots), Z10 (Explorer
catalogue) and Z11 (scene-part addressing) get a technical design page near the end of W2 … before Sky and Signal go to
zero."* Same format as the approved Z1/Z2 design (`progress/shard-platform/z1-z2-design-2026-10-17/README.md`). Nothing
was built, generated or run in the shared tree.

**Line counts** are code lines (non-blank, non-comment), the ruler's rule. My counter reproduces the Z1/Z2 page exactly:
Sky `runtime/index.ts` 127, Signal `plugin.ts` 66, Signal `world/build.ts` 74, Sky `wakeRibbon.ts` 30. "~" means an
estimate from reading the file (±30 %). Raw `wc -l` is not used.

**What already landed since the Z1/Z2 page** (this design builds on it):

- **Z1 runner**: `6dfc334fc` "declare runtime entry plans". `client/plan` with three kinds: `strings.register`,
  `world.scenes`, `debug.expose` (`src/format/clientPlan.ts:6-10`; registry `src/game/shardfile/clientPlan.ts:19`).
  Users: Pine and Driftwood. It also landed `ViewFieldHost` (`view.field` 105, `src/engine/script/viewFields.ts`), which
  has **no runtime user** (only `test/view-field-host.test.ts`). See Z9.
- **Z2 host**: `b133765b9` "assemble resident worlds from rows". `world/scenes` (`src/format/worldScenes.ts`), host
  `installWorldScenes` (`src/game/shardfile/worldScenes.ts:68`). It publishes named handles as `<step>[.<instance>].<key>`
  (`worldScenes.ts:193-206`) behind a typed `SceneHandles` (`worldScenes.ts:18-28`). Users: Driftwood and Pine. Sky and
  Signal have not adopted it yet.
- **Living buildings**: `56f8b161f`. Its own id registry, `SceneResources` (`src/game/shardfile/sceneResources.ts:10-36`),
  which says in its doc comment: "Z2 can publish the same ids directly when its data assembler replaces native
  construction." So there are **two id namespaces today**. That matters for Z11.
- **In flight, uncommitted** (another lane, working tree only): `src/format/worldSceneModels.ts` and
  `src/game/models/worldSceneCatalogue.ts`, "static model recipes over Z2's product libraries and material slots". These
  are model definitions for placed props, not the Explorer roster. Z10 should read them, not add a third format.

---

## 0. Summary

| Feature | Verdict | What changes for a shard | New platform? |
|---|---|---|---|
| **Z3** declared input, tier knobs, slots | **Build, as an extension of two existing sections**: `combat/items` contexts and `sim/plumbing` (the Template's) | Sky's three `declare module` blocks and its knob registration go; Nalati's ride/stealth contexts and Nine's tier functions become rows; Pine's 7 cabin/props knobs leave the **engine** tier table | ~+60 / −20 |
| **Z10** declared Explorer catalogue | **Build**: one `explore/catalogue` section the data client turns into the roster | every `roster.ts` shrinks or goes; Sky and Signal `models/gear.ts` go; species one-liners in DW and Nalati go | ~+170 / −65 |
| **Z11** scene-part addressing | **Not a separate feature.** It is Z2's handle registry made the single id namespace, plus the replacement Z1 already promised for borrowed owners (G483 (4)), plus a few new effect kinds on the approved quest step runner | quest-page rows, channel targets and held resources name ids; no TS owner maps | ~+170 / −175 (net ~0) |
| **Z4** gust burst | **A cue row** on the approved audio cue director (G478), not a host | Sky ~5 lines | inside G478 |
| **Z5** ray wake ribbon | **Listed view code** (single user) | Sky keeps 36 lines, with a written reason | 0 |
| **Z7** Signal fire FX | **Fold into the approved light emitters** (G478) | Signal −45 | inside G478 |
| **Z8** terrain skirt | **A Z2 scene step with cube variants** (no new host) | Signal −37, and the lent-material path goes | ~0 |
| **Z9** Signal dusk | **Confirmed: G484's step-table row on the eased-field host** | Signal ~−22 | inside G474 weather |

**The picks (section 8):** (1) Z3 extends `combat/items` + `sim/plumbing` rather than a new section, and Pine's knobs leave
the engine; (2) retire the legacy slot names with a save migration; (3) Z10 as one section, with TS-built specimens staying in
a shrunken `roster.ts` until they are data; (4) Z11 is folded into Z2/Z1 (one namespace, refs, effect kinds), not a new
feature; (5) the decide-or-drop verdicts above; (6) delete the unused `ViewFieldHost` when the dusk row lands.

---

## 1. Z3: declared input actions, tier knobs and equipment slots

### 1.1 In plain words

Each shard tells the engine three kinds of thing: **which controls it adds** (Sky's GUST button and its G key), **which
quality knobs it has** (how many meadow blades the phone draws), and **which weapon slot names it uses** (the fan's
slot). Today Sky does part of this by editing the engine's TypeScript types from inside its own code (`declare module`),
which only works for code compiled into the app. Most of it is already data somewhere: the Template, Pastel Plain and
Ink-Cel Valley declare their controls and knobs in a `plumbing` block of their shard file, and every shard's weapons
declare their input context in `combat/items`. Z3 finishes the job: those two existing blocks grow the few fields Sky,
Nalati, Pine and Nine still need, the data client installs them, and the `declare module` lines and the TypeScript knob
code are deleted. Nothing new is invented, and the engine loses seven Pine-only knob names from its own table.

### 1.2 What the code does today

**Input.**

- The engine already accepts any namespaced action without a type edit: `export type DeclaredAction = `${string}.${string}``
  and `Action = DeclaredAction | Extract<keyof ActionMap, string> | …` (`src/engine/input/InputService.ts:12-13`). So
  Sky's augmentation `interface ActionMap { 'far.gust': true }` (`far-reach/runtime/index.ts:25-27`) **adds nothing**;
  `'far.gust'` already type-checks as a `DeclaredAction`. The engine's own union still lists Nalati-only names
  (`'ride.whistle' | 'ride.offer' | 'ride.gallop' | 'ride.horseTab' | 'lean.left' | 'lean.right'`, `InputService.ts:17`),
  which are namespaced too and so are redundant there as well.
- **Item contexts are already rows.** `combat/items` declares `contexts` (`src/format/items.ts:52-57`, `69`), closed
  variants keyed on `keysFrom` (`weapon.melee | weapon.ranged | weapon.bow | weapon.spear`). Signal uses one:
  `contexts: [{ id: 'sunscar.whip', keysFrom: 'weapon.melee', actions: ['attack','heavy','lock'], touch: 'melee', lockable: true }]`
  (`sunscar-dunes/generators/rows/items.ts:28`). The data client registers them (`src/game/shardfile/items.ts:90`).
- **Sky's fan context is not**, because it needs one extra action, a touch verb, a relabel and a key-binding row. Sky
  declares `runtimeContexts: ['far.fan']` (`far-reach/generators/rows/items.ts:27`) and puts the real definition into
  `runtimeRows.generated.json` (`far-reach/generators/rows/runtimeBoot.ts:5-14`):
  ```ts
  input: { hiddenMode: 'board',
    definition: { id: 'far.fan', actions: ['attack','heavy','lock','far.gust'], keysFrom: 'weapon.melee', keys: { 'far.gust': ['KeyG'] },
      touch: { mode: 'melee', lockable: true, relabel: { r0: { label: STRINGS.swing, icon: SWING_ICON } },
        verbs: { 'verb.1': { action: 'far.gust', label: STRINGS.gust, icon: GUST_ICON } } } },
    description: { rows: [{ group: 'combat', id: 'far.gust', label: STRINGS.gustBinding, actions: ['far.gust'] }] } }
  ```
  `HybridRuntimePlugin` installs it at play (`src/game/plugin/headless.ts:993-1000`, `1049-1052`), wrapping each verb in a
  `show` closure that hides it while `player.mode === hiddenMode`. That definition is already plain JSON in the shape of
  the engine's `InputContextDef` (`src/engine/level/context.ts:28-36`); only its home is wrong.
- **Free (non-item) contexts are rows for the templates.** `sim/plumbing` (`src/format/plumbing.ts:7-11`) holds
  `input` contexts (id, priority, actions with keys and a `scene` hook, one touch verb), `knobs` and `debug` rows; the data
  client installs it (`src/game/shardfile/client.ts:501`, `installDeclaredPlumbing`,
  `src/game/shard/declaredPlumbing.ts:17-35`). Users: `_template/data/plumbing.ts`, `pastel-plain`, `ink-cel-valley`.
  Sky and Signal have `plumbing: null`.
- **Nalati writes its contexts in TS**: `ride.foot`, `ride`, `ride.break` (`nalati-grasslands/ride/input.ts:13-21`),
  their key-binding rows (`:5-9`, `:28`), mode-driven push/pop (`:29-38`), and `stealth` (`stealth.ts:291-292`).
- Pine, Driftwood and Nine register no input in TS (all through item rows).

**Tier knobs.**

- Shard knobs exist as rows: `knobs: [{ id: 'template.propCount', phone: 10, desktop: 20 }]`
  (`_template/data/plumbing.ts:6`), installed through `ctx.tiers.knobs` (`declaredPlumbing.ts:20-21`;
  `src/engine/level/registrations.ts:60-63`).
- Sky does it by hand: the manifest's `tiers` carry `"far.meadowBlades": 1600 / 3200` (`far-reach/manifest.json:214,220`),
  typed by the augmentation `interface TierKnobMap { 'far.meadowBlades': number }` (`runtime/index.ts:28-30`), registered
  and read in `build()` (`runtime/index.ts:74-76`).
- **Pine's knobs live in the engine.** The engine table `TIER_TABLE` (`src/engine/render/tiers.ts:30,33,57,58`) holds
  `cabinDetailDist`, `cabinDetailShadows`, `sharedCabinLights`, `undergrowthFar`, `undergrowthShadows`, `propsFar`,
  `propsMinAngular`. Every reader is a Pine file (`pine-hollow/runtime/world/cabins.ts:46,49`, `timber.ts:61-62`,
  `cabinBake.ts:75`, `homestead.ts:235`, `props.ts:52`, `landmarks.ts:140`, `looks/groundCover.ts:79,107,118`). "Cabin" is a
  Pine noun in the engine (HOST-BAR test 2, E405).
- Nine branches on tier in TS: `paintSize`, `decalScale` (`nine-dragon-stack/tier.ts:4-5`). Nalati reads engine knobs
  only. Driftwood and Signal have no shard knobs.

**Slots.**

- Declared weapons already get a stable slot `declared.weapon.<id>` (`src/format/items.ts:12`, rule at `:169`), merged as
  a type by `src/game/items.merge.d.ts:4-6`, and set as the weapon's slot by `src/game/shardfile/items.ts:100`.
- Sky and Signal keep an **old** slot name only for saves: `legacySlot: 'far-fan'` (`far-reach/generators/rows/equipment.ts:9`,
  `runtimeRows.ts:15`) and `'sunscar-whip'` (`sunscar-dunes/generators/rows/equipment.ts:5`), each typed by a
  `declare module` (`far-reach/runtime/index.ts:31-33`; `sunscar-dunes/weapons/slots.merge.d.ts`, 4 lines, whose own doc
  says "so a current save's held weapon carries over"). A weapon's id **is** its slot (`src/engine/combat/Weapon.ts:31-32`),
  and the session save stores it: `weapon: weapons.current.id` (`src/game/session/play.ts:229`); the skins locker keys on
  it too.
- The game's own slots (`crossbow`, `sword`, `rifle`, `sword-iron`, `bow`, `sabre`, `spear`, `empty`;
  `src/game/equipmentTypes.merge.d.ts:5`, `src/format/items.ts:31`) are game vocabulary with several users. They stay.

**Per shard, today:**

| Shard | Input | Knobs | Slots |
|---|---|---|---|
| Sky | item context via `runtimeRows` + `ActionMap` augmentation | `far.meadowBlades` by hand + augmentation | `far-fan` legacy + augmentation |
| Signal | item context row (data) | none | `sunscar-whip` legacy + `.merge.d.ts` |
| Pine | item rows | 7 knobs inside the **engine** table | game slots (`crossbow`, `bow`, `rifle`) |
| Driftwood | item rows | none | game slot `sword` |
| Nalati | 4 TS contexts + key rows | engine knobs only | game slots |
| Nine | item rows | 2 TS tier functions | game slots |
| Templates | `sim/plumbing` rows | `sim/plumbing` rows | declared slots |

### 1.3 Problem

- `declare module` from shard code is a TS-only hook. A shard file loaded by a server or another page cannot carry it,
  and the Z1 lockstep landing deletes `runtime/index.ts` where Sky's three blocks live.
- Sky's fan context lives in bundled generated JSON (`runtimeRows.generated.json`), read by `HybridRuntimePlugin`, which
  Z1 deletes.
- The engine table carries Pine's nouns.
- Two slot names per weapon for Sky and Signal, kept only for old saves.

### 1.4 Design in one paragraph

**No new section.** Item-bound input grows inside `combat/items` contexts (the context belongs to its weapon); free input,
knobs and Debug rows stay in `sim/plumbing`, which gains the fields the engine's `InputContextDef` already has (`blocks`,
`keysFrom`, `relabel`, two verbs, key-binding `describe` rows) plus one closed condition, `when`, saying while which player
mode, held item or flag the context is pushed. Knobs gain a boolean form and a lookup that client-plan features and
remaining runtimes read by id. Slots: delete `legacySlot` from Sky and Signal and add a save migration row from the old id
to `declared.weapon.<id>`. The data client installs all of it (it already installs both sections). Ids are validated at
admission, so no TypeScript type map is needed.

### 1.5 What each shard declares

**Sky** (`combat/items`, the fan's context, replacing `runtimeContexts` and `boot.input`):

```json
"contexts": [{ "id": "far.fan", "keysFrom": "weapon.melee", "actions": ["attack", "heavy", "lock"], "touch": "melee", "lockable": true,
  "extra": { "actions": [{ "id": "far.gust", "keys": ["KeyG"] }],
             "relabel": { "r0": { "label": "@swing", "icon": "swing" } },
             "verbs": { "verb.1": { "action": "far.gust", "label": "@gust", "icon": "gust" } },
             "hiddenWhen": { "mode": "board" },
             "describe": [{ "group": "combat", "id": "far.gust", "label": "@gustBinding", "actions": ["far.gust"] }] } }]
```

`far.gust` already drives the fan's secondary phase from its item row (`far-reach/generators/rows/meleePhase.ts:6`,
`action:'far.gust'`), so no target is needed. Sky's `sim/plumbing`:
`{ "namespace": "far", "input": [], "knobs": [{ "id": "far.meadowBlades", "phone": 1600, "desktop": 3200 }], "debug": [] }`,
read by the meadow's grass row (G478 grass field rows: `"tierKnob": "far.meadowBlades"`, already shown in Z1's plan).

**Signal**: nothing new in input (its context is already a row). Slot: a migration row
`{ "kind": "rename", "key": "player.weapon", "from": "sunscar-whip", "to": "declared.weapon.sunscar-whip" }` (illustrative
shape; the existing `state/migrations` section, `src/format/sections.ts:85`, `src/format/migrations.ts:50`).

**Pine**: `knobs: [{ "id": "pine.cabinDetailDist", "phone": 70, "desktop": 160 }, { "id": "pine.cabinDetailShadows", "phone": false, "desktop": true }, …]`
for the seven; its readers switch from `TIER_CONFIG.x` to `knob('pine.x')` in the same lines (no line change until living
buildings and Z2 delete those files).

**Nalati** (`sim/plumbing`, when the G478 mounts and stealth features land):

```json
{ "id": "ride.foot", "priority": 10, "actions": [{ "id": "ride.whistle", "keys": ["KeyX"] }, { "id": "ride.offer", "keys": ["KeyG"] }] },
{ "id": "ride", "when": { "mode": "mounted" }, "actions": [{ "id": "move.forward" }, { "id": "ride.gallop", "keys": ["ShiftLeft", "ShiftRight"] }, { "id": "ride.horseTab" }, { "id": "use" }],
  "relabel": { "edge-l": { "label": "@dismount", "tone": "ready" } } },
{ "id": "ride.break", "when": { "mode": "breaking" }, "blocks": ["attack", "aim", "swap", "ride.whistle", "ride.offer", "ride.horseTab"],
  "actions": [{ "id": "lean.left", "keys": ["KeyA", "ArrowLeft"] }, { "id": "lean.right", "keys": ["KeyD", "ArrowRight"] }] }
```

The mounts feature publishes the `mounted` / `breaking` modes and consumes the actions; the rows only declare and push.

**Nine**: `knobs: [{ "id": "nine.paintSize", "phone": 512, "desktop": 1024 }, { "id": "nine.decalScale", … }]`.
(`decalScale` is 0.5 / 1; knob values become finite numbers, not only naturals.)

**Driftwood**: nothing. **Templates**: unchanged (they are the regression guard).

### 1.6 What the platform does

1. **Admission** (before any hook): parse both sections. Every action id is either owned (`<namespace>.` prefix, today's
   rule in `plumbingRules`, `plumbing.ts:15-29`) or an engine action (`attack`, `move.forward` …), never a third shard's.
   `when.mode` names a mode the shard declares (`modes` section) or a mode a declared feature publishes. Every knob id is
   owned and unique. Unknown ids refuse with `ProductError`.
2. **Install** (`items` stage, then `plumbing` at `client.ts:501`): register contexts through `ctx.inputContext`
   (scoped); install `describe` rows through `input.bindings.describe` (as `headless.ts:1051` does now); wrap verbs with a
   `show` that reads `when` / `hiddenWhen` (as `headless.ts:997-998` does with `hiddenMode`); push/pop contexts on mode
   changes from the player's mode event.
3. **Knobs**: `ctx.tiers.knobs({ id, defaults })` as today; `PlumbingHandles.knobs` (already returned,
   `declaredPlumbing.ts:15,34`) is passed to client-plan features (`ClientFeaturePorts.knob(id)`) and to remaining runtimes.
4. **Slots**: no install step. The migration row runs with the other `state/migrations` rows before saves are read.

### 1.7 API

```ts
// src/format/plumbing.ts (extended; JSON only, bounded)
type When = { readonly mode?: string; readonly notMode?: string; readonly item?: EquipmentId; readonly flag?: string };   // all optional, AND-ed
interface PlumbingInputRow {
  readonly id: `${string}.${string}`; readonly priority: number;
  readonly actions: readonly { readonly id: Action; readonly keys?: readonly string[]; readonly scene?: `${string}.${string}` }[];   // scene: today's hook
  readonly keysFrom?: string; readonly blocks?: readonly Action[];
  readonly relabel?: Readonly<Record<DiscSpot, { readonly label: string; readonly icon?: string; readonly tone?: 'ready' }>>;
  readonly verbs?: Partial<Record<'verb.1' | 'verb.2', { readonly action: Action; readonly label: string; readonly icon: string }>>;
  readonly when?: When; readonly describe?: readonly KeyBindingRow[];
}
interface PlumbingKnobRow { readonly id: `${string}.${string}`; readonly phone: number | boolean; readonly desktop: number | boolean }

// src/format/items.ts: an optional `extra` on each context variant (same fields as above, minus id/priority, plus hiddenWhen)
// src/game/shard/declaredPlumbing.ts
export interface PlumbingHandles { contexts: ReadonlyMap<string, string>; knob(id: string): number | boolean }   // throws on unknown id
```

No `ActionMap`, `TierKnobMap` or `EquipmentSlotMap` merge is needed by any shard after Z3: ids are strings checked at
admission, the same way `DeclaredAction` already works.

### 1.8 Layer

Schemas in `src/format/` (both sections exist). Install in `src/game/shard/declaredPlumbing.ts` and
`src/game/shardfile/items.ts` (game: they know shard files). The engine keeps `InputService`, `InputContextDef` and
`TierKnobSchema` unchanged and **loses** the Nalati action literals (`InputService.ts:17`) and the seven Pine knob keys
(`tiers.ts`).

### 1.9 Before and after

**Sky, today** (`runtime/index.ts:25-33`, `74-76`):

```ts
declare module '@wildshard/engine/input/InputService' { interface ActionMap { 'far.gust': true } }
declare module '@wildshard/engine/level/spec' { interface TierKnobMap { 'far.meadowBlades': number } }
declare module '@wildshard/engine/combat/Equipment' { interface EquipmentSlotMap { 'far-fan': true } }
…
const blades = ctx.manifest.tiers?.phone?.['far.meadowBlades'] ?? 0;
ctx.tiers.knobs({ id: 'far', defaults: { 'far.meadowBlades': blades } });
const field = meadow(skyMeadowBlades(), SKY_LIBRARY.look('meadow'), ctx.manifest.tiers?.[ctx.app.render?.tier ?? 'phone']?.['far.meadowBlades'] ?? blades);
```

**After:** the `contexts[0].extra` and the knob row in 1.5; the grass row reads `ports.knob('far.meadowBlades')`. The
manifest loses `"far.meadowBlades"`; the equipment row loses `legacySlot`.

**Nalati, today** (`ride/input.ts:13-15`):

```ts
ctx.inputContext({ id: 'ride.foot', actions: ['ride.whistle', 'ride.offer'],
  keys: { 'ride.whistle': ['KeyX'], 'ride.offer': ['KeyG'] },
  touch: { relabel: {}, verbs: ride.hud.inputVerbs() } });
```

**After:** the `ride.foot` row in 1.5. What stays in TS until the mounts feature lands is only the consuming system
(`ride/input.ts:39-43`), which the mounts feature then owns.

**Pine engine table, today** (`tiers.ts:33`): `cabinDetailDist: 70, cabinDetailShadows: false, sharedCabinLights: true, beaconLights: false,`
**After:** `beaconLights: false,` (engine, `world/Boundary.ts`), and the three cabin keys as Pine knob rows.

### 1.10 Lines

| Shard | Deleted | Notes |
|---|---:|---|
| Sky | **11** | `runtime/index.ts:25-33` (9) + `:74-75` (2). Inside the file Z1 deletes; Z3 is what lets those lines go. Meadow line 76 goes with the grass row |
| Signal | **0 counted** | `weapons/slots.merge.d.ts` (4) is a `.d.ts` the ruler excludes; it goes anyway |
| Pine | **0** shard | 7 knob keys leave the **engine** table (platform −4 lines, −7 Pine nouns) |
| Driftwood | 0 | |
| Nalati | **~22** | `ride/input.ts` contexts, key rows and push/pop (~20), `stealth.ts:291-292` (2); lands with G478 mounts/stealth (W3) |
| Nine | **~4** | `tier.ts` |
| Templates | 0 | regression guard |

**Platform:** about **+60** (format ~25: `extra`, `when`, `describe`, boolean/finite knobs; game ~35: `when` pushes,
describe, `knob()` port, migration row kind if missing), about **−20** (`headless.ts` `boot.input` / `itemContexts` path
~14 with Z1, engine union −1, engine tier keys −4). Net **~+40**.

### 1.11 Host bar

| Test | Pass? | Evidence |
|---|---|---|
| 1 Two real users | Yes | `sim/plumbing`: three templates today (`_template/data/plumbing.ts`, `pastel-plain`, `ink-cel-valley`), plus Sky, Pine, Nalati, Nine; item contexts: Signal (`items.ts:28`) and Sky |
| 2 No shard nouns | Yes, and it removes some | the engine loses `cabin*`, `undergrowth*`, `props*` (`tiers.ts:30,33,57,58`) and `ride.*` (`InputService.ts:17`) |
| 3 Data-driven | Yes | rows only; `when` is a closed vocabulary (mode, item, flag) |
| 4 Server-safe | Yes, labelled client | input and knobs are presentation; the headless runtime ignores both blocks |
| 5 Deletion test | Yes | the templates already depend on `sim/plumbing` |
| 6 Data-only API | Yes | no callbacks; ids checked at admission. The deep dives scored it 5/6 for "needs generated types"; `DeclaredAction` (`InputService.ts:12`) shows no type map is needed |

**6 / 6.** It extends existing hosts; it is not a new one.

### 1.12 What Z3 does NOT do

- No new HUD control and no layout change. Moving a declaration with an identical result is not an E332 HUD change; a
  shard that wants a new verb still needs Jake's pick.
- No input scripting: `when` is a mode / item / flag test, not logic. Logic stays in features or AS.
- No per-shard tier detection: tiers are still `phone` / `desktop` from the engine.
- No change to the game's shared slots (`sword`, `bow` …).

### 1.13 Risks

1. **Saved key rebinds.** `installDeclaredPlumbing` prefixes context ids with the shard slug
   (`declaredPlumbing.ts:24`, `${ports.instance}.${row.id}`). Rebinds are stored per context id. Moving Sky's `far.fan`
   into plumbing would orphan a saved G rebind. Mitigation: item-bound contexts stay in `combat/items` (unprefixed ids, as
   today), and only free contexts go to plumbing; Nalati's are new there, so a one-time migration of `ride*` binding keys.
2. **Weapon saves and skins.** `weapon: weapons.current.id` (`play.ts:229`) and the locker key on `far-fan` /
   `sunscar-whip`. Mitigation: the migration row, and a test that loads a saved Sky slot holding `far-fan` and a skin, and
   checks the held weapon and the worn skin.
3. **Mode names.** `hiddenWhen: { mode: 'board' }` replaces a closure. A mode must be declared or published; admission
   refuses a typo instead of silently never hiding.
4. **Boolean knobs.** Today's knob schema is a natural 0–10000 (`plumbing.ts:6`); Pine's shadows and shared lights are
   booleans. Small schema change; `TierKnobs` already allows booleans.

### 1.14 Build steps

| # | Commit | Deletes | Platform + | Tests |
|---|---|---|---:|---|
| 1 | `combat/items` context `extra`; Sky's fan context moves there; `runtimeContexts` and `boot.input` go | Sky `ActionMap` block; `headless.ts` boot-input path | ~25 | item-context unit test; Sky key rebind survives (saved binding test) |
| 2 | plumbing knobs: finite/boolean values, `knob()` port; Sky knob row; Pine's 7 knobs move out of `TIER_TABLE` | Sky `TierKnobMap` block and knob code; engine keys | ~15 | tier fixture (G474 second shard declares a boolean knob) |
| 3 | slot migration rows for Sky and Signal | Sky `EquipmentSlotMap` block, Signal `slots.merge.d.ts`, both `legacySlot` | ~10 | saved-slot + skin migration test |
| 4 | plumbing `when`, `blocks`, `relabel`, `describe` (with the G478 mounts feature, W3) | Nalati contexts; engine `ride.*` literals | ~15 | mounts feature fixture |

---

## 2. Z10: declared Model Explorer catalogue

### 2.1 In plain words

The Model Explorer shows every creature, person and piece of gear a shard has. Today each shard writes a small TypeScript
file, `roster.ts`, that imports those models one by one and lists them in a hand-picked order; Sky and Signal also write a
`models/gear.ts` that rebuilds their windmill, bridge, tower and well a second time just for the Explorer, through
TypeScript callbacks. Z10 replaces that with a list of rows in the shard file: "show species X", "show held item Y", "show
the scene part Z that the world already built", in display order. The data client turns the rows into the Explorer's
roster, so a shard with no code still gets a full Explorer (the templates could too). Models that are still drawn by
shard TypeScript (Pine's villagers, Nine's arms) stay in a much shorter `roster.ts` until they become data.

### 2.2 What the code does today

- **The engine contract.** `ShardManifest.roster?: (product) => Promise<readonly RosterEntry[]>` (`src/game/shard/manifest.ts:599-605`),
  a lazy loader bound in the generated discovery (`far-reach/discovery.generated.ts`, `roster: async () => (await import("./roster"))["ROSTER"]`;
  manifest binding `far-reach/manifest.json:286`). At boot `listShardModels` lists the shared dummy and hoverboard, then
  awaits the roster and lists each entry (`src/engine/models/roster.ts:31-44`). An entry is `live(def, { pipeline, planned, copies, drawnAs })`
  (`src/engine/models/live.ts:116`), which calls `listModel` (`live.ts:44`) to register one catalog entry. The Template has
  no roster (`_template/discovery.generated.ts`: `const native = {  }`).
- **Per shard:**

| Shard | Files | Lines | What the entries are |
|---|---|---:|---|
| Sky | `roster.ts`, `models/gear.ts` | 6 + 11 | fan (held recipe), mill / bridge / vane (rebuilt by `towerMill`, `bridgeKit`, `vane` from `world/mill.ts`, `world/shapes.ts`), every rig of `SKY_LIBRARY` (`boot/rigs.generated.json`), the keeper (NPC) |
| Signal | `roster.ts`, `models/gear.ts` | 11 + 13 | whip, creature specimens (`data/creatureModels.generated.json`), tower / caravan / well / brazier rebuilt by `buildPlace` (`world/places.ts`), in a hand-sliced order (`roster.ts:9-10`) |
| Pine | `roster.ts` | 38 | deer and elk (`defineModel({...creature(...)})` inline), boar, bear, Antler King, wildlife from a posed-draw library, three villagers (TS ModelDefs), held gear (`held/gear` rows), swim hands; `preparedRoster` prepares three feature caches first (`:54-61`) |
| Driftwood | `roster.ts` (+ `runtime/models/creatures.ts` 25) | 21 | boar, bear; crab, monkey, sailor, captain (one-line `defineModel({...creature(...)})` each, `creatures.ts:20-31`); gull (custom posed); castaway; held arms claims; four collection / loot models |
| Nalati | `roster.ts` (+ `models/creatures.ts` 80) | 22 | 11 one-line species defs (`creatures.ts:42-72`), sheep / marmot / storm titan (custom builders), camp people, shepherd, `GEAR` (97 TS lines), reins, swim hands |
| Nine | `roster.ts` | 3 | `GEAR`: the first-person arms specimen (`models/gear.ts`, 38, a custom settle loop) |

- **Sky's and Signal's gear uses borrowed owners.** `modelCatalogue(GEAR_SCENE_ROWS, { owners: new Map([...FAN_HELD_OWNERS, ['npcModels', HERO_LIBRARY], ['npcLooks', SKY_LIBRARY]]), source, builds: [['mill', () => towerMill().group], …] })`
  (`far-reach/models/gear.ts:10-13`). The host is `modelCatalogue` (`src/game/plugin/geometry.ts:1897-1934`) with
  `BorrowedNpcSpecimen` / `prepareBorrowedNpcSpecimen` / `borrowedNpcSpecimen` (`src/game/plugin/ui.ts:1467-1480`), whose rows
  carry `{owner, path}` (`far-reach/generators/rows/gearModels.ts:12`: `owner:'npcModels', path:['painted']`). It fails
  HOST-BAR test 6.
- **Why it blocks Z2.** `models/gear.ts` imports `world/shapes.ts`, `world/mill.ts` (Sky) and `world/places.ts` (Signal) to
  rebuild places, so those Z2-owned files cannot be deleted until the Explorer stops calling them. Z2's build step 1
  noted this ("Explorer parts move with N10 or stay until it lands").
- **The other catalogue.** `defineSpecimenCatalogue` (`src/game/models/specimenCatalogue.ts:239`; DW and Nalati
  `models/catalogue.ts`) defines **placed** prop models (`fencePost`, `yurt` …) that appear in the Explorer because world
  code places them (`place` registers, `src/engine/explore/registry.ts` doc). That is a model library, not the roster; Z10
  leaves it alone. The uncommitted `worldSceneModels` work is its Z2-era successor.

### 2.3 Problem

- Six TS files exist only to list models; three more (`models/gear.ts` ×2, Sky/Signal model files) exist to rebuild
  places for the Explorer, through borrowed owners.
- The Explorer roster cannot come from a shard file, so a Template-shaped shard (Z1's target) has no Explorer roster,
  and Sky and Signal cannot lose their `roster` native binding at the Z1 landing.
- Order and framing are TS (`slice(0,1)`, `slice(5)`, `slice(1,5)` in Signal).

### 2.4 Design in one paragraph

A client-only section **`explore/catalogue`** lists Explorer entries in display order. Each row is one of a **closed set
of kinds**, each resolved by a host that already exists: a species on its rig, every model of a declared rig library, a
held item (the held feature's recipe), a quest NPC figure, a Z2 scene part (isolated live, the world already built it), a
model from a declared feature library (collections), a posed-draw library, or an engine model. The data client builds the
roster from the rows and supplies `ShardManifest.roster` for any product that has the section, so `gen-shards` writes no
`roster` binding. Specimens drawn by shard TS stay in a shorter `roster.ts`, merged after the rows, until their models are
data. Sky and Signal must have no `roster.ts` at the Z1 landing.

### 2.5 What each shard declares

**Sky** (`sections/explore/catalogue.json`):

```json
{ "version": 1, "entries": [
  { "kind": "held",  "item": "weapon.far-reach.fan" },
  { "kind": "scene", "part": "static.mill.root", "id": "far-reach/windmill", "name": "Windmill", "file": "src/shards/far-reach/generators/millScene.ts", "pipeline": "code", "frame": { "distance": 22 } },
  { "kind": "scene", "part": "frames.root",      "id": "far-reach/bridge-kit", "name": "Rope bridge", "file": "…", "pipeline": "code" },
  { "kind": "scene", "part": "vanes.east.root",  "id": "far-reach/vane", "name": "Weather vane", "file": "…", "pipeline": "code" },
  { "kind": "rigs",  "library": "species" },
  { "kind": "npc",   "npc": "far.keeper" } ] }
```

**Signal**: `held` whip; `rigs` (creature specimens); `scene` tower / caravan / well / brazier (`tower.root`,
`caravan.root`, `well.root`, `brazier.0.root`), in the order the hand slices produce today.

**Pine**: `species` deer (with Pine's grazer look), elk, boar, bear; `posed` wildlife library; `held` from `held/gear`;
`engine` swim hands. The Antler King and the three villagers stay in a 5-line `roster.ts` until their models are data.

**Driftwood**: `species` boar, bear, crab, monkey, sailor, captain; `held` arms claims; `library` collections chime and
plaques. Gull, castaway, hat and cape stay in a short `roster.ts`.

**Nalati**: `species` for the 11 one-liners (horse, wolf, sheepdog, the four elites, ghost rider, balbal, golden king);
sheep, marmot, storm titan, people, `GEAR` and reins stay in TS. `copies` comes from the generator (G467) instead of the
`FLOCK` / `MARMOTS` sums (`roster.ts:18-20`).

**Nine**: nothing yet (its only entry is a custom arms specimen; G475 held viewmodel arms is the path). **Templates**:
optional; a copy could list its species and props.

### 2.6 What the platform does

1. **Admission**: parse; every `held.item` exists in `combat/items` / `held/*`; every `species` is in
   `actors/species-programs` or a rig library; every `npc` in `questNpcs`; every `scene.part` is a publication declared by
   `world/scenes` (Z2's admission already builds that set, `worldScenes.ts:124-127`); every `library` names a declared
   feature library. Unknown refuses (`ProductError`).
2. **Roster** (`explorerRoster(product, ports)`): map each row to a `RosterEntry` with the metadata the row carries
   (`id`, `name`, `file`, `category`, `pipeline`, `copies`, `planned`, `drawnAs`, `frame`). `prepare` runs the feature
   caches a kind needs (held finishes, grazer looks, posed libraries), as Pine's `preparedRoster` does by hand.
3. **Scene parts** are listed `live: true` with `object: () => handles.object(part)` (the Explorer isolates in place,
   `src/engine/world/registry.ts:109-111`), resolved lazily on first view, because the Explorer lists at boot
   (`roster.ts:31`) before `world.scenes` has built. If the resident world is not built (an Explorer opened from the
   menu), the entry builds the one step through the Z2 host's step builder, owned by the Explorer's scope.
4. **Merge**: rows first, then a remaining TS `roster` binding if the manifest still has one (hybrid shards in W2/W3).

### 2.7 API

```ts
// src/format/explorerCatalogue.ts
export type ExplorerEntryRow = ExplorerMeta & (
  | { readonly kind: 'species'; readonly species: string; readonly look?: string }
  | { readonly kind: 'rigs'; readonly library: string }
  | { readonly kind: 'held'; readonly item: EquipmentId }
  | { readonly kind: 'npc'; readonly npc: string }
  | { readonly kind: 'scene'; readonly part: string }                 // a Z2 publication id
  | { readonly kind: 'library'; readonly library: string; readonly model: string }
  | { readonly kind: 'posed'; readonly file: string }
  | { readonly kind: 'engine'; readonly model: 'swim-hands' | 'training-dummy' | 'hoverboard' });
interface ExplorerMeta { readonly id?: string; readonly name?: string; readonly file?: string; readonly category?: ModelCategory;
  readonly pipeline?: Pipeline | readonly Pipeline[]; readonly copies?: number; readonly planned?: number; readonly drawnAs?: DrawnAs;
  readonly frame?: { readonly distance?: number; readonly yaw?: number } }
export interface ExplorerCatalogue { readonly version: 1; readonly entries: readonly ExplorerEntryRow[] }   // ≤ 256, unique ids
export function parseExplorerCatalogue(input: unknown): ExplorerCatalogue;

// src/game/models/explorerCatalogue.ts
export function explorerRoster(product: ShardProduct, ports: { readonly handles: () => SceneHandles | null }): Promise<readonly RosterEntry[]>;
```

### 2.8 Layer

Schema in `src/format/`. Host in `src/game/models/` (it resolves game concepts: held items, NPCs, species programs, scene
handles). The engine contract (`RosterEntry`, `listRoster`) does not change. `gen-shards.mjs` stops writing `roster` when
the manifest has no binding; `defineAuthoredShard` supplies it from the product.

### 2.9 Before and after

**Signal, today** (`sunscar-dunes/models/gear.ts:10-15`, `roster.ts:8-11`):

```ts
export const GEAR_MODELS = modelCatalogue(GEAR_SCENE_ROWS,{owners:new Map<string,unknown>([...Object.entries(WHIP_HELD_OWNERS),['npcModels',DUNE_LIBRARY]]),source,builds:[
  ['tower',()=>buildPlace('tower',WORLD.last()??new Map())], ['caravan',…], ['well',…], ['brazier',()=>buildPlace('brazier',WORLD.last()??new Map(),0,[])],
]});
export const ROSTER = [ ...GEAR_MODELS.slice(0,1).map(model=>live(model)), ...DUNE_LIBRARY.models(SIGNAL_MODEL_SPECIMENS).map(model=>live(model)),
  ...GEAR_MODELS.slice(5).map(model=>live(model)), ...GEAR_MODELS.slice(1,5).map(model=>live(model)) ];
```

**After:**

```json
{ "version": 1, "entries": [
  { "kind": "held", "item": "weapon.sunscar-whip" }, { "kind": "rigs", "library": "dune" },
  { "kind": "scene", "part": "tower.root", "id": "sunscar-dunes/tower", "name": "Signal tower", "frame": { "distance": 18 } },
  { "kind": "scene", "part": "caravan.root", "id": "sunscar-dunes/caravan" }, { "kind": "scene", "part": "well.root", "id": "sunscar-dunes/well" },
  { "kind": "scene", "part": "brazier.0.root", "id": "sunscar-dunes/brazier" } ] }
```

**Driftwood, today** (`runtime/models/creatures.ts:20`, `roster.ts:23`):
`export const reefCrab = defineModel({ id: 'driftwood-isle/reef-crab', file: FILE, pipeline: 'code', ...creature('crab') });`
then `live(reefCrab)`. **After:** `{ "kind": "species", "species": "crab", "id": "driftwood-isle/reef-crab", "pipeline": "code" }`.

### 2.10 Lines

| Shard | Deleted | Notes |
|---|---:|---|
| Sky | **17** | `roster.ts` 6, `models/gear.ts` 11; **unblocks** `world/shapes.ts` 23 + `world/mill.ts` 14 (credited to Z2) |
| Signal | **24** | `roster.ts` 11, `models/gear.ts` 13; **unblocks** `world/places.ts` 29 (Z2) |
| Pine | **~30** | `roster.ts` 38 → ~8 (Antler King, villagers) |
| Driftwood | **~26** | `roster.ts` 21 → ~5; `runtime/models/creatures.ts` four species one-liners and imports (~10) |
| Nalati | **~39** | `roster.ts` 22 → ~8; `models/creatures.ts` 11 species one-liners, constants and imports (~25) |
| Nine | 0 | custom arms specimen (G475 held arms later) |
| Templates | 0 | optional new capability |

**Platform:** about **+170** (format ~40, host ~120, discovery ~10), about **−65** (`modelCatalogue` scene/borrowed path
~40 in `geometry.ts`, borrowed NPC specimen ~25 in `ui.ts`, once Sky and Signal move). Net **~+105**.

### 2.11 Host bar

| Test | Pass? | Evidence |
|---|---|---|
| 1 Two real users | Yes | all six shards have a roster today (table 2.2) |
| 2 No shard nouns | Yes | kinds are generic; ids come from rows |
| 3 Data-driven | Yes | order, framing, copies are row data; no builder map |
| 4 Server-safe | Yes, labelled client | the Explorer is client-only; the section is `audience: client` |
| 5 Deletion test | Yes | every shard keeps a roster |
| 6 Data-only API | Yes | `explorerRoster(product, { handles })`; replaces `modelCatalogue`'s `owners` / `builds` (`geometry.ts:1891-1896`) |

**6 / 6.**

### 2.12 What Z10 does NOT do

- It does not make a model data. A specimen drawn by TS stays TS (listed in the short `roster.ts`) until a library, rig
  or Z2 step draws it.
- It does not replace `defineSpecimenCatalogue` / `worldSceneModels` (placed props; they reach the Explorer by placement).
- No Explorer UI change.

### 2.13 Risks

1. **Boot order.** The Explorer lists at boot; scene parts exist only after the resident world builds. Mitigation:
   lazy `object()`; the step-rebuild fallback for an Explorer opened before the world.
2. **Memory.** A fallback rebuild duplicates a step's geometry (the Explorer is Developer-facing; 1.2 GB cap, G433).
   Prefer live isolation; release the fallback with the Explorer scope.
3. **Fidelity and order.** Signal's hand-sliced order and per-specimen framing must match. One Explorer screenshot pair
   per shard in the commit message (G468: a line, not a board, if identical).
4. **Copies.** Nalati computes copies from fauna rows at import; moving that into the generator changes when it is
   computed, not the number.

### 2.14 Build steps

| # | Commit | Deletes | Platform + | Tests |
|---|---|---|---:|---|
| 1 | schema + `explorerRoster` with `species`, `rigs`, `held`, `npc`, `engine`; DW first (species one-liners) | DW `roster.ts` most, `creatures.ts` species lines | ~120 | G474 fixture lists a made-up species and held item |
| 2 | `scene` kind on Z2 handles; Sky and Signal (after their Z2 steps) | Sky `roster.ts`, `models/gear.ts`; Signal `roster.ts`, `models/gear.ts`; then Z2 deletes `shapes.ts`, `mill.ts`, `places.ts` | ~30 | Explorer lists scene parts live; fallback build test |
| 3 | `posed`, `library` kinds; Pine, Nalati | Pine and Nalati roster lines | ~20 | |
| 4 | delete `modelCatalogue` scene path and borrowed NPC specimen | platform −65 | 0 | |

---

## 3. Z11: scene-part addressing

### 3.1 In plain words

When a quest step says "show the oil in brazier 2" or "relabel the winch prompt", the data today points at the thing by a
path into a TypeScript object: `{owner: 'world', path: ['braziers', 2, 'parts', 'oil', 'visible']}`. The shard's code must
build that object and hand it over, so the "data" only works with that exact code beside it. Z2 already gives every scene
part a plain name (`brazier.2.oil`), and the living-buildings host gives doors and lamps names too. Z11 makes those names
the only way to point at a part: quest rows, moving-part channels and held weapons say `brazier.2.oil`, and the platform
looks it up. Calls into game services (play a sting, add an item, light a lamp) become a short fixed list of effect kinds
on the quest step runner Jake already approved. Then the TypeScript object maps disappear. This is not really a new
feature: it is how Z2's names get used, and it is what Z1 already promised ("borrowed owners removed, not ported").

### 3.2 What the code does today

**The mechanism.** `BorrowedOwnerPath = { owner, path, optional? }` (`src/game/plugin/borrowed.ts:2`), resolved by
`readBorrowedOwner` (`:7-28`, walks up to 16 keys into a caller-supplied object) and `bindBorrowedMethod` (`:31-37`). The
format side: `ownerPath` in quest page rows (`src/format/questInteractions.ts:12-24`, `72-76`).

**Where it is consumed** (platform):

| Consumer | File:line | Paths into | Shard users |
|---|---|---|---|
| Page prompts `at`, `bindings.{prompts,labels,visible,observations,calls}`, world points | `ui.ts:1116-1121`, `1132`, `1176-1200`, `1232-1241` | scene parts, prompts, live getters, TS methods | Sky, Signal, Pine (5 binds, `quest/index.ts:210-262`, `390-392`), `game/quest/trader.ts:63-64,104-105` |
| Page stages `observations / actions / events` | `ui.ts:1319-1360` | live getters, TS methods | Sky, Signal (via `HybridRuntimePlugin`) |
| Hybrid rows `pageFight.armed / dress`, `melee.decorate`, `pageQuest.flags / model / dress / capture` | `headless.ts:658-680`, `758-759`, `801`, `812`, `1009-1023` | TS fields and methods | Sky, Signal |
| Held resources `from`, decorators | `weaponFamily.ts:594`, `634-647` | library methods | Sky, Signal (`generators/rows/heldWeapon.ts`: `owner:'library', path:['geometry']` ×15) |
| Channel numeric inputs and outputs | `channels.ts:118-170`; `bindClientChannels` `targets: ReadonlyMap<string, unknown>` and `named` prompt handlers (`ui.ts:719-724`) | scene objects, look uniforms | Sky, Signal (targets); Pine, Nalati, DW (sky/weather inputs) |
| Story, exchange | `game/quest/story.ts:163-176`, `game/loot/exchange.ts:26-32` | services | Pine, DW |
| Director bindings | `game/plugin/director.ts:326-350` | services | Pine, Nalati (v0 director scripts; retire with v0, G484 (7)) |

**What the paths actually point at** (from the generators): **scene parts and prompts** for Sky and Signal (Signal:
`world.braziers[i].parts.oil.visible`, `.fire.visible`, `.spot.label`, `.spot.onInteract`, `tower.brazierAt`,
`caravan.logbookAt`; `sunscar-dunes/generators/questPageInteractions.ts:5-25`; Sky: `frames.winchAt`, `world.state.raised`;
`far-reach/generators/questPageInteractions.ts:5-11`), and **service verbs** for Pine and DW (tally of their generators:
`flags.set` ×5, `music.sting` ×4, `sfx.interact` ×3, `lamps.setLit` ×3, `inventory.add` ×2, `ammo.*` ×4, `skins.*` ×3,
`purse.*` ×2, `door.use`, `native.fastForward` ×2, `native.syncWheel`, `caption.show` ×2 …). Row counts in source
generators: Sky 32, Signal 55, Pine 62, DW 7, Nalati 3, Nine 0.

**The TS owner maps** that feed them (runtime code): Sky `runtime/index.ts:94-95` (`['world', built], ['plugin', this]`),
`:80-84` (the winch `observed` callback writing `built.state.raised` and the prompt label), `world/build.ts:114`; Signal
`world/build.ts:53`, `58-59`, `66-74`, `79-84` (`['world',{logbook,well,braziers,fire}],['motion',channels],['commands',{catchFire}]`),
`data/placeBindings.ts` (the typed contract that exists only so TS can reach parts by field); Pine `quest/index.ts:201-293`,
`391-396` (12 maps), including a nearest-prompt-by-regex search for the mill door (`:226-236`); DW
`quest/adventure.ts:156,160`, `loot/presentation.ts:35`.

**Names that already exist.** Z2 publishes `<step>[.<instance>].<key>` (`worldScenes.ts:193-206`) and the Z1 runner hands
them to remaining view code (`clientSceneHandles`, `clientPlan.ts:62`). Living buildings resolve doors, swings, wheels,
lamps and lights by id from `SceneResources` (`livingBuildings.ts:75-80`; `sceneResources.ts:16-22`). Two registries, no
shared grammar.

### 3.3 Is Z11 part of Z2 / Z1, or separate?

**Part of them.** Three pieces, none a new host:

- **(a) One namespace, in Z2.** `SceneHandles` (Z2) becomes the only registry; living buildings take it instead of
  `SceneResources` (whose doc already anticipates this). Native code that still builds parts publishes into it with the
  same grammar. ~+15 / −20.
- **(b) Refs instead of paths, in each consumer, landing with its Z1 feature.** Page interactions (`quest.page`), page
  stages (quest runner), channel targets (`motion.channels`), held resources (`held.melee`), boss arming (boss host). G483
  (4) approved "borrowed owners removed, not ported (lint-refused)" without saying what replaces them; (b) is that.
- **(c) Service calls become effect kinds of the approved quest step runner** (`src/format/questSteps.ts:8-12` already has
  `flag`, `item`, `command`, `notice`): add `sting`, `sfx`, `toast`, `purse`, `ammo`, `skin`, `site` (lamp), `door`,
  `mover`, `emitter`, `visible`, `label`, `light`, `clock`. Pine and DW use these outside Z1.

The Signal deep dive credits N11 with lifting **six** borderline hosts. By my reading Z11 fixes **four** of them (channels
§5.3, held §5.5, boss arming §5.8, page stages §5.9) plus page interactions itself. The other two, `bakedKinds` (§5.2,
`decorate` callbacks) and the painted look (§5.4, `dressing` / `terrain` TS ports), fail on TS callbacks that Z11 does not
touch; G478's look hosts and Z8 fix those.

### 3.4 Design in one paragraph

A small format module defines **`SceneRef`** (a part, a published point with an offset, or a prompt id) and
**`ObservationRef`** (a flag, an interaction mark, a mover end state). Every schema that today embeds `ownerPath` takes
refs instead; the `bindings` block of page interactions is deleted, because effects name their targets directly. At
admission the platform checks every ref against the publications declared by `world/scenes` and the building rows,
refusing the product if one is missing. At install, refs resolve through the one `SceneHandles`; effects run through the
quest step runner's effect table. No TS object, path walk or method call crosses the boundary.

### 3.5 What the shards declare

**Signal, today** (`generators/questPageInteractions.ts:8,18,22,32,37` and runtime `world/build.ts:79-84`):

```ts
{id:'brazier.0',label:STRINGS.needOil,at:{owner:'parts',path:['bowlAt']},radius:3},
visible:[…{target:'fire.0',owner:'world',path:['braziers',0,'parts','fire','visible']}],
calls:[{target:'catch-fire',owner:'commands',path:['catchFire']},{target:'glow.0',owner:'world',path:['braziers',0,'parts','glow'],args:[true]}],
{id:'light.0',interaction:'light.0',before:[{kind:'visible',target:'fire.0',value:true},{kind:'call',target:'glow.0'},{kind:'label',target:'brazier.0',text:STRINGS.waymarkLit}], …},
{id:'fire',interaction:'fire',denied:{unlit:STRINGS.fireHint},before:[{kind:'call',target:'catch-fire'}],after:[{kind:'call',target:'summon'}]},
// runtime:
const fireCaught = (caught: SignalFire): void => { caught.tower.fire.visible = true; caught.tower.light.intensity = TOWER_LIGHT; caught.brazier.label = STRINGS.lit; };
const presentation = bindQuestPageInteractions(source, { flags, rules,
  owners: new Map<string,unknown>([['world',{logbook,well,braziers,fire}],['motion',channels],['commands',{catchFire:()=>{fireCaught(fire);}}]]), … });
```

**After** (rows only; the handles are the Z2 publications of Signal's place steps):

```json
{ "prompts": [{ "id": "brazier.0", "label": "@needOil", "at": { "part": "brazier.0.bowlAt" }, "radius": 3 }, …],
  "actions": [
    { "id": "light.0", "interaction": "light.0", "before": [
        { "kind": "visible", "part": "brazier.0.fire", "value": true },
        { "kind": "emitter", "id": "brazier.0", "on": true },
        { "kind": "label", "prompt": "brazier.0", "text": "@waymarkLit" }],
      "after": [{ "kind": "toast", "text": "@waymarkLit", "progress": { "flags": ["lit.0", "lit.1", "lit.2"], "complete": "@allLit" } }] },
    { "id": "crank", "interaction": "crank", "after": [{ "kind": "mover", "id": "sunscar.well.bucket", "command": 1 }, { "kind": "label", "prompt": "well", "text": "@takeOil" }] },
    { "id": "fire", "interaction": "fire", "denied": { "unlit": "@fireHint" }, "before": [
        { "kind": "visible", "part": "tower.fire", "value": true }, { "kind": "light", "part": "tower.light", "intensity": 14 },
        { "kind": "label", "prompt": "fire", "text": "@lit" }] } ],
  "initial": [{ "when": { "all": ["sunscar.lit"] }, "effects": [{ "kind": "visible", "part": "tower.fire", "value": true }, "…"] }] }
```

The `summon` call (`world.fire.onLight`) goes: the boss host arms on a flag (`armed: { "flag": "sunscar.lit" }`, G474),
replacing `pageFight.armed: {owner:'plugin', path:['places','fire','lit']}` (`sunscar-dunes/generators/rows/runtimeRows.ts:12`).
The well's channel prompt, today `channels.bindPrompts({ named: new Map([['sunscar.well.take', () => { page('well'); }]]) })`
(`world/build.ts:59`), becomes a channel prompt row with `"action": "well"` (a page action id). Channel targets
(`targets: new Map([['bucket', wellParts.bucket], ['rope', wellParts.rope]])`, `:58`) become handle ids `well.bucket`,
`well.rope` in the channel rows.

**Sky.** `at: { "part": "frames.winchAt" }`; the observation `{target:'winch-up', owner:'world', path:['state','raised']}`
becomes `{ "id": "winch-up", "mover": "far.winch.bridge", "state": "at-end" }` (the page stage mover kind already exists:
`stages: {movers: [{id:'winch-up', …}]}`, `runtimeRows.ts:16`); the winch call becomes `{ "kind": "mover", "id": "far.winch.bridge", "command": 1 }`;
the relabel is a `labels` row on the prompt (`when: { all: ["far.quest.raised"] }`). That deletes the `observed` callback
(`runtime/index.ts:80-84`). Channel target `winch` → `frames.fallen`.

**Pine.** `{ "kind": "site", "id": "pond", "lit": true }` (living buildings' site ids) for `lamps.setLit`;
`{ "kind": "door", "id": "watermill", "action": "toggle" }` for the mill door, replacing the regex search
(`quest/index.ts:226-236`); `sting`, `sfx`, `item`, `flag`, `clock` (`native.fastForward`) effects for the rest. The wheel
sync becomes the living-buildings wheel row reading `errand:done`.

**Driftwood.** Story / exchange calls → `item`, `purse`, `toast` effects; placement ports stay platform-internal (they are
named by the platform, not by shard data, `trader.ts:63-64`).

**Templates.** The Template's recommended Z2 door step (Z1/Z2 page §2) is addressed the same way.

### 3.6 What the platform does

1. **Admission.** Collect publications: Z2's set (already computed, `worldScenes.ts:124-127`) plus building-row ids. Walk
   every ref in `questHost.page`, page stages, channel rows, held recipes, boss rows. A missing id refuses the product at
   boot (`ProductError`), never on first interact. Effect kinds check their own ids (mover in `movers`, emitter in the
   emitter rows, site in building rows, item in `combat/items`).
2. **Resolve** at install (play phase, after `world.scenes`): `handles.object / vector / light / material(id)`, typed as
   today (`worldScenes.ts:47-53`).
3. **Run** effects through one dispatcher, the quest step runner's, with each kind bound to its existing service (flags,
   music, cues, inventory, purse, movers, living buildings, emitters).

### 3.7 API

```ts
// src/format/sceneRefs.ts
export type HandleId = string;                                  // ^[a-z0-9][a-z0-9.-]*$, ≤ 256, the Z2 grammar <step>[.<instance>].<key>
export type SceneRef = { readonly part: HandleId } | { readonly point: HandleId; readonly offset?: readonly [number, number, number] } | { readonly prompt: string };
export type ObservationRef = { readonly flag: string } | { readonly mark: string } | { readonly mover: string; readonly state: 'at-end' | 'moving' };
export const SceneRefSchema: v.GenericSchema<unknown, SceneRef>;

// src/format/questInteractions.ts (changed): prompts[].at: SceneRef; effects:
//   { kind:'visible', part, value } | { kind:'label', prompt, text } | { kind:'light', part, intensity } | QuestEffect (below);
//   `bindings` removed; world reactions `at`: { kind:'point', … } | SceneRef
// src/format/questSteps.ts (extended effect union, shared by page actions and quest steps)
export type QuestEffect = { kind: 'flag' | 'item' | 'command' | 'notice' | 'sting' | 'sfx' | 'toast' | 'purse' | 'ammo' | 'skin'
  | 'site' | 'door' | 'mover' | 'emitter' | 'clock'; /* literal args only, per kind */ };

// src/game/shardfile/worldScenes.ts (one registry)
export interface SceneHandles { /* as today */ publish?: never }      // read-only to consumers
export function publishNativePart(handles: SceneHandles, id: HandleId, part: Object3D | Material | BufferGeometry): void;   // migration: native builders
export function admitSceneRefs(product: ShardProduct, published: ReadonlySet<HandleId>): void;                             // throws ProductError
```

### 3.8 Layer

Refs in `src/format/`. The registry stays in `src/game/shardfile/worldScenes.ts` (game). Effects in `src/game/quest/`
(the quest step runner). The engine is untouched. `borrowed.ts` is deleted when its last consumer moves, and a lint rule
refuses `owner` + `path` in any section schema (the G483 (4) lint, made total).

### 3.9 Lines

These are lines whose **only** blocker is addressing. Sky's and part of Signal's sit inside files Z1/Z2 delete whole, so
the totals below are not added again in section 6.

| Shard | Lines | Where |
|---|---:|---|
| Sky | ~15 (inside Z1's `runtime/index.ts`) | owner map, `observed` callback, `finishRaise`, `rows()` owners; `runtime/weapons/heldFan.ts` owner map (5) |
| Signal | ~33 (inside files Z2/Z1 delete whole) | `data/placeBindings.ts` 6; `world/build.ts` presentation wiring ~22 (lines 50, 53, 58-63, 66-74, 79-84, 106); `runtime/items/heldWhip.ts` 5 |
| Pine | **~30** | `quest/index.ts` owner maps and glue (~16), mill-door search (~12), `runtime/quest.ts:183` exchange owners (~2) |
| Driftwood | **~5** | `quest/adventure.ts:156,160`, `loot/presentation.ts:35` |
| Nalati | 0 | its owner maps feed look uniforms (`look/skyRig.ts:127`); those go with the G478 look hosts, not Z11 |
| Nine | 0 | |

**Platform:** about **+170** (refs schema ~30, admission ~30, effect kinds ~60, channel and held ref resolution ~25,
registry merge ~15, lint ~10), about **−175** when Pine moves last (`borrowed.ts` 31, owner-path schemas ~8, `ui.ts`
borrowed branches ~85, `weaponFamily.ts` ~10, `channels.ts` ~10, story / exchange / trader ~20, `SceneResources` ~10).
Net **~0**. Director bindings (`director.ts:326-350`) are not counted: they retire with v0 (G484 (7)).

### 3.10 Host bar (for the changed hosts)

| Test | Pass? | Evidence |
|---|---|---|
| 1 Two real users | Yes | Sky, Signal, Pine, DW; living buildings already resolves ids (`livingBuildings.ts:75-80`) |
| 2 No shard nouns | Yes | refs and effect kinds are generic |
| 3 Data-driven | Yes | ids and literal args only |
| 4 Server-safe | Yes | refs are strings; scene resolution is client-only; flag / item / purse effects already run in the native host |
| 5 Deletion test | Yes | every page / channel / held user needs it |
| 6 Data-only API | Yes | it is the T6 fix: no `{owner, path}`, no TS map, no callback |

**6 / 6.** Lifts page interactions (2/6 today), page stages (2/6), channels (3/6) and held (3/6) to 6/6, and removes the
`armed` / `dress` paths from the boss row before it folds into the G474 boss host.

### 3.11 What Z11 does NOT do

- **No scripting.** Effects are single service calls with literal arguments. Conditions stay in `needs` / `when`. Anything
  else is AS (G470), through `signal` 9 or `flag` 7.
- **No look uniforms.** Channel inputs that read sky or fog uniforms (Pine `keyedSky.ts:360`, `rainFx.ts:142`, Nalati
  `skyRig.ts:127`, DW `facetedDayBackdrop.ts:71`) are look fields; the G478 look hosts and the G474 keyed sky own them.
- **No new state.** Refs hold nothing; marks are already saved by `InteractionRules`.

### 3.12 Risks

1. **Ids become a contract between sections.** Renaming a scene step breaks quest rows. Mitigation: admission refuses at
   boot; generators derive both from one constant.
2. **Live getters.** Paths read live values (`world.state.raised`, `braziers[i].lit`). Each becomes a flag, mark or mover
   state the platform already tracks. Check every observation has one.
3. **Pine's mill door.** The regex search found the prompt nearest a hinge (`quest/index.ts:226-236`); the door id must
   name the same door. A walk test at the mill.
4. **Effect list creep.** Every new kind is a platform verb; cap it to services that exist, reviewed under the host bar.
5. **Order of landing.** A consumer switched before its scene publishes its handles throws at admission (good), but blocks
   the shard. Switch each consumer in the commit that adds the publications.

### 3.13 Build steps

| # | Commit | Deletes | Platform + | Tests |
|---|---|---|---:|---|
| 1 | One registry: living buildings take `SceneHandles`; `publishNativePart` for native builders; refs schema; admission | `SceneResources` | ~60 | DW + Pine buildings unchanged (their parity poses); fixture with a bad ref refuses at boot |
| 2 | Quest page refs + `visible` / `label` / `light` / `mover` / `emitter` effects; Signal places (with Z2 step 4) | Signal `placeBindings.ts`, `world/build.ts` wiring | ~50 | Signal quest scenario (oil, light, fire) |
| 3 | Channel targets and prompt actions by id; Sky winch | Sky `observed` callback; `named` handlers | ~20 | Sky winch save/restore |
| 4 | Held resources by library id (with Z1 `held.melee`) | `heldFan.ts`, `heldWhip.ts` owner maps | ~15 | held proof |
| 5 | Service effect kinds on the quest step runner; Pine, DW | Pine/DW owner maps | ~40 | Pine lantern / mill / trader scenarios |
| 6 | Delete `borrowed.ts`, owner-path schemas; lint refuses `owner`+`path` | platform −175 | 0 | lint test |

---

## 4. Decide-or-drop: Z4, Z5, Z7, Z8, Z9

### Z4: Sky's gust burst on a weapon action

- **What it is.** When the fan's secondary (GUST) fires, two seeded effect fields (streaks, petals) burst at the fan along
  the aim, and the heavy charge cue plays.
- **Code.** `far-reach/runtime/index.ts:123-129`:
  `fan.onGust = (from, dir) => { const at = from.clone().addScaledVector(dir, 0.2).setY(from.y - 0.25), salt = fxRandom.next(); gust[0].burst(at, dir, salt); gust[1].burst(at, dir, salt); rt.play?.cues.charge(…, 'heavy'); };`
  plus the per-frame `gust[i].update(dt)` system. The field rows are already data (`generators/rows/windLook.ts:18-19`); the
  updraft fields are Z1 `fx.field` rows.
- **Recommendation: a cue row, not a host.** A cue (`far.gust`, already the action id) routes to a VFX target:
  `{ "cue": "far.gust", "vfx": [{ "field": "far.gust.streaks", "at": "aim", "offset": [0, -0.25, 0.2] }, { "field": "far.gust.petals", "at": "aim" }], "sound": "cue.sword.heavy" }`,
  in the G478 **audio cue director** (approved, from Nalati's cue router, `nalati-grasslands/runtime/audio/sound.ts:164`),
  which gains a `vfx` target that bursts a declared effect field. Pine's Antler King bursts impacts on events
  (`pine-hollow/runtime/antlerKing.ts:158-159,186,194`, `Impacts.burst`), a plausible second VFX target user.
- **Host bar.** As a cue-director target: **5/6** (test 1 half: one effect-field burst user today; 6/6 if Pine's impact
  bursts move to cue rows). As its own "weapon-action burst" host: 4/6, single-shot: **do not build**.
- **Lines.** Sky ~5 (inside Z1's `runtime/index.ts`). Platform ~+40 inside the cue director.

### Z5: Sky's ray wake trail ribbon

- **What it is.** A camera-facing ribbon behind each flying ray, rebuilt every frame.
- **Code.** `far-reach/runtime/looks/wakeRibbon.ts` (30) and the per-ray loop `runtime/index.ts:137-142` (~6).
- **Recommendation: listed view code** with the written reason "single user; per-frame drawing; the engine `SlashTrail`
  (`src/engine/combat/view/slashTrail.ts`, two-point blade ribbon; users Nine `brushTrail.ts`, the engine sword) is a
  different contract". G466 (5) allows listed view code at the close bar. If a second user appears (Pine bolt tracers,
  `RangedTraceRow`, `heldLauncher.ts:85`), add a "follow one point, camera-facing" profile to `SlashTrail` (~+25 engine)
  and an `fx.trail` row on the species look (−36 Sky).
- **Host bar.** As a host today: **4/6** (fails tests 1 and 5). Single-shot rule (HOST-BAR): never a new host.
- **Lines.** Sky keeps **36** listed lines (it moves into `runtime/` as permanent view code; it is the one Sky file whose end
  state is `runtime/`, G465 (2)). Platform 0.

### Z7: Signal's fire FX folded into the approved light emitters

- **What it is.** Fire look graphs on a `shared.firetime` clock, camera-facing flame cards, a seeded ember field, and a
  4-slot firelight uniform that the sand's ground pools read.
- **Code.** `sunscar-dunes/world/fireFx.ts` (45); its callers `world/build.ts:76,92-105` (lantern slot, `SiteLights`,
  `tickFires`, tower flicker) and the pools adapter in `look/render.ts`; platform `setGroundPools`
  (`src/engine/render/families/ground.ts`, Signal-only, doc names "Signal Dunes' burning fires").
- **Recommendation: an emitter row on G478's light emitters** (approved, Nine's ~190): an emitter is a light-pool slot plus
  optional card and ember FX with a host-field clock;
  `{ "id": "brazier.0", "at": { "part": "brazier.0.bowlAt" }, "kind": "fire", "light": { "gain": 1, "flicker": { "waves": [[11,0,0.07],[23,1,0.05]] } }, "cards": "fire.flame", "embers": "fire.embers", "clock": "shared.firetime", "initially": false }`.
  Quest rows switch it with the Z11 `emitter` effect. The ground family reads the emitter pool uniform when its row says
  `pools: "emitters"`, so `setGroundPools` goes.
- **Host bar.** After the fold: **6/6** (Signal fires, Nine lantern pools `nine-dragon-stack/runtime/looks/light.ts`, Pine
  fire pits via living buildings, DW hut flames). As its own "fire FX host": 4/6, do not build.
- **Lines.** Signal **−45** (plus ~12 in `world/build.ts`, counted with Z2/Z11). Platform: ~+60 of fold work counted inside
  G478; −12 `setGroundPools`.
- **Timing flag.** G478 features wait for W3, but Sky and Signal go to zero after W2 (G480 (3)). Signal's runtime deletion
  needs emitters first: either pull the emitters' first slice forward with Signal as first adopter (Nine fixture), or
  Signal's lockstep waits for W3. I recommend pulling it forward (it is ~190 approved lines, needed anyway).

### Z8: Signal's terrain skirt and lent tile material

- **What it is.** A baked dune skirt past the 500 m cube edge (G99), drawn in the same sand material the data client draws
  the terrain tiles with, swapped for a cube-cut version inside a grid cell.
- **Code.** `sunscar-dunes/runtime/looks/bakedGround.ts` (37: `CubeSkirt.load / wear / fit`, `lentMaterial`); used by
  `plugin.ts:47-55`. Platform sole-user lending: `runtimePresentation` / `hybridPresentation`
  (`src/game/shardfile/runtimeProduct.ts`, `hybridPresentation.ts`, 2/6 in the Signal audit). Terrain tiles cannot carry
  it: the terrain section is a fixed 8×8 + 4×4 grid inside the cube (`src/format/terrain.ts`, `tiles … v.length(80)`).
- **Recommendation: a Z2 scene step, no new host.** Z2 already has everything the skirt needs: an `owned` geometry library
  (`src/format/worldScenes.ts:12`), cube variants chosen by `ctx.cube` (`src/game/shardfile/worldScenes.ts:172`,
  `variants: { standalone, cell }`), a `look` material slot (`src/format/worldScenes.ts:18`) and node `renderOrder`
  (`src/format/clientChannels.ts:158`). With the dusk on
  the eased field (Z9), the material needs no lent state binding:
  `{ "id": "skirt", "variants": { "standalone": "scenes/skirt", "cell": "scenes/skirt-cell" }, "geometry": { "skirt": { "library": "skirt", "model": "skirt" } }, "materials": { "sand": "sand" } }`
  with slot `{ "id": "sand", "kind": "look", "look": "pbr" }`. Open check: that the look slot resolves to the same compiled
  material instance the terrain tiles use (`lentLook`, `src/game/shardfile/worldScenes.ts:166`), so the skirt matches
  the sand exactly.
- **Host bar.** As its own `terrain.skirt` host: **3/6** (one user, lent material). As a Z2 step: Z2's **6/6**, no new code.
- **Lines.** Signal **−37**; platform −~10 (`runtimePresentation`, `hybridPresentation` sole-user lines), +0.

### Z9: Signal's dusk (confirm G484)

- **What it is.** The dusk deepens with each quest step and eases over ~50 s; a loaded save snaps to its step.
- **Code.** `sunscar-dunes/look/dusk.ts` (11: `DUSK`, `setDusk`, `stepDusk`, `RATE = 0.02`); `duskOf`
  (`plugin.ts:21-28`, 7); wiring `plugin.ts:60,73-74` (3); the lent `shared.dusk` read (`plugin.ts:47`).
- **Confirmed: covered by G484 (1).** A step table on the eased-field host:
  `{ "field": "shared.dusk", "ease": { "rate": 0.02 }, "steps": [{ "when": { "all": ["sunscar.lit"] }, "value": 1 }, { "when": { "count": { "of": ["brazier.0","brazier.1","brazier.2"], "atLeast": 3 } }, "value": 0.86 }, …, { "when": { "all": ["sunscar.scout"] }, "value": 0.5 }], "else": 0 }`
  (first match; the `0.5 + 0.12 × lit` formula becomes three rows; saves snap, play eases). Zero AS. Other users: Signal's
  storm strength (`src/game/plugin/bossStorm.ts`, eased in TS today) and Pine weather transitions (G474 weather reactions
  and keyed sky), so it belongs inside that approved feature.
- **The eased-field host is not built yet** (only in decisions). **`ViewFieldHost` was built** in `6dfc334fc`
  (`src/engine/script/viewFields.ts`, 42 lines) as G483's `view.field` fallback, but G484 made the row primary and nothing
  uses it except its test; its pending-user entry names Nalati (`lint/platform-pending-users.json`, "rechecked-by: end of
  W3"). See pick 6.
- **Host bar.** Eased field **5/6** (test 1 until Pine adopts), 6/6 inside G474. `ViewFieldHost` today: 0 real users.
- **Lines.** Signal **~−22**. Platform ~+50 (inside G474 weather), −42 if `ViewFieldHost` goes.

(Z6 was never named in the audit's list.)

---

## 5. How the three full features relate to Z1 and Z2

- **Z3** is independent of Z2. Its Sky part is the `input.actions` kind Z1's plan already lists; with item contexts in
  `combat/items`, Z1 needs no separate `input.actions` kind at all (the data client installs items).
- **Z10** depends on Z2's handles (`scene` kind) and unblocks Z2's last Sky/Signal deletions (`shapes.ts`, `mill.ts`,
  `places.ts`). It must land before the Z1 lockstep (Sky and Signal lose their `roster` binding then).
- **Z11** is Z2's names used everywhere plus Z1's promised borrowed-owner removal. Signal's `world/build.ts` cannot be
  deleted by Z2 alone (its quest wiring needs refs), which the Z1/Z2 page already noted (§5.8).

---

## 6. Lines per shard and platform, per feature

Shard code lines deleted (estimates "~"). Lines inside a file another feature deletes whole are shown in brackets and
not double counted in the totals.

| Feature | Sky | Signal | Pine | DW | Nalati | Nine | Templates | Platform + | Platform − | Net |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Z3 input/knobs/slots | (11) | 0* | 0 | 0 | ~22 | ~4 | 0 | ~60 | ~20 | ~+40 |
| Z10 Explorer catalogue | 17 | 24 | ~30 | ~26 | ~39 | 0 | 0 | ~170 | ~65 | ~+105 |
| Z11 addressing | (~15) | (~33) | ~30 | ~5 | 0 | 0 | 0 | ~170 | ~175 | ~0 |
| Z4 gust → cue row | (~5) | 0 | 0 | 0 | 0 | 0 | 0 | ~40 (in G478) | 0 | ~+40 |
| Z5 ray wake | 0 (36 listed) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Z7 fire FX → emitters | 0 | 45 | 0 | 0 | 0 | 0 | 0 | ~60 (in G478) | ~12 | ~+48 |
| Z8 skirt → Z2 step | 0 | 37 | 0 | 0 | 0 | 0 | 0 | 0 | ~10 | ~−10 |
| Z9 dusk row | 0 | ~22 | 0 | 0 | 0 | 0 | 0 | ~50 (in G474) | ~42** | ~+8 |
| **Total** | **17** (+31 in Z1) | **~128** (+33 in Z1/Z2) | **~60** | **~31** | **~61** | **~4** | 0 | **~550** | **~324** | **~+226** |

\* Signal's `slots.merge.d.ts` (4) goes but the ruler excludes `.d.ts`. \*\* only if `ViewFieldHost` is deleted (pick 6).
Brackets: Sky's Z3/Z4/Z11 lines sit in `runtime/index.ts` (Z1 deletes it whole); Signal's Z11 lines sit in `world/build.ts`
and `data/placeBindings.ts` (Z2) and `runtime/items/heldWhip.ts` (Z1). Z11 is what makes those deletions possible.

**Reconciliation with the zero plan.** Sky: Z1 251 + Z2 201 + meadow 25 (grass rows) = 477 of today's shard TS; Z3/Z4/Z11
lines sit inside Z1's `runtime/index.ts`; Z10 is the 17 of `roster.ts` + `gear.ts` that Z1's table already assigned to
"N10"; Z5's 36 are the honest floor (listed view code), so Sky ends at **~36 listed lines, not 0**, unless Jake wants the
`SlashTrail` profile. Signal: Z1 191 + Z2 134 + Z7 45 = 370; Z8 and Z9 are inside Z1's 191; Signal ends at **0**.
Also unblocked by Z10 and credited to Z2: Sky 37, Signal 29.

---

## 7. Order, relative to Z2 and Z1

Z2 is in flight (sp-x5: DW and Pine adopters); the Z1 runner has landed with three kinds.

1. **Z11 step 1 now, with Z2's next adopters**: one handle registry (living buildings' `SceneResources` folds in), refs
   schema and admission. Cheap, and every later Sky/Signal step needs it.
2. **Z3 any time, any lane** (small, independent): item-context `extra` and Sky's fan first; Pine's knobs out of the engine;
   slot migrations. Nalati's contexts wait for the G478 mounts feature (W3).
3. **Z2 Sky/Signal steps** (Z2 page build steps 1-5), with **Z11 step 2** for Signal's places and **Z8** as one more Signal
   step.
4. **Z10** right after the Sky/Signal scene steps (its `scene` kind needs them); then Z2 deletes `shapes.ts`, `mill.ts`,
   `places.ts`. DW, Pine, Nalati rows any time after step 1 of Z10.
5. **Z9** with the eased-field host (G474 weather reactions, W2 queue) and **Z7** with the light emitters (G478, pulled
   forward, see Z7); **Z4** with the audio cue director (G478).
6. **Z11 steps 3-5** with the Z1 features they serve (`motion.channels`, `held.melee`, quest step runner effects for Pine/DW).
7. **Z1 lockstep landing** last: Sky and Signal runtimes deleted together; then Z11 step 6 deletes `borrowed.ts`.

Critical path for "Sky and Signal to zero after W2": Z11 (1-2) → Z2 Sky/Signal → Z10 → emitters + eased field → Z1 landing.
The two approved-but-unbuilt hosts (light emitters, eased field) are the schedule risk, not Z3/Z10/Z11.

---

## 8. What Jake decides (one recommendation each)

1. **Z3 lives in two existing sections, not a new one.** Item-bound controls grow inside `combat/items` contexts (the fan's
   GUST), free controls, knobs and Debug rows stay in `sim/plumbing` (the Template's block), and Pine's seven cabin/props
   knobs move out of the engine's tier table into Pine rows. **Recommend yes**: no new format, the templates already prove
   it, and the engine loses Pine nouns.
2. **Sky's and Signal's old weapon slot names (`far-fan`, `sunscar-whip`) are retired with a save migration row**, not kept
   as type merges. **Recommend yes**, with a saved-slot + skin test; G453 (6) says no format back-compat.
3. **Z10 is one `explore/catalogue` section; models still drawn by shard TS stay in a short `roster.ts` until they are
   data.** Sky and Signal have none left at the Z1 landing; Pine, DW and Nalati shrink. **Recommend yes.**
4. **Z11 is folded into Z2 and Z1, not a separate feature**: Z2's handle names become the only id namespace (living
   buildings join it), every row that points at a part uses those names (no `{owner, path}`), and game-service calls become
   effect kinds of the approved quest step runner. **Recommend yes**; it is the concrete form of G483 (4).
5. **The decide-or-drop verdicts:** Z4 a cue row on the approved audio cue director; Z5 stays as listed view code (Sky keeps
   36 lines with a written reason); Z7 folds into the approved light emitters, pulled forward so Signal can reach zero
   after W2; Z8 becomes a Z2 scene step; Z9 is G484's dusk row. **Recommend all five as stated.**
6. **`ViewFieldHost` (`view.field` 105) was built but has no user** now that the dusk is a row. **Recommend deleting it in
   the commit that lands Signal's dusk row** (HOST-BAR: no real user, single-shot fallback); it can come back with a real
   user.
