**1. Verdict — five lines**

The plan is salvageable, but **P1–P6 are not a sound implementation sequence for the stated goal**.  
Its biggest flaw is postponing the package, execution boundary and multiplayer proof until after a large catalogue and conversion programme ([plan:123](../../../../../docs/plans/SHARD-PLATFORM.md:123)).  
P0 contains real work, but establishes narrower guarantees than “rows are serialisable,” “world contract” and “ratchet” suggest ([plan:137](../../../../../docs/plans/SHARD-PLATFORM.md:137)).  
The 80/20 figures are conversion estimates; the implemented metric measures remaining TypeScript lines against historical totals, not platform readiness ([metric:31](../../../../../scripts/shard-platform.mjs:31)).  
Jake’s package-first decision corrects the direction; it is now recorded, but the phase rows still need replacing ([plan:260](../../../../../docs/plans/SHARD-PLATFORM.md:260)).

**2. Claims checked**

Read-only audit; I created, edited, staged and committed nothing. Code measurements were taken at `4574d15f2`, with historical checks at the plan’s stated audit revision, `06de6df0e`, and metric baseline, `b96fed1a1`. Another agent committed the package-first acknowledgement, `a7efb8ff6`, during this audit; I incorporated it.

I ran the metric and row-check scripts, targeted engine lint, the WebGPU inventory check, in-memory metric counterexamples, and the world test’s sampling procedure against the real manifests. I did not run a build, full test suite or phone session.

For historical counts, I enumerated tracked `src/shards/**/*.ts` and `.tsx` using `git ls-tree`, read each with `git show`, excluded `.d.ts`, and counted newline characters—the metric’s own counting convention. API counts additionally used the TypeScript AST, including optional property access and excluding comments.

**Audit numbers**

