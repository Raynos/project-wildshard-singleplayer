# How to write a shard

## Performance comes first

Run `wildshard build <folder>` and `wildshard validate <folder>` after each content step.
Both print a performance report. New and outside projects refuse target overages;
only the canonical six old shards in the trusted checkout warn while they convert.
A borrowed old slug does not grant an exemption. Runtime admission remains hard.

The only hard memory budgets are the **complete worst-location totals: 1,200 MB
playing and 1,800 MB loading**, including the engine, neighbours, commons and overlap.
Library, simulation, tile and far resident targets are tradeable warnings, not separate
per-shard memory caps. Wire/render targets still refuse new content:

| Content step | Current target | Check before continuing |
|---|---|---|
| Critical simulation and library | 2 MB / 8 MB compressed | Report download closures; validate actual bytes and dependencies |
| Fine tile / coarse tile | 0.3 / 0.2 MB wire; 8 / 2 draws; 40,000 / 10,000 triangles | Report every tile; include shadows and all LODs |
| Far proxy | 1 MB wire; 1 draw; 8,000 triangles | Report the proxy and inspect the approach view |
| Materials | SF59 graph v1 node, sampler and instruction budgets | Report every graph; prefer platform families |
| Scripts | Host fuel ceiling; CPU p95 ≤ declared tick budget or 4,167 µs, whichever is lower | Build observes 60 headless ticks; validate retains the full simulation/entry proof |
| Trusted custom runtime | No frame allocation, raw rendering/DOM, timers, fetch or unbounded loops | Runtime source lint, then frame-floor CPU receipt |
| Playable view | 60 fps desktop / 30 fps Simulator; shard CPU p95 ≤ 4.167 / 8.333 ms per drawn frame | Run frame-floor through browser/Simulator lanes |

The report bounds draws/triangles at spawn and at the worst memory location before
frustum/occlusion. A native transition's measured resident cost is charged; unknown
native view/download work is explicitly **UNMEASURED**, never counted as zero.
Estimated time to playable uses unique playable bytes at **1 MB/s plus 1 s setup**.
This cold-network model is not a phone measurement: capture real fetch, decode,
compile, admission and first-frame timings before claiming a loading improvement.

Runtime geometry is not cheap merely because its source is code. Measure builder CPU,
physics insertion and upload separately; move deterministic construction into baked
assets or workers, and yield within the remaining builders. The SF67 target is no
loading task above about 100 ms; the current matched report still exceeds it.
Report real completed work within Props and other long steps, actual download bytes,
and named waits from the first HTML frame. A step boundary alone is insufficient.
Use [the loading benchmark](../progress/loading/sf67/README.md), separately from the
frame floor: cold and warm SHARD SELECT, phase wall times and tasks above 50 ms.
Chromium CPU emulation and Simulator Safari are separate results, neither a physical
phone measurement.

For example, a 5 MB playable closure estimates 6 s under those assumptions. A good
card says `PASS (refuse)` with measured script samples and no refusals. A bad new
card declaring an 8,000,001-byte library says `REFUSED (refuse)` and
`REFUSAL: library download budget bytes: 8000001 > 8000000`; build writes no product.
Use `@wildshard/sdk/reportCard` to inspect the same structured report in tooling.

Before marking a shard done:

- [ ] Build and validate pass with truthful decoded/GPU/wire costs and measured script CPU/fuel.
- [ ] Worst grid totals fit 1,000 / 1,800 MB; every warning has an explained trade.
- [ ] Spawn, busiest view, approaches and crossings meet draw/triangle and graph targets.
- [ ] Custom runtime lint is clean; reuse buffers and bound every loop.
- [ ] Both-surface frame-floor receipts include trusted shard CPU ownership within its quarter-frame share.
- [ ] Cold-cache phone-tier loading is measured through first playable frame; estimates stay labelled.

## Quickstart

Run `pnpm gen` in this repository before copying `src/shards/_template/`.
Alternatively, run `wildshard new <folder> [slug]`. Install the SDK,
then build and validate before adding content. Add one bounded tile/library/script
slice at a time and check its report row before the next slice. Build-time generators
may allocate freely; shipped data and scripts use the admitted platform systems.

Shared build-time packs use the [commons catalogue](COMMONS.md); runtime imports cannot reach commons code.

SDK projects use `shard.config.ts` plus `generators/`, `data/`, `behaviour/`,
`assets/`. Primary shards have no runtime TypeScript: they require
`shard.config.ts` and `README.md`, with admitted data and WASM for play. The template is a complete declaration-only SDK project. Its manifest supplies picker
metadata and points at its built shardfile; there is no template runtime chunk.
Build output goes in git-ignored `out/<slug>/`: a v2 index, JSON sections and named hash blobs. Placement is platform data in
`src/game/grid/singleplayer.json`, attached by `scripts/gen-shards.mjs`; source manifests
and shardfiles carry no placement. SF17a changes the catalogue to the 3 × 3 grid.

**G694 source freeze.** Primary shards contain executable TypeScript only in
`generators/`; JSON contracts and declaration files erase completely. The
`shard.config.ts` entry is declaration-only. `wildshard/no-shard-runtime` is a
hard rule with no ratchet allowance. Exact registered legacy files keep their
existing import/layout paths (**held for LD**); a `-legacy` suffix grants no
exemption. The LEGACY entry and Developer buttons remain available for QA.

**G8 generated data banks.** Keep `.bin` / `.glb` payloads as named files,
never base64 in JSON or numeric payloads in generated TypeScript. Node author
programs can use `@wildshard/sdk/bake/typedDataBank`: `encodeTypedDataBank`
returns an owned little-endian `.bin` and a small JSON header; publish both
through the existing output writer. `readTypedDataBank(headerPath)` reads the
bounded header at run time, valibot-parses the defining
`@wildshard/format/typedDataBank` schema and verifies the sibling binary's
length/hash before returning detached typed columns. Width 16 describes
instance matrices; width 3 describes positions. Use `Float64Array` when
preserving JS-number precision, and `Float32Array` only for data already
defined as float32. Signed zero and integer bits are retained. Declare both
header and bank in the source/cache inputs. Do not statically import a
`*.generated.json` header: that import is a per-file shrink-only lint ratchet.
This Node reader is for author programs, not a runtime or config declaration.

