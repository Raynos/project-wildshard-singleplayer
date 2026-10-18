# Plan: SHARD-PLATFORM-NEXT — the stretch goals after 80/20 (old Part B)

**State:** `open` — starts when [SHARD-PLATFORM](SHARD-PLATFORM.md) is done (the 7 shards at their wave lines, Template 2, the 3 × 3 grid). Nothing here is worked before then.

Jake, 2026-10-13: *"I don't want to cut the plan. I don't want to delete stuff from the plan. But I do think it's time to break the plan … we already had like a section B, like the after 80-20 like stretch goals. Well, that can go into a second plan."* (G417). Decisions stay in [shard-platform/decisions.md](shard-platform/decisions.md).

## Rows

- **N1** Sky and Signal from 90/10 to zero (G423): delete both W1 runtimes in one landing after features F1–F7 (the data client owns every bound section, painted-look section, effects section and host, textured prop tiles, graphs on skinned creatures, a terrain skirt row, graph inputs); keep Sky's meadow and wakes custom; drop Signal's roaming firelight after a before / after board; ~280 lane-hours; plan in `progress/shard-platform/w1-residue-2026-10-14/README.md` — open
- **N2** Every shard runtime-deleted, then the hybrid host deleted (G426): after N1, Pine, Driftwood, Nalati, Nine (and any other shard with a trusted runtime) go from their 80/20 line to "runtime deleted" (`runtime.binds` empty, no `plugin.ts` / `runtime/`), each the way N1 plans it for Sky and Signal; the hybrid-host code in game / engine (~3,100+ lines that only host trusted runtimes) is deleted with the last runtime — open
- **N3** The engine performance and FPS pass (G437): after every shard is on the shardfile, a full pass of strong optimisations on the engine, shader graphs included (per-draw CPU cost of graph materials, G436), plus FPS tuning per shard and in the grid; the analysis of why graph draws cost more is `progress/shard-platform/graph-draw-cost-2026-10-15/` — open
- **N4** The engine and game quality pass (G481): grade every host in `src/engine` and `src/game` (and `src/sdk`, `src/format`) on the six-test host bar ([docs/HOST-BAR.md](../HOST-BAR.md)), fix or move back every borderline and silly host, re-grade the G473–G478 features, and report net platform lines: Jake, 2026-10-17: *"I'm really, really worried that we just punched the engine in the face. That we just made a really shitty engine to accelerate the progress towards shard file migration"* — open G496 adds the E487 fixes: `game/loadout/held.ts` (Pine's rifle/longbow/crossbow as class checks) to weapon rows; platform word lists (`format/questStory.ts:6`, `game/quest/trader.ts:17`, `compendiumRows.ts:21`, `lootEconomy.ts:31,34`, `heldEquipment.ts`, `questSteps.ts:9`) to shard-declared strings; features out of `src/game/plugin/` (`heldEquipment.ts`, `heldTool.ts`, `HeldLauncher extends Weapon`); the hosts the 10-17 independent re-score puts under 5/6.
- **N5** Delete the legacy runtime plugin system (G481, with N2): when every shard's runtime is at zero and the shardfile migration is finished, delete `src/game/plugin/`'s migration scaffolding (`HybridRuntimePlugin`, the subclass hooks, the page/quest stage wiring) and every host only it used — open
- **N6** Permanent architecture docs (G481): write down what is permanent after SHARD-PLATFORM: the shard model (shardfile, sections, data, AssemblyScript, what a closed shard is), the engine and the game (layers, hosts, the host bar, the Script ABI), in `docs/` — open
- **S1** Crowds of hundreds — stretch
- **S2** Interiors and verticality — stretch
- **S3** New physics toys and vehicles — stretch
- **S4** New player modes — stretch
- **S5** Restricted shader code — stretch
- **S6** The WebGPU spike — stretch
- **S6b** Horizon impostors — stretch
- **S7** Standard rigs — stretch
- **S8** Adaptive music — stretch
- **S9** The sandboxed UI panel canvas — stretch
- **S10** Shared world state with reset rules — stretch
- **S11** Signposts — stretch
- **S12** The phone QR — stretch
- **S13** The one-click Vercel preview — stretch
- **S14** Bot playtests — stretch
- **S15** The AI playtester — stretch
- **S16** Starters — stretch
- **S17** /wildshard-quickstart — stretch
- **S18** wildshard upgrade — stretch
- **S19** The outside-author trial — stretch
- **S20** Grid-wide events — stretch
- **S21** Laptop GPU headroom — stretch
- **S22** Quest, dialogue and encounter generators — stretch

## Row text (moved from rows.md)

Jake (G57): *"Stretch goals at the bottom like "crodws of hundreds of creatures", "interiors", "physics toys", "ai playtesters", "one lcick vercel preview". Basically anything in the plan that's being built that is not being used in the 6 shards today, goes to the bottom of the plan as stretch goals."* Each starts only after Part A, or earlier when a shard's port needs it. Their decisions in §10 stand; done-whens are written when one starts.

| Row | Was | What |
|---|---|---|
| S1 | SF31 | **Crowds of hundreds**: beyond today's far herd (which is Part A, SF27), hundreds of LOD-AI creatures or NPCs |
| S2 | SF32 | **Interiors and verticality**: stacked spaces with streaming and occlusion culling |
| S3 | SF30, SF20b, SF20c | **New physics toys and vehicles**: boats, carts, gliders, ragdolls, destructibles; a **highway car** (G60: the hoverboard covers 30 m/s in Part A) and **auto-path** along the highway (G33, G39, G40) |
| S4 | SF34 | **New player modes** (climb, drive) and **author movement modes** in AssemblyScript (G14); swim is Part A (SF34) |
| S5 | SF35 | **Restricted shader code** (G4 stage 3) as an author-machine compiler into the graph format; the graphs themselves moved to Part A (SF59, G155) |
| S6 | SF37 | **The WebGPU spike**, default-off behind a Debug row (G32) |
| S6b | SF23 | **Horizon impostors** beyond ~2.5 km, only for a grid whose sightline passes the direct neighbours (G38; mostly moot after G76) |
| S7 | SF26 | **Standard rigs** (humanoid, quadruped, bird, serpent, insect) and a shared clip library (G8) |
| S8 | SF29 | **Adaptive music**: director-driven stems beyond today's calm / tension, reverb zones (G24) |
| S9 | SF28 | **The sandboxed UI panel canvas** for minigames (G22) |
| S10 | SF33 | **Shared world state with reset rules**, and later **player building** after three building shards (G7) |
| S11 | SF17c | **Signposts**: author and rating on the road signs (G35; the shard-name and distance signs are Part A, G80 / G81 / G100) |
| S12 | SF38 | **The phone QR** in `wildshard dev` (G2) |
| S13 | SF39 | **The one-click Vercel preview** (G2) |
| S14 | SF40 | **Bot playtests** at validate: every quest objective reached, no stuck spots (G16) |
| S15 | SF41 | **The AI playtester** with Clef / Jev (G31) |
| S16 | SF42 | **Starters**: `npm create wildshard` with three starter shards (G15) |
| S17 | SF43 | **`/wildshard-quickstart`** (G47) |
| S18 | SF44 | **`wildshard upgrade`** and a version window past "rebuild every build" (G29) |
| S19 | SF16 | **The outside-author trial**: a clean-room agent builds the battery shard from the SDK tarball alone (A6) |
| S20 | — | **Grid-wide events** through the director's reserved subscriptions (G36) |
| S21 | SF0b | **Laptop GPU headroom**: a quality tier for weaker laptop GPUs (MSAA, grass density) default-off behind a Debug row, measured on a real lower-end laptop |
| S22 | SF54 | **Quest, dialogue and encounter generators** (G141): shared build-time authoring helpers in the commons that emit validated quest graphs, dialogue trees and phase tables as rows (callable from a skill) |