| Claim, source | Verdict | Evidence |
|---|---|---|
| Driftwood: “18,766” lines ([plan:58](../../../../../docs/plans/SHARD-PLATFORM.md:58)) | **False** at cited revision | Historical recount at `06de6df0e`: **18,803**. The stated number matches the later `b96fed1a1` baseline. |
| Pine Hollow: “21,716” ([plan:59](../../../../../docs/plans/SHARD-PLATFORM.md:59)) | **False** | Historical recount: **21,762**. Later baseline: **21,698**. Neither is 21,716. |
| Nalati: “33,094” ([plan:60](../../../../../docs/plans/SHARD-PLATFORM.md:60)) | **False** at cited revision | Historical recount: **33,115**. The stated number matches the later baseline. |
| Nine Dragon: “25,166” ([plan:61](../../../../../docs/plans/SHARD-PLATFORM.md:61)) | **False** at cited revision | Historical recount: **25,177**. The stated number matches the later baseline. |
| Signal Dunes: “4,826” ([plan:62](../../../../../docs/plans/SHARD-PLATFORM.md:62)) | **True** | Historical recount: **4,826**. |
| Sky Reach: “6,893” ([plan:63](../../../../../docs/plans/SHARD-PLATFORM.md:63)) | **True** | Historical recount: **6,893**. |
| Template: “554” ([plan:65](../../../../../docs/plans/SHARD-PLATFORM.md:65)) | **True** | Historical recount: **554**. |
| All six: “110,461”; “Line counts are exact” ([plan:52](../../../../../docs/plans/SHARD-PLATFORM.md:52), [plan:64](../../../../../docs/plans/SHARD-PLATFORM.md:64)) | **False** | The six historical totals sum to **110,576**. The printed table sums correctly, but does not describe its cited commit. |
| “`ctx.app` … 127 times” ([plan:101](../../../../../docs/plans/SHARD-PLATFORM.md:101)) | **False** | Historical AST: **97** property references, including optional access; literal `ctx.app`: **95** occurrences on **85** lines. |
| “`ctx.game` 86 times” ([plan:101](../../../../../docs/plans/SHARD-PLATFORM.md:101)) | **False** | Historical AST: **103** references; literal matches occupy **92** lines. |
| Newest two shards use “`ctx.game.runtime` 61 times” ([plan:102](../../../../../docs/plans/SHARD-PLATFORM.md:102)) | **False** | Historical AST: **32** across Sky Reach and Signal Dunes; **52** across all shard folders. |
| Shard subclasses: “`Weapon` 10” ([plan:103](../../../../../docs/plans/SHARD-PLATFORM.md:103)) | **False** | AST finds **3 direct** subclasses and **8 including indirect descendants**. Direct classes: TemplateWhip, WarFan, Bullwhip. Plain text counting also catches Bullwhip’s explanatory comment. |
| Shard subclasses: “`Tool` 4” ([plan:103](../../../../../docs/plans/SHARD-PLATFORM.md:103)) | **False** | **2**: TemplateLantern and FeiZhua; see [TemplateLantern:5](../../../../../src/shards/_template/weapons/TemplateLantern.ts:5) and [FeiZhua:257](../../../../../src/shards/nine-dragon-stack/grapple/FeiZhua.ts:257). |
| “`CreatureBrain` 13” ([plan:103](../../../../../docs/plans/SHARD-PLATFORM.md:103)) | **True** | Historical AST finds **13**, including the template. |
| “`Boss` / `BossBrain` 6” ([plan:103](../../../../../docs/plans/SHARD-PLATFORM.md:103)) | **True** | Historical AST finds **2 + 4**, including the template. |
| “about 110 shard files hold GLSL or a `ShaderMaterial`”; “46” use `patchShader` ([plan:77](../../../../../docs/plans/SHARD-PLATFORM.md:77)) | **Unverifiable / false**, respectively | No reproducible definition or file list supports 110. The inventory finds **47 shader-patch files**, **52 ShaderMaterial files**, **92 distinct files across those groups**. Historical literal `patchShader` also appears in **47** files. [Inventory implementation:25](../../../../../scripts/webgpu-inventory.mjs:25). |
| WebGPU inventory: “92 shader patches, 114 `ShaderMaterial` sites in 68 files” ([plan:181](../../../../../docs/plans/SHARD-PLATFORM.md:181)) | **True** | Executed `inventory()`: **92 / 114 / 68**; `node scripts/webgpu-inventory.mjs --check` passes. |

The count errors do not invalidate the need for migration. They invalidate presenting this table as an exact, reproducible audit.

**The percentages**

The plan explicitly labels its buckets as estimates with ±5 percentage points ([plan:52](../../../../../docs/plans/SHARD-PLATFORM.md:52)). That qualification matters. However, P5 relabels those estimates as **“Custom today”**, despite the executable metric treating all current shard TS as runtime.

| Claim, source | Verdict | Evidence |
|---|---|---|
| Driftwood “5%” custom today ([plan:191](../../../../../docs/plans/SHARD-PLATFORM.md:191)) | **Exaggerated** | Plausible proposed residual, not measured current share; script reports **102%**. |
| Sky Reach “16%” ([plan:192](../../../../../docs/plans/SHARD-PLATFORM.md:192)) | **Exaggerated** | Script reports **101%**; devices and logic replacing its code do not yet exist. |
| Pine Hollow “15%” ([plan:193](../../../../../docs/plans/SHARD-PLATFORM.md:193)) | **Exaggerated** | Script reports **102%**. |
| Signal Dunes “28%” ([plan:194](../../../../../docs/plans/SHARD-PLATFORM.md:194)) | **Exaggerated** | Script reports **101%**; shader/weapon conversion is future work. |
| Nalati “25%” ([plan:195](../../../../../docs/plans/SHARD-PLATFORM.md:195)) | **Exaggerated** | Script reports **102%**. |
| Nine Dragon “28%” ([plan:196](../../../../../docs/plans/SHARD-PLATFORM.md:196)) | **Exaggerated** | Script reports **100%**, rounded. |
| Template “31%” ([plan:197](../../../../../docs/plans/SHARD-PLATFORM.md:197)) | **Exaggerated** | Script reports **107%**; it still instantiates custom weapons, registers closures and builds DOM elements ([plugin:62](../../../../../src/shards/_template/plugin.ts:62), [plugin:96](../../../../../src/shards/_template/plugin.ts:96)). |
| P1 “G, 42%” ([plan:141](../../../../../docs/plans/SHARD-PLATFORM.md:141)) | **Unverifiable** | Printed shard percentages weight to **41.66%**, but no file-to-bucket inventory proves which code actually bakes. |
| P2 “D, 11%” ([plan:148](../../../../../docs/plans/SHARD-PLATFORM.md:148)) | **Unverifiable** | Printed percentages weight to **11.23%**; serialisability and conversion work are not established by this arithmetic. |
| P3 “S, 27%” ([plan:156](../../../../../docs/plans/SHARD-PLATFORM.md:156)) | **Unverifiable** | Printed percentages weight to **27.53%**, within the stated estimation tolerance; no implementation or file inventory validates the proposed replacement scope. |