**Late material receipts.** `lateSceneMaterialFiles` from
`@wildshard/sdk/worldScenes`
projects explicit `{ variantOf, at: [x, z] }` groups from named output files
into the existing `output.late` hints. Declare only detail or off-view
materials whose native readers already support later demand. A critical
or otherwise selected alias keeps the shared hash early; missing groups,
conflicting positions and malformed late-file metadata refuse. Coarse
material variants remain outside the hinted groups. Inventory, hashes,
costs, tier choice and required dependency closure stay intact.

**Named tile encoding.** `bakeOwned` / `bakeProps` accept the build-only
`props.encodeTileBlob(name, bytes)` / `encodeTileBlob` callback. It sees a
stable name such as `props.0.2.4`, after any existing tile compression but
before the compiler hashes and parses the final GLB costs. Both sides of
the callback are copied, so retained encoder buffers cannot mutate emitted
assets. Libraries, panels and far proxies never invoke it; omitting the
callback preserves the existing path. `@wildshard/sdk/bake/tileEncoder`
defines `meshoptTileBytes`: lossless meshopt buffer views, selected only
when gzip-9 is strictly smaller. It never quantizes or reorders geometry.
Decoded/GPU/draw costs still come from admission of the returned bytes;
wire savings do not discount the decoder's memory charge.

To start a shard, run `pnpm gen` in this repository before copying
`src/shards/_template` to a fresh project folder. This restores its pinned CPU
outputs from retained authoring sources; then install
`@wildshard/sdk`, and open `shard.config.ts` to edit the identity (follow its imported
author-only declaration when the entry is thin). Run `wildshard build
<folder>` and `wildshard validate <folder>`. The config imports only SDK modules;
content-addressed assets are already included. Build-time generators may use author
tools, while shipped behaviour is admitted AssemblyScript and callback-free data.
The platform owns placement, cache, residency, physics, input, HUD and the normal
Game boot. Follow [SHARDFILE.md](SHARDFILE.md) for the data contract; the history below describes earlier APIs and is not a primary-shard authoring path.

Ledger declarations use `@wildshard/sdk/ledger`: validate fact-to-reward mappings with
`parseLedgerRules`. Authors emit a named outcome; the host assigns its stable instance,
package revision, entity, tick, ordinal and engine/script provenance. The platform admits
catalogue rewards at capped tiers and records achievements/titles once per package in the
profile. Grants and fact dedupe share one durable write; failed writes retry the same
document. Cells never enter a save or fact key. First-party modes resolve one identity
through `@wildshard/game/grid/instances`; template copies use `template-1` … `template-6`,
while Select a shard uses `template-solo`. The template uses the normal staged Game loader.

The public grid catalogue includes Driftwood, Pine Hollow, Nalati and Sky Reach (G258),
with template copies 2 and 3 and three open plots. Developer adds Signal Dunes; DEVSERVER
may add Nine Dragon. Catalogue membership does not waive admission: every runtime keeps
its complete claim, the public memory caps stay 1.0 GB playing / 1.8 GB loading, and a
failed KTX2 capability probe retains the image fallback and its actual admission refusal.

Instance-local saves bind through `SaveStore.instance`, or the game’s `instanceSave`
helper with the session’s stable id and shard. Canonical first-party slug namespaces stay
unchanged; `template-solo` copies the legacy `_template` document while retaining its
source. Destination entries win, including unknown/future-version entries. Failed copies
remain in memory and retry on read/write; `peek` stays read-only. Template copies never
inherit one another’s progress, and cells never enter the save API. Client integration
follows at SF20a/SF46.

Quest authors use `@wildshard/sdk/quests` to compile declared flags, quest steps,
world markers, region/death triggers and finite dialogue trees. The platform binds them
to the existing `QuestState`, preserving journal/chip/marker text and counters. Custom
conditions read atomically published public/owner script fields by stable id; scene hooks
queue declared events for the next script tick with the session's actor binding. Profile
outcomes pass through the ledger fact port, while coins remain local. Dialogue cursors
and quest state restore at the same simulation checkpoint.

Audio authors use `@wildshard/sdk/audio` for a cue-to-catalogue voice map, bounded wind
recipes and a silent/default score. `installDeclaredAudio` admits every voice before
installing anything; the game's `declaredWeaponVoices` retains the existing weapon sounds
and impact surface routing. Level scopes remove cue routes, stop bed sources and restore
the score output gain. The template's data keeps its two forest wind bands and silent score.

Scoped plumbing uses `@wildshard/sdk/plumbing`: declare namespaced input actions and
keyboard/touch bindings, phone/desktop tier values, and Debug choices with named scene
hooks. `installDeclaredPlumbing` qualifies context ids by stable instance, uses the normal
recordable command path, gates bindings by active instance, and registers knobs/Debug
rows through session-owned scoped ports. The template keeps its lantern label, prop count
and oil Debug choices; the legacy installer switches at SF16.

Frozen legacy code is preserved for Jake's A/B playtests. New and primary shards
follow the SDK flow above; do not add a manifest/plugin runtime.

- **The template** is [`src/shards/_template/`](../src/shards/_template/). It is the complete grey teaching level
  authored as shardfile data and admitted behaviour. Copy it; don't start from a real shard.
- **The API reference** is [ENGINE.md](ENGINE.md). Each step below links to its section.
- **The rules** are in [AGENTS.md](../AGENTS.md). The ones a shard author hits most are repeated where they apply.

| Shard | Slug | Status | Style | Look | README |
|---|---|---|---|---|---|
| Driftwood Isle | `driftwood-isle` | `live`, deck 1 | `toon` | extend: the clean chain, toon light and fog | [README](../src/shards/driftwood-isle/README.md) |
| Pine Hollow | `pine-hollow` | `live`, deck 2 | `pbr` | extend: the engine chain, a sky backdrop | [README](../src/shards/pine-hollow/README.md) |
| Nalati Grasslands | `nalati-grasslands` | `earlyAccess`, deck 3 | `painterly` | replace: its own composer | [README](../src/shards/nalati-grasslands/README.md) |
| Nine Dragon Stack | `nine-dragon-stack` | `experimental`, deck 4 | `jiehua` | extend: the engine passes, its own colour chain | [README](../src/shards/nine-dragon-stack/README.md) |
| Template | `_template` | `hidden` (Debug only) | `greybox` | extend: the engine chain only | [README](../src/shards/_template/README.md) |

## 0. Before you start