Actual command output:

```text
node scripts/shard-platform.mjs --check

shard                  baseline   runtime  generators    data   custom share
_template                   550       588           0       0   107 %
driftwood-isle            18766     19162           0       0   102 %
far-reach                  6889      6941           0       0   101 %
nalati-grasslands         33094     33608           0       0   102 %
nine-dragon-stack         25166     25238           0       0   100 %
pine-hollow               21698     22079           0       0   102 %
sunscar-dunes              4825      4882           0       0   101 %
```

**P0 and enforcement**

| Claim, source | Verdict | Evidence |
|---|---|---|
| SP0: plan and requirements “done `4a95c2454`” ([plan:134](../../../../../docs/plans/SHARD-PLATFORM.md:134)) | **True** | Git history contains that commit and both documents. This proves documentation exists, not that the strategy works. |
| SP1: wrong simulation paths fixed ([plan:135](../../../../../docs/plans/SHARD-PLATFORM.md:135)) | **True** | Historical rule matched `quests|effects`; current rule names `ai|combat|events|quest|saves`. Folder-existence test exists; targeted lint passes. [Rule:487](../../../../../lint/wildshard-plugin.js:487), [test:42](../../../../../test/arch-guards.test.ts:42). |
| SP2: reserved profile scope, import/export, native mirror and protected names ([plan:136](../../../../../docs/plans/SHARD-PLATFORM.md:136)) | **True** | Implemented in [store:10](../../../../../src/engine/saves/store.ts:10), [store:213](../../../../../src/engine/saves/store.ts:213), [native saves:25](../../../../../src/engine/native/saves.ts:25); focused test at [saves test:48](../../../../../test/engine/saves.test.ts:48). Actual inventory/purse remain shard-scoped ([game saves:9](../../../../../src/game/saves.ts:9)). |
| SP3: “44 content row types,” “45 function fields” ([plan:137](../../../../../docs/plans/SHARD-PLATFORM.md:137)) | **True** | `ROW_TYPES` contains **44** selected names; executed checker reports **45 function fields, none new**. [Checker:19](../../../../../scripts/check-row-data.mjs:19). |
| SP3: “a test round-trips every registered row” ([plan:137](../../../../../docs/plans/SHARD-PLATFORM.md:137)) | **False** | Only `STARTER_EFFECTS` is actually JSON-round-tripped ([test:20](../../../../../test/row-data.test.ts:20)). The type scanner stops after depth 5 and skips library objects; it is not runtime-value validation ([checker:43](../../../../../scripts/check-row-data.mjs:43), [checker:52](../../../../../scripts/check-row-data.mjs:52)). The “ratchet done” qualification is more accurate than the row’s title. |
| SP4: 500 m cell, ±250 m constants ([plan:138](../../../../../docs/plans/SHARD-PLATFORM.md:138)) | **True** | Constants are implemented at [config:9](../../../../../src/engine/core/config.ts:9). |
| SP4: “all seven levels pass”; ground held inside cell ([plan:138](../../../../../docs/plans/SHARD-PLATFORM.md:138)) | **Exaggerated** | Reproduced sampling passes, but **Sky Reach skips all terrain assertions**, and Nine Dragon passes using a datum explicitly neither drawn nor collidable. [Test:27](../../../../../test/world/world-contract.test.ts:27), [Nine Dragon terrain:4](../../../../../src/shards/nine-dragon-stack/terrain.ts:4). |
| SP4: “level with the highway” ([plan:138](../../../../../docs/plans/SHARD-PLATFORM.md:138)) | **Exaggerated** | Accepts up to **1 m** vertical difference, samples the interior every **25 m**, and does not reject `NaN`. No geometry bounds or collision clearance checked. [Test:29](../../../../../test/world/world-contract.test.ts:29), [test:39](../../../../../test/world/world-contract.test.ts:39). Full walking is honestly deferred to SP10. |
| SP5: folders, baseline, report, generator lint/chunk checks landed ([plan:139](../../../../../docs/plans/SHARD-PLATFORM.md:139)) | **True** | Present in [layout:33](../../../../../lint/shard-layout.json:33), [generator rule:519](../../../../../lint/wildshard-plugin.js:519), [chunk check:39](../../../../../scripts/check-chunks.mjs:39), [push gate:65](../../../../../scripts/vercel-tree-gate.sh:65). Baseline totals exactly reproduce `b96fed1a1`; P0 completion commit is an ancestor of local `origin/main`. |
| SP5: simulation coverage includes shard `data/` ([plan:139](../../../../../docs/plans/SHARD-PLATFORM.md:139)) | **True**, narrowly | Rule covers that path. No shard has such a directory; kit simulation, shard weapons and other gameplay folders remain outside it. [Rule:490](../../../../../lint/wildshard-plugin.js:490). |
| Metric numerator: “TS lines under `runtime/` + plugin glue” ([plan:38](../../../../../docs/plans/SHARD-PLATFORM.md:38)) | **False** as implemented | Counts **all TS/TSX outside top-level `data/` and `generators/`**, including manifest, strings and other data-shaped files; ignores non-TS implementations. [Metric:25](../../../../../scripts/shard-platform.mjs:25), [metric:40](../../../../../scripts/shard-platform.mjs:40). |
| “Outside `runtime/`, a shard has no runtime code,” enforced from SP5 ([plan:42](../../../../../docs/plans/SHARD-PLATFORM.md:42)) | **False** | Existing executable code remains throughout shards; functions in `data/` are not prohibited by a serialisability check. `sim-no-render` prohibits selected visual dependencies, not execution. [Rule:496](../../../../../lint/wildshard-plugin.js:496). |
| “ceiling only goes down” ([plan:44](../../../../../docs/plans/SHARD-PLATFORM.md:44)) | **False** as an automated guarantee | No previous-revision comparison; `enforced` is empty. In-memory calls accepted an unrecorded shard with **999,999 runtime lines**, an enforced shard with no baseline, and a **90%** configured ceiling. [Configuration:13](../../../../../lint/shard-platform.json:13), [checkShares:48](../../../../../scripts/shard-platform.mjs:48). |
| “Every manifest … 500 × 500 × 500” ([plan:90](../../../../../docs/plans/SHARD-PLATFORM.md:90)) | **False** | Six do; template declares **[200, 200, 200]**, both historically and now. [Template manifest:12](../../../../../src/shards/_template/manifest.ts:12). |
| Quest definitions and ten interactable kinds are data ([plan:82](../../../../../docs/plans/SHARD-PLATFORM.md:82)) | **True** | Definitions and validators exist: [quest:31](../../../../../src/engine/quest/core.ts:31), [quest validator:140](../../../../../src/engine/quest/core.ts:140), [interactable union:103](../../../../../src/engine/world/interact/types.ts:103). These are not general upload schemas. |
| Aim comes from the viewmodel; hit-stop scales simulation ([plan:108](../../../../../docs/plans/SHARD-PLATFORM.md:108)) | **True** | [Weapon:56](../../../../../src/engine/combat/Weapon.ts:56) reads the model parent’s camera transform; [Game:755](../../../../../src/engine/core/Game.ts:755) scales the delta supplied to the fixed loop. |
| “FakeGame … under happy-dom” ([plan:110](../../../../../docs/plans/SHARD-PLATFORM.md:110)) | **Exaggerated** | FakeGame creates a Scene/camera, but the default test environment is **Node**; only selected tests opt into happy-dom. [FakeGame:13](../../../../../test/fake/FakeGame.ts:13), [Vitest config:18](../../../../../vitest.config.ts:18). A three.js Scene alone does not require a browser. |
| Travel is page reload with a 60-second handoff ([plan:111](../../../../../docs/plans/SHARD-PLATFORM.md:111)) | **True** | [Travel:50](../../../../../src/game/travel/travel.ts:50), [travel:70](../../../../../src/game/travel/travel.ts:70). |
| Barrel-era export paths in P0/handoff remain valid ([plan:138](../../../../../docs/plans/SHARD-PLATFORM.md:138)) | **False** | E434 removed the barrels. Constants now import from `@wildshard/engine/core/config`; public modules are enumerated in [package exports:5](../../../../../src/engine/package.json:5). |
| One-shot repo has 824 commits at `bb608d4` ([review:11](../../../../../docs/design/mmo/ONE-SHOT-REVIEW.md:11)) | **True** | Local one-shot `origin/main` resolves to `bb608d449…`; `git rev-list --count origin/main` returns **824**. Its “working” feature table was not independently execution-tested here. |