Read [AGENTS.md](../AGENTS.md) for the shared checkout, layer and testing rules.
Keep shard-specific content inside its own folder. Use the SDK authoring exports
and [commons catalogue](COMMONS.md); never import trusted SDK runtime facades.
If a needed behaviour has no admitted platform contract, record that API gap in
its live plan instead of adding runtime TypeScript.

Keep each shard's own picked style. HUD changes and visual variants follow
Jake's Debug/pick process; no URL switches. Use the existing portrait controls.

## 1. Copy the template

```bash
pnpm gen                                           # restore pinned template outputs before copying
cp -R src/shards/_template src/shards/<slug>
cp -R test/shards/_template test/shards/<slug>        # the headless contract test; point its relative imports at src/shards/<slug>/
```

Then, in the copy:

1. Edit identity and picker metadata in `data/card.json`, keeping the temporary root `manifest.json` discovery
   bridge synchronized until P3 catalog activation. A fresh `wildshard new` project starts with only a build-time identity.
2. Rename every `template.*` id (systems, events, actions, rows, save keys, Debug rows) to your own prefix. Ids are
   global: two shards with the same row id collide.
3. Keep only the platform rows and admitted behaviors your world uses; quest graphs live in `data/`.
   `shard.config.ts` assembles the declaration and its `output` block names source blobs and emitted sections.
   Build to `out/<slug>/`, then validate it.
4. Keep executable TypeScript in `generators/`, erased contracts in `*.d.json.ts`
   or `*.d.ts`, and shipped behaviour in admitted AssemblyScript. No primary runtime folder.
5. Build, run focused tests and boot standalone before publishing. The catalog/registry build owns app discovery;
   build-time data never enters it as executable imports.

Template's underscore keeps it hidden from the ordinary picker; its reference source layout is still checked.

### Checks on the shared machine

Land on types, scoped typed lint and `vitest related` in the working tree (G612,
G670); never run checks in the build mirror or copy the repository. Use a focused
test file for the changed behavior. For a standalone boot use the
stock `scripts/serve-build.sh --rev SHA --shard SLUG`; it releases the mirror
before serving. Every browser goes through `scripts/browser-lane.sh`.

## 2. The folder layout

The layout check (`scripts/check-shards.mjs`, from `lint/shard-layout.json`) runs at every commit that touches
`src/shards/**`. A file or folder outside this list fails it.

<!-- generated:shard-layout (node scripts/gen-shard-layout-doc.mjs, from lint/shard-layout.json) -->
**Primary shard source layout**

All source is build-time or erased declarations. Shipped behaviour is admitted WASM and data; primary shards have no runtime TypeScript.

| Required file | What it holds |
|---|---|
| `shard.config.ts` | build entry: serialisable declaration plus output blobs/custom/platform sections; builds out/<slug>/ |
| `README.md` | what the shard declares, its custom code and why, budgets, look, open work (its plan rows) |

| Allowed file | What it holds |
|---|---|
| `manifest.json` | authored discovery metadata; contains no runtime module |
| `ktx2.generated.ts` | your KTX2 table, written by `bake-ktx2` once you bake KTX2 art. The one generated file you commit |
| `discovery.generated.ts` | temporary generated discovery bridge; never hand-edit or commit it |

| Folder | What goes in it |
|---|---|
| `data/` | build-time authoring inputs and erased JSON type contracts; executable build logic belongs in generators/ |
| `generators/` | build-time source that emits admitted JSON, WASM and named assets; never shipped as runtime TypeScript |
| `behaviour/` | AssemblyScript entity and director scripts |
| `assets/` | source assets consumed by the build |
| `blender/` | the shard's retained Blender build sources and offline rig checks (build-time only; optional) |
| `test/` | optional source tests; never copied into the shipped product |
| `look/` | authored data, source assets and generated outputs; executable TypeScript belongs in generators/ |
| `quests/` | authored data, source assets and generated outputs; executable TypeScript belongs in generators/ |
| `thumbs/` | authored data, source assets and generated outputs; executable TypeScript belongs in generators/ |
| `explore/` | authored data, source assets and generated outputs; executable TypeScript belongs in generators/ |
| `boot/` | authored data, source assets and generated outputs; executable TypeScript belongs in generators/ |
| `creatures/` | authored data, source assets and generated outputs; executable TypeScript belongs in generators/ |
| `species/` | authored data, source assets and generated outputs; executable TypeScript belongs in generators/ |
| `quest/` | authored data, source assets and generated outputs; executable TypeScript belongs in generators/ |
| `world/` | authored data, source assets and generated outputs; executable TypeScript belongs in generators/ |

Root erased `*.d.ts` / `*.d.json.ts` contracts and explicitly declared product discovery outputs are also admitted.

Frozen legacy files keep their exact registered layout (**held for LD**). A `-legacy` suffix is not an exemption; the LEGACY entry and Developer buttons stay unchanged.
<!-- /generated:shard-layout -->

## 3. Author the product

`generators/product.ts` builds the declaration from authored data and the
`generators/output.ts` blob/section declarations. The thin `shard.config.ts`
imports that result; it does not run gameplay code. A source-function entry and
its output preparer share one immutable build context. Step ids name the same
recipe across both phases; either bundled source identity invalidates its cache.
Both callers still receive detached bytes and normal product admission. Write layouts and source
assets in the source folders above. Historical asset folders remain data-only;
they do not authorize executable TypeScript outside `generators/`.

Follow [SHARDFILE.md](SHARDFILE.md) for the admitted data contract and
[ENGINE.md](ENGINE.md) for platform hosts. Compile behaviour as AssemblyScript
using the existing entity/director contracts. Use named content-addressed files
for large payloads and declare their input identities in the producer registry.
Build and validate the real product; never ship a TypeScript plugin or an
`@wildshard/sdk/runtime/*` import from a primary shard.

Keep strings, spawn, bounds, equipment, quests, audio and look choices as data
in the admitted schemas. A new host still needs the [host bar](HOST-BAR.md).
Only exact registered frozen legacy files retain the earlier runtime APIs until
LD is authorized; the historical guide below is not an exception for new files.

## 14. Assets

- Your assets live in your folders: `public/assets/<slug>/`, `gpu/<slug>/`, `baked/<slug>/`, `music/<slug>/`,
  `sfx/<slug>/`, `horizon/<slug>-*`, `lut/<slug>.bin`, `title/<slug>-portrait.jpg`. List the extra ones in
  `assetGlobs`. An `/assets/…` path outside them fails `wildshard/shard-sandbox`.
- Declare every file the boot needs in `boot.files(tier)` / `boot.sources`, audio in `boot.audio`, Explore art in
  `boot.explore`. The loading bar and the offline cache read these lists.
- **Models:** follow the `mockup-to-model` skill. A Blender model is a script in `scripts/blender/<slug>/` with a row
  in `scripts/blender/targets.json`; commit the GLB, never a `.blend`.
- KTX2: once you bake KTX2 art, commit your `ktx2.generated.ts` and add `ktx2: () => import('./ktx2.generated')`.
- Commit images as JPEG; a `progress/` image over 500 KB is refused.

## 15. The guards it must pass

| Guard | Check |
|---|---|
| Primary source freeze; exact legacy carve-out | `pnpm exec oxlint src/shards/<slug>` (`wildshard/no-shard-runtime`, hard, no ratchet) |
| Source layout; registered generated transport only | `node scripts/check-shards.mjs` |
| Layer/public SDK imports and no cross-shard imports | scoped typed lint and the closed-component check |
| Real product contract and admitted WASM/data | `wildshard build` then `wildshard validate` |
| Behaviour and existing admission/lifetime fences | focused tests plus `pnpm exec vitest related --run <sources>` |
| Type contracts | `pnpm typecheck:root` and the touched warm layer projects |
| Committed source/storage/ratchet policy | `scripts/commit.sh`; request one normal `scripts/push-main.sh` tick |

Hard rules cannot gain a debt allowance. Strictness holds: no `any`, non-null
assertions, `as unknown as`, ts-ignore or blanket lint disable. Follow
[GIT.md](process/GIT.md) for bounded local checks and explicit CI deferrals.

## 16. The checklist: template → playable → live

### Template copied
- [ ] Folder copied, slug = folder name, `status: 'experimental'`, ids renamed, unused declarations deleted.
- [ ] `pnpm gen`, `tsc`, your contract test and `node scripts/check-shards.mjs` pass.
- [ ] `README.md` says what the shard is (it grows with the shard).

### Playable
- [ ] Ground, spawn, bounds; the player walks with 0 stuck (`node scripts/physics-baseline.mjs --no-build --mode=walk`).
- [ ] The look: a `LookStrategy` matching Jake's picked mockup.
- [ ] At least one weapon (rung 2 or 3 for a new idea), its cues and input context.
- [ ] At least one creature with its own brain and strikes.
- [ ] One quest step and its reward; strings for every line.
- [ ] Budgets and tier knobs; it holds 30 fps on the phone tier in a capture.
- [ ] It boots on a served build (`scripts/serve-build.sh`) with no errors; unload and reload leave the census clean.
- [ ] Portrait iPhone captures of every new thing, as boards in `art/<slug>/` for Jake.

### Live
- [ ] The gate's job for your shard is green on every push.
- [ ] Jake has played it and picked the board items.
- [ ] Open leftovers are rows of the shard's plan (never ask files, docs/process/ASKS.md), linked from your README.
- [ ] `status` moves `experimental` → `earlyAccess` → `live` on Jake's word, one commit each. `hidden` is for the template only.
- [ ] The README lists what the shard declares, its admitted behaviour, budgets, look and open work.

---

## History: the pre-normalization shard guide

This is the guide as it stood before GAME-NORMALIZATION (E357), kept as written for its history: the three shards'
first looks and systems, the Wildshard fundamentals, and Driftwood's low-poly pieces. **Its paths and steps are out of
date** (`ChunkDef`, `src/chunks/`, `CHUNKS`, `main.ts` branches, `?chunk=` links). Follow the sections above.

### Shards — Driftwood Isle, Pine Hollow, Nalati Grasslands (and how to add a fourth)

The demo runs one Wildshard *chunk* (we call an authored chunk a **shard**) at a time. Every shard is a 500 m × 500 m
floating slab with its own biome, built by the same engine from a `ChunkDef` (`src/game/shard/manifest.ts`) and listed in
`CHUNKS` (`src/game/shard/registry.ts`). Shards are picked on the title deck (or with `?chunk=<slug>`), and the page reloads
to switch — chunks are not adjacent or streamed.

**The deck order is `CHUNKS`' order:** Driftwood Isle first (the default, `DEFAULT_CHUNK`; the user's rule PH-U19), then
Pine Hollow, then Nalati Grasslands. A shard still being built carries a flag the deck shows on its card:
`experimental` (a hazard-taped EXPERIMENTAL band, and "Experimental · rough edges" under ENTER WORLD) or `earlyAccess`
(an EARLY ACCESS tag; playable by everyone). A shard **graduates** by dropping the flag — Pine Hollow did at the end of
its remaster (PINE-HOLLOW-REMASTER PH-S2).

**Each shard keeps its own style** (PH-U1). The shards share the engine and the house *pipelines* (mockup loops, Blender,
image-to-3D, the learned LUT fit, horizon painting, the rig bake), never each other's shading. A fourth shard picks a
look of its own.

### The three shards

| | Driftwood Isle | Pine Hollow | Nalati Grasslands |
|---|---|---|---|
| Def | `src/shards/driftwood-isle/manifest.ts` | `src/shards/pine-hollow/manifest.ts` + `pineHollowLayout.ts` | `src/shards/nalati-grasslands/manifest.ts` + `nalatiLayout.ts` |
| What | A small island in a bright ocean: the pier, a sailboat, the hut, a ring shrine, the wreck in the cove | A boreal pine forest round a sheltered hollow: the ranger's cabin, a still pond under a granite ridge, the old-growth, the mill hamlet | A high Tian Shan steppe: the braided Kunes, the nomad camp, the golden bowl of the Sky Grassland, Snow Lotus Valley in the snow ring |
| Style | **Faceted low-poly toon** (`style: 'lowpoly'`) | **Photoreal PBR** (`style` omitted = `'pbr'`) | **Painterly** (`style: 'painterly'`) |
| Deck | first, the default | second (graduated) | third (EARLY ACCESS) |

#### Driftwood Isle — faceted toon