**3. Strategy from first principles**

**The boundary is the product.** An outside shard must boot without the host importing author-controlled JS, invoking arbitrary constructors, or handing it `App`, DOM nodes or mutable game services. Today the loader imports a plugin constructor and instantiates it, while `ShardContext` exposes those services directly ([plugin loader:12](../../../../../src/game/shard/pluginLoad.ts:12), [LevelContext:55](../../../../../src/engine/level/context.ts:55), [ShardContext:24](../../../../../src/game/shard/context.ts:24)).

The four source layers are useful internal organisation. They are **not the upload security boundary**. Neither are lint, a package extension, a TypeScript interface or the word “approved.”

The first package milestone should establish:

- A closed manifest and content format, immutable asset references and bounded loading.
- A loader that executes no author JavaScript.
- A small, versioned capability interface for behaviour.
- The same gameplay package running without rendering.
- An independently authored package produced outside this repository.

Those are already scattered through the requirements, but package loading and the fresh-author test sit at SP29/SP30 after the catalogue and conversions ([requirements:78](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:78), [plan:204](../../../../../docs/plans/SHARD-PLATFORM.md:204)). **That order maximises work before testing the central assumption.**

**Server authority cannot be postponed wholesale.** You can postpone production hosting, matchmaking and a 25-shard deployment. You cannot safely freeze the behaviour API before deciding who owns shared state and validates mutations.