- **Look:** no textures at all — flat-shaded, vertex-coloured facets (`Terrain.ts` by height / slope, `world/lowpolyKit.ts`
  for every model); a two-band toon ramp with coloured shadows and a rim (`world/stylize.ts`); a stylized gradient sky
  with faceted cumulus (`world/StylizedSky.ts`) on a 20 + 4 min day (`world/DayNight.ts`); the learned 33³ LUT
  (`world/lut.ts`, `public/assets/lut/driftwood-isle.bin`); the painted 360° horizon (`world/HorizonMatte.ts`); a faceted
  sea (`world/Ocean.ts`). `?island=blender` swaps the spawn cove for the Blender-baked one (`world/BlenderIsland.ts`).
- **Systems:** the castaway spine (`game/quest/Spine.ts` + `driftwood.ts`: Wendell, the three shards, the altar) ending
  at the Drowned Captain (`game/quest/Finale.ts`); the island's enemies (`entities/Enemies.ts`: reef crabs, coconut
  monkeys, the drowned sailor at night); a sword; swimming and diving; the interactables table
  (`world/interact/driftwood.ts`).
- **Sound:** its themes, the `audio/IslandAmbience.ts` zones, `audio/IslandSfx.ts`.
- **Code:** the low-poly modules in `src/world/` (the table at the end), wired in `main.ts` under `if (chunk.ocean)`; the
  adventure through `ADVENTURES` in `game/quest/Adventure.ts`; `src/dev/driftwood.ts` is the reference wiring.

#### Pine Hollow — photoreal PBR

- **Look:** Poly Haven PBR sets on a splat terrain with the boreal ground shader; the Blender-built species set (the hero
  Scots pine, fir, the old-growth giants, birch, snags, saplings — `world/treeSpecies.ts`, `world/treeSet.ts`,
  `scripts/blender/pine-hollow/trees/`) baked into the card + impostor LOD; one shared wind (`world/wind.ts`); a full day from seven
  pure-sky keys blended on a dome that re-lights the IBL (`world/PineDayNight.ts`, `pineSkyKeys.ts`); dawn ground fog
  and rain showers (`world/PineWeather.ts`, `PineWeatherFX.ts`); the pond, creek and waterfall on one water program
  (`world/waterSurface.ts`, `PineStreams.ts`); the painted far country at infinity (`world/Horizon.ts`); the Ridge's
  granite skin, its crag kit and the bear cave (`world/PineCrags.ts`, `scripts/blender/pine-hollow/crags/`); the learned LUT
  (`public/assets/lut/pine-hollow.bin`).
- **World:** the three cabins (`world/Cabin.ts`); the mill hamlet, the fire lookout + zipline, the footbridge, the
  standing stones, the waystones, the dam and the canoe (`world/PineLandmarks.ts`; the image-to-3D hero props in
  `public/assets/models/pine-hollow-hero/`).
- **Systems:** the ranger's lantern quest *The Warden's Hollow*, the lodge's rotating contracts, the trader and the
  miller, amber resin / carved tokens / secrets, the night thralls (`src/shards/pine-hollow/quest/`); the Antler King
  (`pinehollow/antlerKing.ts`, `kingModel.ts`, on the engine's `game/Boss.ts`) and four elites (`pinehollow/elites.ts`,
  `game/Elite.ts`); generated, rig-baked creatures in PBR coats with rarity and legendaries (`entities/pineCreatures.ts`,
  `pineCoats.ts`, `pineCreatureRigs.ts`); the small life — ravens, the owl, a woodpecker, hares (`pinehollow/life/`);
  the crossbow, the lever-action and the Warden's Longbow (`pinehollow/loadout.ts`); the hunter's journal and the trophy
  wall (the engine Compendium: `ui/compendium/` + `shards/pine-hollow.ts`, `world/TrophyWall.ts`); 19 achievements
  (`game/achievements.ts`).
- **Sound:** theme 1 (pine calm / tension) + calm-night, the King's three stems and the dawn sting; zoned beds and
  interior reverb (`audio/ForestAmbience.ts`); the generated one-shot sprite and the NPC barks (`audio/PineHollowSfx.ts`,
  `public/assets/sfx/pine-hollow/`).
- **Code:** `src/shards/pine-hollow/manifest.ts` + `pineHollowLayout.ts` (every site), `src/pinehollow/` (installed from
  `main.ts`), the `Pine*` modules in `src/world/`. Captures: `scripts/pine-hollow-views.mjs` (the 9-angle anchors),
  `scripts/pine-hollow-perf.mjs` (the phone / desktop ruler).

#### Nalati Grasslands — painterly

- **Look:** every mesh on the painterly shading (`world/painterly.ts`); a painted panorama sky + a day clock, a cloud sea,
  fog, the grade and the zone tints (`src/shards/nalati-grasslands/look/`); its own spruce factory (`trees.factory: 'spruce'`); three zones,
  each in its own colour (the green valley, the golden bowl, the snow ring).
- **Systems:** its own kit — bow, sabre, spear (`player/nalatiKit.ts`) — and riding (`nalati/ride.ts`); the quest core
  with three chapters (`game/quest/nalati.ts`, `nalati/adventure.ts`); two bosses, the Golden King in his kurgan
  (`nalati/kurganBoss.ts`) and the Storm Titan (`nalati/stormTitan.ts`); elites, stealth, kokpar, the night riders, the
  storm (`src/nalati/`); generated creature hulls rig-baked to the species' skeletons (`entities/creatureRigBake.ts`,
  `public/assets/nalati/models/`).
- **Sound:** the Kazakh score and Nalati's sound set (`nalati/sound.ts`).
- **Code:** `src/nalati/`, `src/shards/nalati-grasslands/world/`, `src/ui/NalatiHUD.ts`, `src/dev/nalati-*.ts`. (On main since v0.3.0;
  the Pine Hollow branch picks it up when it merges main in.)

### What the shards share (the engine)

`bootstrap()` and the boot plan (`core/bootstrap.ts`, `boot/`), Rapier physics and the navmesh (`physics/`), the player and
the weapons, `Animal` / `AnimalManager` / the species registry (`entities/species/`), `Elite` / `Boss` and their bars, the
creature rig bake, the interactables kit (`world/interact/`), the quest core (`game/quest/quest.ts`, `QuestUI.ts`), the
Compendium, Progress + achievements, Explore World (`explore/`), the HUD and the title deck (`ui/`), the per-shard LUT.
The pipelines take the shard as an argument: `scripts/blender/build.sh <slug>/<target>` (`scripts/blender/<slug>/`), `fit-lut.py --shard`,
`scripts/horizon-matte/`, `scripts/img2mesh/`.

### Adding a fourth shard