My recommendation is server authority over shared entities, contested interactions and durable rewards; clients predict responsive movement and present effects. The precise movement/physics authority remains a decision to test. A minimal two-client room should precede broad system extraction because “open door,” “hit enemy” and “award item” acquire different meanings under latency, retries and concurrent players. The requirements demand headless execution and snapshot/replay, but the plan provides no explicit implementation row for the complete simulation seam ([requirements:131](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:131), [plan:237](../../../../../docs/plans/SHARD-PLATFORM.md:237)).

The current camera-derived aim and global hit-stop are concrete examples of contracts that need changing before multiplayer—not after converting six shards.

**The phone budget must constrain aggregate execution.** Baking is sensible, but removing generator source does not prove lower loading memory, download size or frame cost. GLB loading can change representation, instancing, decoding and allocation peaks. SP7 checks `gpuMB`; the product constraint is broader: total loading/world memory and sustained play with other players, networking and behaviour execution ([plan:146](../../../../../docs/plans/SHARD-PLATFORM.md:146), [requirements:123](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:123)).

A material node allowance also does not establish a safe frame cost: visible coverage, overdraw, instances, lights and combinations matter. Begin with a small set of measured materials and passes. Keep the dual-target compiler decision, if desired, as a separate expansion rather than a prerequisite for proving packages ([plan:170](../../../../../docs/plans/SHARD-PLATFORM.md:170)).

**API longevity means behavioural compatibility.** `api: 1` currently provides exact-version refusal. It does not promise old packages will keep working after physics, event ordering, device defaults or material semantics change ([loader:45](../../../../../src/game/shard/load.ts:45)). The proposed `requires: ["mount@2"]` is incomplete without immutable semantics, dependency resolution, supported-version policy, migration and revocation. None receives a concrete SP row ([requirements:94](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:94)).

**Claude Code being the editor weakens the case for a large graph language.** Graphs are useful for inspectable composition and simple state machines. They are also programs: timers, arithmetic, state, branching and event cascades require language semantics, debugging, metering and versioning. SP12 effectively commissions a language implementation while SP20 commissions another execution system ([plan:164](../../../../../docs/plans/SHARD-PLATFORM.md:164), [plan:179](../../../../../docs/plans/SHARD-PLATFORM.md:179)).

I recommend **one small capability API, reusable devices, and an experimentally chosen general-purpose behaviour runtime**. Keep declarative quest/encounter tables where they already fit. Do not require arbitrary authored mechanics to become engine PRs: SP30’s “every gap becomes an approved system” makes the central team a bottleneck and lets a supposedly successful author test hide unlimited platform work ([plan:205](../../../../../docs/plans/SHARD-PLATFORM.md:205)).