1. **Pick its style.** Not one of the three (PH-U1). Run a mockup loop first (`art/<shard>/round-<n>-<label>/`) and let
   the user pick from a board.
2. `cp src/chunks/_template.ts src/chunks/<slug>.ts`, rename the export, fill in every field (the template comments
   explain each one; the table below says what each drives). Keep every coordinate in a `<slug>Layout.ts` beside it.
3. Art for the deck: a 640×360 `src/chunks/thumbs/<slug>.jpg` (no crossbow in frame) + the portrait and landscape hero
   backdrops. Until it is authored it can sit in the deck as a teaser (`src/chunks/placeholders.ts`).
4. Add the export to `CHUNKS` in `src/game/shard/registry.ts` — **after** the three (Driftwood stays first) — with
   `experimental: true` or `earlyAccess: true` until it graduates.
5. Bake it: `scripts/bake-chunk.mjs` (the terrain, fingerprinted), `scripts/bake-navmesh.mjs <slug>`, then the byte and
   pack tables (`scripts/bake-packs.mjs`).
6. Its own nouns on the loading screen: a `SHARD_STEPS` entry in `src/engine/boot/steps.ts` (each step names what it really
   builds there; `test/boot-plan.test.ts`).
7. Its game layer: an adventure (`ADVENTURES` in `game/quest/Adventure.ts`, or a `src/<shard>/` installer called from
   `main.ts` as Pine Hollow and Nalati do), an achievements table (`TABLES` in `game/achievements.ts`), a compendium
   (`ui/compendium/shards/<slug>.ts`) if it hunts, and its sound.
8. `npx tsc --noEmit`, `pnpm lint`, `pnpm test` (`test/chunks.test.ts` checks every def), then
   `http://localhost:5173/?chunk=<slug>&nolock=1&skipintro=1`; screenshot it headlessly (`docs/SUBAGENT-BRIEF.md`) on
   the phone and the desktop, and give it rows in `bench.budget.json`.

Nothing outside `src/chunks/` has to change for a shard that reuses the engine's pieces as they are; new trees,
creatures, dressing or a new style are engine work (below).

### What is fixed by the Wildshard fundamentals

E357 B83: the four original world-grid shards retain the four midpoint entry trails below; new shards (including experimental and hidden teaching shards) declare their own roads and need at least one trail starting in the spawn area.

These live in `src/engine/core/config.ts` and `src/engine/world/terrainField.ts` and are **not** per shard:

| Rule | Where it is enforced |
|---|---|
| Chunk is 500 m square, origin at the centre, spans ±250 on X and Z | `CHUNK_SIZE`, `CHUNK_HALF` |
| 100 m of rock under the surface (the floating slab) | `CHUNK_DEPTH`, `Terrain.buildSlab()` |
| A 15 m wide entry road at each of the four edge midpoints | `ROAD_WIDTH`, `entryRoadMask()` in `terrain.ts` |
| Each road reaches ≥ 50 m into the chunk (we use 60) | `ROAD_LENGTH` |
| Roads are level with no-man's-land (y = 0) at the boundary and ramp up inside | `buildTerrain().heightAt` |
| Terrain mesh resolution 256² | `TERRAIN_RES` |
| Boundary wall / no-man's-land warning at the edges | `src/engine/world/Boundary.ts`, HUD |

`buildTerrain()` applies the road levelling on top of *any* landscape you write, so a shard cannot
break the contract by accident — but keep the first segment of the four entry trails exactly as in
the template so the dirt texture and prop placement follow the road.

### What each `ChunkDef` field does

| Field | Drives | Notes |
|---|---|---|
| `id`, `slug`, `displayName`, `gridCoords` | HUD chunk panel, loading screen, title screen, `?chunk=` | `id` is `chunk://local/<slug>` |
| `seed` | every `Rng` / `Noise2D` in the engine (`SEED` in config is a live binding of it) | pick a fresh one per shard |
| `treeCount` | `Forest` places at most this many trees | `TREE_COUNT` live binding |
| `biome`, `blurb`, `thumbnail`, `heroPortrait`, `heroLandscape` | the title deck (the blurb is the card's tooltip: one pitch in the house voice) | |
| `experimental`, `earlyAccess` | the deck's EXPERIMENTAL band / EARLY ACCESS tag | dropped when the shard graduates |
| `terrain` | `heightAt/normalAt/splatAt/trailDistance/cabinMask/pondMask/waterLevel`, `TRAILS`, `CABIN_SITES`, `POND` re-exported by `src/engine/world/Heightfield.ts` | built by `buildTerrain(seed, spec)` |
| `terrain` spec → `landscape(x, z, noise)` | raw height before roads/pads/trails/pond | use the seeded `noise.n` / `noise.n2` |
| `terrain` spec → `trails` | trail beds, dirt splat, prop placement (`Props`), tree exclusion, animal placement | polylines in metres |
| `terrain` spec → `cabinSites` | `Cabins` builds one log cabin per site on a flattened pad | exactly what `Cabin.ts` expects: `{x, z, rot}` |
| `terrain` spec → `pond`, `pondFill` | basin dished into the landscape, `Water` surface, reeds/ferns/mist around it | omit `pond` for a dry shard (Water is skipped) |
| `terrain` spec → `splat(x, z, t, noise)` | four ground-layer weights for the terrain shader | any scale; normalised |
| `assets.groundLayers` | the four PBR sets blended by `splat` (DataArrayTexture) | ids under `public/assets/tex/` |
| `assets.groundTints` | per-layer albedo multiplier in the terrain shader | linear RGB |
| `assets.slabRock` | PBR set for the slab walls | |
| `trees.factory`, `trees.set` | which tree builder `bootstrap()` uses (`TREE_FACTORIES`), and the Blender species set it plants | `'pine'` (Pine Hollow; `set: 'pine-hollow-trees'`), `'spruce'` (Nalati) or `'none'` (no `Forest` trees: Driftwood's palms are their own builder, `src/shards/driftwood-isle/world/Palms.ts`) |
| `trees.bark`, `trees.twigAtlas` | trunk PBR set, twig atlas folder for the baked branch cards | |
| `trees.noun` | "2,600 pines" on the title screen | |
| `forest.*` | candidate spacing, clearing noise, slope limit, foliage HSL tint, big-variant share | see `Forest.place()` |
| `fauna[]` | `AnimalManager` herd plans: kind, count, optional anchor ring, canopy vs clearing, trail band, `variants` | `kind` is any registered species (`src/engine/entities/species/`: deer, boar, elk, bear, crab, monkey, sailor, captain); `FaunaKind` is `'deer' \| 'boar'` widened to any string, checked against the registry by `test/chunks.test.ts` |
| `sky.hdri` | HDRI for IBL + background; the sun direction is its brightest pixel | stems in `public/assets/hdri/` |
| `sky.sunColor/sunIntensity/envIntensity/bgIntensity` | CSM sun, environment and background strength | |
| `sky.fogSunColor`, `sky.cloudSunColor`, `sky.hemi*` | fog in-scatter tint, cloud layer tint, hemisphere fill | |
| `atmosphere.fog*` | exponential height fog + distance fog (`Atmosphere.ts`, also read by `Volumetrics`, `Water`, `Particles`) | |
| `atmosphere.volumetricSunColor` | god-ray colour | |
| `grade.*` | composer: saturation / brightness / contrast / bloom + `GradeEffect` split-tone | display-space |
| `spawn` | where the player stands on enter and respawn; `?x= ?z= ?yaw=` override | |
| `style` | `'pbr'` (default: textured splat terrain, PBR slab — Pine Hollow), `'lowpoly'` (Driftwood Isle: no textures at all — `Terrain.ts` builds flat-shaded, vertex-coloured facets by height/slope) or `'painterly'` (Nalati) | every lit thing in a lowpoly shard is `MeshStandardMaterial({ flatShading, vertexColors })` on non-indexed geometry |
| `weapon` | `'crossbow'` (default) or `'sword'` — the first-person weapon main.ts hands the player | |
| `ocean` | open water over the whole shard: `level` (sea surface, m), `shallowColor` / `deepColor` (linear RGB albedo — keep them dark, the midday sun + sky here add up to ~3×), `deepDepth` (m below the surface at which the water is fully deep) | `src/shards/driftwood-isle/world/Ocean.ts` (faceted, animated, depth-coloured, foam band) replaces `Water`; `Boundary` / `Horizon` sit on the surface and draw islets instead of ridges; pass `oceanLevel: ocean.level` to `buildTerrain` so `waterLevel()` agrees |
| `terrain` spec → `oceanLevel` | `waterLevel()` for an open-water shard (no pond dish) | the entry roads are still forced to y = 0, so a level a little above 0 makes them submerged sandbars under the piers |

### Tuning tips

- **Look first at the landscape.** `?chunk=pine-hollow&x=0&z=-235&yaw=3.1416&pitch=0&nolock=1&skipintro=1` is
  the south gate looking in; the pond pose is `?chunk=pine-hollow&x=-56&z=95&yaw=3.1416` (yaw 0 faces −z, away
  from the pond). The 9-angle cameras of five Pine Hollow anchors are in
  `art/pine-hollow/round-0-baseline/cameras.json` (`scripts/pine-hollow-views.mjs`). Take headless screenshots and read them.
- Keep the landscape within about −10..+40 m. Roads are forced to y = 0 at the edges, so a landscape
  that sits at +30 m near an edge gets a steep 60 m ramp.
- Cabin pads flatten a ~20 m radius; put sites on gentle ground, > 40 m apart, off the trails.
- `pondFill` above ~2 m floods the surroundings; the basin is dished ~3 m under the water line.
- `splat` weights are blended with a power curve in the shader; a layer under 0.1 barely shows.
- Sun colour + `fogSunColor` + `volumetricSunColor` + `cloudSunColor` should agree with the HDRI
  (pull them from its sun pixel), or the fog reads as a different time of day than the sky.
- The whole def is deterministic: same seed, same shard, every load.

### What is engine work (not a def field)

- **A new style** — `style` picks the terrain and material path (`'pbr'`, `'lowpoly'`, `'painterly'`); a fourth look is a
  new branch in `Terrain.ts` / `Sky.ts` and its own shading module, the way `stylize.ts` and `painterly.ts` are.
- **New trees** — `trees.factory` picks a builder in `TREE_FACTORIES` (`src/engine/core/bootstrap.ts`): `'pine'` (the baked
  card + impostor LOD; with `trees.set` it plants a Blender species set, `world/treeSet.ts`), `'spruce'` (Nalati) or
  `'none'` (Driftwood's palms are their own builder, `world/Palms.ts`).
- **A new animal** — one file in `src/engine/entities/species/<kind>.ts` ending in `registerSpecies({...})` (the contract is
  `src/engine/entities/species/registry.ts`); a def names it by `kind` in `fauna[]`. Generated hulls go through the rig bake.
- **Grass, undergrowth, props, particles** (`Grass.ts`, `Undergrowth.ts`, `Props.ts`, `Particles.ts`) use the shard's
  seed, terrain and pond, but their *content* is forest dressing; Driftwood and Nalati build their own
  (Nalati: `world/nalati/dressing/`).
- **The cabins** are the same log cabins on every non-ocean PBR shard (a def chooses only where, `cabinSites`); Pine
  Hollow adds the hamlet's buildings on the same kit.
- **The attract-mode camera path** (`src/engine/core/Tour.ts`) follows Pine Hollow's trails.
- **A shard's code as one module** (`ShardModule { build, look, quest, audio, fauna, loadSteps }`, ENGINE-FIT E5) is not
  built yet: each shard still branches in `main.ts` (moved to PINE-HOLLOW-FOLLOWUPS by PH-U32, archived `project/archive/2026-09-30-pine-hollow-followups.md`).

### Driftwood Isle — the low-poly pieces

The second shard (`src/shards/driftwood-isle/manifest.ts`, `style: 'lowpoly'`, `ocean`) is built from
flat-shaded vertex-coloured modules, each one mesh, each exposing `colliders` for
`player.colliders` and (where you can stand on it) `floorHeightAt(x, z)` for `player.platforms`.
`src/dev/driftwood.ts` is the reference wiring; main.ts mirrors it under `if (chunk.ocean)`.

| Module | What | Placement |
|---|---|---|
| `world/Ocean.ts` | faceted sea to the horizon, depth-coloured, foam band, `update(dt)` | `ChunkDef.ocean` |
| `world/Pier.ts` | jetty on rope-wrapped pilings, `bollards`, `posts`, `mooringsFor()` | the south entry road + `JETTIES` (N / W / E) |
| `world/Boat.ts` | moored sailboat, bobs in `update(dt)`, `ropes` mesh to the pier | beside the south pier |
| `world/Boulders.ts` | faceted rocks, `scatterShore(seed)` | the water line |
| `world/Hut.ts` | thatched stilt hut with porch + steps | `HUT` on the `PLATEAU` crag |
| `world/Palms.ts` | coconut palms with a vertex-shader sway, `scatterIsland(seed, n, avoid)`, `update(dt)` | beach top + groves |
| `world/Lookout.ts` | watchtower with stair and banner | `LOOKOUT` on the `HEADLAND` summit |
| `world/Wreck.ts` | beached two-master, cargo and driftwood | `WRECK` in `COVE` (east) |
| `world/Shrine.ts` | ring shrine on a dais with standing stones | `SHRINE` (north-west knoll) |
| `world/Bushes.ts` | shrubs with red hibiscus, `scatterIsland(seed, n, avoid)` | beach top + clumps inland |

The landscape is one function of the constants above (island disc, plateau, headland, cove,
shrine knoll), so moving a POI is a one-line change; the entry roads stay forced to y = 0 and are
the jetties' submerged sandbars. `scripts/bake-chunk.mjs` fingerprints the landscape into the bake
header and `BakedTerrain.ts` refuses a bake that does not match the live def, so a stale
`terrain.bin` (from before a def edit, or a service-worker copy) falls back to the analytic field.

The platform grid is assembled by `GridAssembly` from `game/grid/singleplayer.json`'s
separate `grid` section. Its stable instance ids own saves and facts; signed cells derive
render translations at 555 m pitch without entering local simulation state. Developer
and DEVSERVER replacements keep their existing slug identities. Missing outer neighbours
supply an open-sea, road-level edge and fog profile. Grid bounds pass a `grid` predicate
to `installBounds`: the grid driver owns horizontal traversal, while authored fall recovery
and standalone play bounds retain their existing behavior. Physics world changes and
fixed-step crossing notifications are supplied by the residency driver (SF18a).

Grid residency installs `game/grid/rules` with live cell-local provenance. Board cruise
is 30 m/s on the physical highway deck, easing across the 20 m strip to the admitted
`traversal.hoverCap` (default 15 m/s; an author may lower it). Standalone cruise stays
14 m/s. Visible neighbours are read-only: `gridCanAct` rejects their actions, and
`GridCombatRules` rejects damage before target reactions when either actor is outside
the writable interior or their stable instances differ. Terminal authored fall recovery
retains its separate path. Creature-only Rapier borders and the physics-owned movement
constraint cover ground, far and flying bodies. A scoped mounted passage suspends only
that home boundary; real WORLD colliders keep stopping the mount. `reframeGridUnit`
prepares rider and mount together without changing their velocity, yaw or separation;
the physics/residency driver commits their motors together.

A reload Debug row that changes the playable footprint or fall floor selects
`runtime.hooks.levelBounds(authored)` during world or kit setup. The game samples
it once before installing normal bounds recovery. Keep the manifest's shipping
bounds unchanged; the hook belongs to that session and never mutates a global
floor shared by another level.

### Frozen standalone legacy copies (SF73, G263–G265)

The six transitioned primary folders remain the SHARDFILE/grid authoring source. Their exact registered `-legacy`
copy is frozen, standalone only, with its own slug and local save namespace. The existing LEGACY button resolves to
that copy; SHARDFILE resolves to the primary. Only the primary card is shown. Copies never enter the grid catalogue.

All six primary entries admit their current data through the hybrid loader before running their trusted runtime.
Sky Reach, Signal Dunes and Nine Dragon use the same standalone entry-choice contract as Driftwood, Pine and Nalati.
Their regional resolver still returns the exact native constructor; unported gameplay and presentation remain trusted
runtime work. A failed data admission never starts the native world.

`lint/legacy-shards.json` is the reviewed inventory: primary/copy, immutable source SHA, and every file hash. Only
those exact files leave primary SF2, soft-debt, platform-share and measured layer-edge counts. Every hard layer,
public-index, cycle and lint rule still runs. No suffix-based exemption exists. The sealed inventory can only shrink.
Feature edits refuse; a necessary crash fix updates the affected hashes and carries `Legacy-Crash-Fix: <reason>`.

The composition root installs the inventory's exact content-identity table. Frozen content keeps its original
item-family namespace, while its manifest/source identity, instance, feedback, flags, state and ledger keys retain
the copy slug. A fresh runtime-bound field in a registered copy uses its declared default and never invokes the
primary's historical migration callback; ordinary shard migration is unchanged. Initialized copy fields restore
only their copy-owned values. The reviewed Nalati adventure and Driftwood effects guards compare content identity;
their original/current hashes and reasons are inventoried individually, with no broader rewrite permission.

Frozen Pine `debug/options.ts` and `runtime/audio/score.ts`, and frozen Signal `look/groundTiles.ts`, retain their
original primary device-tuning reads by review. They share tuning, never primary gameplay progress. Removing the
primary Signal row leaves its frozen reader at its default.

Copies share existing public asset paths and Git blob identities: no new GLB/texture payloads are emitted. Map/build
discovery skips only the registered copies. Frozen map metadata is provenance, not a new primary freshness claim;
the shared public map raster may update with the primary and must remain loadable by the legacy entry. Primary map
freshness checks and authoring builds are unchanged.

At 80/20, remove the entire legacy folder and its inventory row together. Before entering the surviving primary,
call `migrateRetiredLegacySave(store, primarySlug)` from the game retirement installer. It durably copies missing
local entries; newer primary values and a primary reset barrier win. Failure leaves the durable destination intact
and the source available for retry. It does not touch the profile or other shards. Do not merge while both entries
coexist; retain the source until the retirement migration succeeds.

## Hover speed class (G540)

A discovery manifest may set `hoverSpeedClass: 'road'` to keep the grid's
30 m/s board cruise inside a padding shard, including direct standalone entry.
Absent or `'shard'` retains the ordinary 14 m/s interior cruise; the entry
strip still eases into road speed.
Platform open plots declare the same road class in their catalogue rows.
The six main shards and Showcase use the default class.

While hovering, Developer shows a BOOST toggle beside HOVER on the shared
HUD (touch or desktop). It starts off, gives 60 m/s on roads and padding,
and 56 m/s in ordinary interiors, with a smooth transition over the strip.
The Player gates the boost with Developer on every step, so a retained
latch cannot boost the public build.