| Behaviour option | Assessment |
|---|---|
| Data graphs | Appropriate for simple wiring and tables; unjustified as the mandatory language for all authored logic before an authoring trial. |
| TS-like language → WASM | A credible first candidate for Claude Code authors, but TS-like is not unrestricted TypeScript; benchmark the actual toolchain and required language subset. [AssemblyScript concepts](https://www.assemblyscript.org/concepts.html). |
| Rust → WASM | A credible plugin implementation option; the plan’s “best toolchain” assertion does not establish that it is the best default authoring language ([requirements:204](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:204)). |
| QuickJS, potentially inside WASM | Worth comparing for author familiarity; QuickJS supplies memory limits and interruption hooks, but the plan’s blanket “20–50× slower” is not a Wildshard measurement. [QuickJS documentation](https://bellard.org/quickjs/quickjs.html), [background:188](../../../../../docs/design/mmo/SHARD-PLATFORM-PLAN.md:188). |

WASM supplies isolation primitives, not the full operational policy. Host calls still need capability checks and resource accounting; deterministic instruction fuel and wall-clock interruption are different mechanisms. Browser/server equivalence must be tested rather than inferred from using the same binary. [WebAssembly security](https://webassembly.org/docs/security/), [Wasmtime interruption documentation](https://docs.wasmtime.dev/examples-interrupting-wasm.html).

**The line-count metric is useful only as a migration ledger.** Its fixed denominator usefully prevents padding new data from diluting the ratio. But formatting, comment removal, relocation to the kit or rewriting TS as WASM can improve the number without improving safety, performance or author independence. Conversely, a harmless extra data-shaped manifest line worsens it ([metric:17](../../../../../scripts/shard-platform.mjs:17)).

Keep it under a name such as **remaining legacy TS / baseline TS**. Measure platform readiness separately with binary acceptance tests: external package boots; no trusted author-code path; bounded execution; headless state restore; independent authorship; old package compatibility; phone budget.

**What is over-built, missing and ordered wrong**

The large device catalogue, eight brain families, weapon-family conversions and dual-target material compiler are ahead of evidence about the author API. They may become useful; the plan has not shown they are all prerequisites ([plan:165](../../../../../docs/plans/SHARD-PLATFORM.md:165)).

Networking, persistence, moderation and cost are not absent from the documents; they are **named without executable milestones** or explicitly deferred. That distinction matters. Before broad conversion, establish a thin server/replication proof, package admission pipeline, revision/state model and measured room cost; defer the large production implementation ([requirements:143](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:143), [requirements:211](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:211)).

The asset pipeline also needs a package contract for colliders, anchors, animation, LOD, texture variants and dependencies. “Export GLB” does not preserve those automatically; current static pieces register colliders separately from their render object ([rendering rules:29](../../../../../docs/process/RENDERING.md:29)).

**4. Risks the documents do not adequately name**

These are inferred failure modes, not claims of demonstrated exploits.

- **Author-controlled rewards can corrupt the shared economy even on an authoritative server.** Executing malicious reward rules faithfully is still wrong; durable grants need host-owned policy, provenance and idempotency, especially with travelling inventory and offline play ([requirements:125](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:125), [requirements:136](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:136)).
- **Fuel exhaustion can leave partial effects.** If a behaviour mutates the host, then traps, retrying can duplicate rewards or leave half-applied transitions; the host needs explicit effect validation and commit semantics ([plan:179](../../../../../docs/plans/SHARD-PLATFORM.md:179)).
- **Host work can bypass instruction fuel.** A cheap guest call can request an expensive path search, spawn batch or event cascade; meter host cost and outputs as well as guest instructions ([plan:164](../../../../../docs/plans/SHARD-PLATFORM.md:164), [plan:167](../../../../../docs/plans/SHARD-PLATFORM.md:167)).
- **Snapshot completeness is unresolved.** Seeded RNG is not sufficient for restoring an in-progress room: stream positions, timers, pending events and behaviour state matter; the current RNG and clock expose no state export/restore contract ([RNG:2](../../../../../src/engine/core/rng.ts:2), [clock:2](../../../../../src/engine/core/clock.ts:2)).
- **Validation itself can be attacked.** Archive expansion, malformed geometry, decoding, shader compilation and reference graphs need limits before large allocation or expensive processing; schema validity and a final triangle count are insufficient ([requirements:90](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:90)).
- **Compatibility and emergency revocation conflict.** “Keep working for years,” offline caching and plugin approval require a policy for a previously approved plugin or asset later found unsafe ([requirements:29](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:29), [requirements:115](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:115)).
- **Aggregate room load has no specified envelope.** Per-shard budgets do not answer player count, simultaneous behaviours, crowded-hub bandwidth or idle-room cost; a 25-cell grid is not a capacity model ([requirements:66](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:66), [requirements:131](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:131)).
- **Generator sharing moves risk onto authors’ computers.** The claim that authors can “safely share” ordinary generator packages is unjustified: local execution removes player-runtime exposure, not author-machine exposure ([ideas:219](../../../../../docs/design/mmo/SHARD-IDEAS.md:219)).
- **Documentation drift can steer agents into incompatible implementations.** VISION simultaneously says 500 m tall and `y ∈ [-100,100]`; the glossary retains old trust tiers and material terminology; the plan retains old module paths and sequence ([VISION:18](../../../../../docs/design/mmo/VISION.md:18), [glossary:46](../../../../../docs/design/mmo/GLOSSARY.md:46), [glossary:59](../../../../../docs/design/mmo/GLOSSARY.md:59)).

**5. Keep / cut / change**

- **Keep:** source-layer separation, explicit exports, scope ownership, save schemas, existing declarative quests/interactables, generator baking and a first-party transition allowance; these are actual useful mechanisms ([package exports:5](../../../../../src/engine/package.json:5), [level unload:171](../../../../../src/engine/level/load.ts:171), [save validation:139](../../../../../src/engine/saves/store.ts:139)).
- **Cut from the first milestone:** broad legacy conversion, the complete device/brain catalogue and renderer/compiler expansion; prove the minimum package path first ([plan:145](../../../../../docs/plans/SHARD-PLATFORM.md:145), [plan:165](../../../../../docs/plans/SHARD-PLATFORM.md:165)).
- **Cut:** “Custom today” labels, unsupported exact counts and the 45–55 agent-day estimate as a planning commitment; there is no measured package or language spike supporting it ([plan:189](../../../../../docs/plans/SHARD-PLATFORM.md:189), [plan:214](../../../../../docs/plans/SHARD-PLATFORM.md:214)).
- **Change:** make SP29/SP30 the first delivery, with SP8/SP10 and only the necessary subset of SP11–SP20 supporting it ([plan:152](../../../../../docs/plans/SHARD-PLATFORM.md:152), [plan:204](../../../../../docs/plans/SHARD-PLATFORM.md:204)).
- **Change:** distinguish legacy lint guards from package admission guarantees, and replace “every gap becomes a system” with a bounded authoring trial whose unresolved gaps are reported honestly ([plan:205](../../../../../docs/plans/SHARD-PLATFORM.md:205)).
- **Change:** keep parity for legacy migrations, but use semantic tests for the new platform; the existing image comparator permits a similarity band and cannot establish multiplayer correctness ([parity comparison:103](../../../../../scripts/parity/compare.mjs:103)).

**6. Top 10 recommendations, ranked**

1. **Deliver the template as an externally loaded package with no trusted author-code path first**, because this directly tests Jake’s chosen milestone and the current loader still instantiates trusted plugins ([plan:260](../../../../../docs/plans/SHARD-PLATFORM.md:260), [loader:14](../../../../../src/game/shard/pluginLoad.ts:14)).
2. **Define state ownership and a command/effect boundary before expanding the author API**, because camera-derived hits, shared rewards and global hit-stop cannot simply be carried into a shared room ([Weapon:56](../../../../../src/engine/combat/Weapon.ts:56), [Game:755](../../../../../src/engine/core/Game.ts:755)).
3. **Run that same small package headlessly with two clients, reconnect and state restore**, because the current milestone defers multiplayer until after the abstraction work it should inform ([requirements:181](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:181)).
4. **Compare graphs, a TS-like WASM toolchain and QuickJS on identical representative behaviours**, because the documents choose mechanisms and assert performance without a Wildshard workload measurement ([background:188](../../../../../docs/design/mmo/SHARD-PLATFORM-PLAN.md:188), [plan:164](../../../../../docs/plans/SHARD-PLATFORM.md:164)).
5. **Implement bounded package admission and runtime capability enforcement together**, because valid JSON or a sandboxed module can still request excessive or unauthorised host work ([requirements:91](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:91), [plan:179](../../../../../docs/plans/SHARD-PLATFORM.md:179)).
6. **Specify package revisions, stable entity identities, state migrations and durable reward transactions now**, because the reserved profile scope supplies none of these guarantees ([store:10](../../../../../src/engine/saves/store.ts:10), [requirements:133](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:133)).
7. **Budget the complete phone session and server room, including decoding, avatars, behaviour, host calls and networking**, because the current conversion criterion concentrates on baked assets and `gpuMB` ([plan:146](../../../../../docs/plans/SHARD-PLATFORM.md:146)).
8. **Require a fresh author to build outside the repo against a fixed SDK release without engine edits during the measured trial**, because otherwise the SDK test can pass through unlimited platform assistance ([requirements:83](../../../../../docs/design/mmo/MMO-REQUIREMENTS.md:83), [plan:205](../../../../../docs/plans/SHARD-PLATFORM.md:205)).
9. **Rename and repair the TS metric, require explicit new-shard policy and enforce historical ceiling changes**, because today’s checker passes unknown shards and trusts whatever ceilings the same revision supplies ([metric:48](../../../../../scripts/shard-platform.mjs:48)).
10. **Convert the six legacy shards only after that proof, using measured, file-level conversion inventories**, because the current percentages and catalogue estimate work that has not yet demonstrated package safety, portability or author independence ([plan:52](../../../../../docs/plans/SHARD-PLATFORM.md:52), [plan:183](../../../../../docs/plans/SHARD-PLATFORM.md:183)).