# Mobile + web action-game practice, mapped to Wildshard (E357 research, 2026-09-30)

**2026-10-08 correction (SF67/G188).** This is research against `afd112a5`, not current policy. A measured over-cap images-first phone estimate now selects KTX2 on the first visit; explicit Debug choices still win. Current loading work is measured separately from fps, diagnostics are gated, and trusted validation verdicts are cached by exact declaration and validator revision. Historical tables below preserve their original snapshot. See [current rendering/loading rules](../../process/RENDERING.md).

What AAA mobile action / open-world studios and web-game engines do, set against Wildshard's tree at `afd112a5`, for
the GAME-NORMALIZATION v2 rewrite. Five topics, one table each: **practice · who does it · Wildshard today · gap ·
row**. The rows (`MW1`–`MW22`) are listed in §6 with a when-tag: **[N]** inside the E357 normalization, **[A]** right
after it, **[L]** later / Jake's call. Sources are primary where one exists (GDC slides, WebKit / Apple / Khronos /
Unity / Epic docs, studio tech blogs). Where a talk is behind the GDC Vault paywall, only its public abstract is used.

**Verdict in one paragraph.** On the web-platform side (service worker, shader warm-up, context loss, OTA, the
multi-draw incident discipline) Wildshard is already ahead of most shipped web games. It is behind the AAA mobile
studios in three places. (1) **Budgets are measured by hand, not declared and enforced**: no per-shard draw / tri /
GPU-byte / ms budget that a gate checks, and no update-LOD scheduler. (2) **Nothing GPU-side gates a push or a deploy**:
CI is node-only, and `scorecard.mjs`, `bench:ci`, `test:gpu-boot` and the iPhone readings run when someone remembers.
Rare could ship an update on a week's notice, on 23,000 tests. Wildshard ships hourly, on 115 node test files. (3) **Player data has no schema**:
42 files touch `localStorage` by hand, keys are `ws.*.v1` with no migration chain, and the 1.8 GB memory target sits
above the ~1.5 GB WebContent limit a WebKit engineer quotes for typical iPhones.

## 1. Mobile action / open-world performance architecture

| Practice | Who does it | Wildshard today | Gap | Row |
|---|---|---|---|---|
| **Per-system frame budgets, in ms, on a named reference device** | Genshin AI: 60 fps mobile target, 30+ live NPCs; AI cost 2–3 ms before optimisation, then a **0.5 ms AI budget** tested on an Apple A12 ([GDC 2021][genshin-ai]). Arm: budgets per metric group, checked daily in CI ([Arm][arm-budget]) | `frameCost.ts` measures update / render / gpu~ per frame, and the perf lap records fps per spot. No system has a budget | A budget no gate reads is a reading, not a budget | MW5, MW6 |
| **Update LOD / significance**: far or unseen agents tick slower or not at all | Genshin: 3 AI LOD tiers, high 30 Hz, low 5 Hz; LOD1 = 50 % tick rate, LOD2 = paused ([GDC 2021][genshin-ai]). PUBG Mobile's four levers include "ticking smoothly" ([GDC 2023][pubg]) | `Animal.update` has a far LOD (the pose is frozen, only the root moves). NPCs, elites, bosses, FX and weather each tick every frame in the one `'main'` updater | Not an engine service; every new shard system re-invents it or does not | MW6 |
| **Device tiers with a different strategy per tier** | PUBG Mobile: 22,000+ phone models, 55 % of them low-end, separate strategies for low- and high-end devices, in-house CPU / GPU / temperature monitors ([interview][pubg-int]). Genshin keeps separate mobile and console render pipelines ([Unity Dojo][genshin-console]) | Two tiers (`phone` / `desktop`) chosen by UA; `TIER_TABLE` holds ~50 measured knobs per tier; Settings ▸ Quality overrides | Right size for one target (iPhone). Knobs live in one engine table, and shards override them in code (`Game.ts:290` overrides Nine Dragon's AO) | MW5 |
| **Thermal governor**: sustained heat → cheaper frame, art-approved knobs only | CoD Mobile (Unity Adaptive Performance): stages Normal / NearThrottling / CloseThrottling. Knobs: shadow distance 80 → 50, foliage LOD 1.0 → 0.8, 60 → 57 fps, animation rate. Each knob "confirmed with the Art designer". Result: +7 % average fps, lower variance, −2 °C ([Samsung][codm]). Apple: frame rates hold only if you measure over hours as the device heats ([WWDC26][wwdc26]) | iPhone 17 Pro throttles the GPU ~2× within 1–2 min (memory note). Jake bans dynamic resolution. There is an fps cap setting; nothing reacts to heat | The web has no thermal API; sustained frame time is the signal. Resolution is off the table, so the knobs are CoD's: shadow reach, LOD distances, far-anim rate, AI tick | MW8 |
| **Content made per platform, not only scaled** | Wuthering Waves: real 3D trees on PC / console, billboards on mobile ([Epic interview][wuwa]). Genshin runs separate mobile and console pipelines ([Unity Dojo][genshin-console]) | Per-tier packs and textures, tree hi / lo / far cards, far-herd batching, per-tier KTX2 sets | Matches the practice. Keep the tier split in shard **data** (packs, card distances), not in `if (TIER)` code | MW5 |
| **Shader / pipeline warm-up at load; a fallback for stragglers** | Unreal PSO precaching: precache during the load screen; streamed objects wait a few frames or draw with an already-compiled default material. Mobile compiles slower than desktop ([Epic][ue-pso]) | `boot/precompile.ts` issues every program before the first frame and links through `KHR_parallel_shader_compile` (iOS Safari 14.5+, [caniuse][khr-psc]); GpuRecovery re-links in batches | Built for one boot. Once a shard is a lazy plugin, its material set must be declared so the engine warms it on shard load, and a late material needs a fallback, not a stall | MW5, MW13 |
| **Memory budget per phase + a native watchdog** | Unity Web: size the heap to typical use, because growth can fail ([Unity][unity-mem]). Addressables: group what loads and unloads together, unload promptly ([Unity][addr]). Apple MetricKit reports memory-limit exits from the field ([WWDC26][wwdc26]) | Targets 1.8 GB loading / 1.0 GB Explorer (decimal); a native high-water Simulator watchdog; physical-iPhone readings through Web Inspector; shard dispose scope (`shardScope`, `disposeListeners`) | The targets were set without a min-spec device. A WebKit engineer puts typical iPhone WebContent at **~1.5 GB** ([WebKit bug][wk-mem]); Jake's 17 Pro logged **ActiveHard 2,048 MB**, so 1.8 GB (decimal) is ~84 % of it (the kernel's MB are MiB) | MW11 |
| **Battery / frame cap as a design choice** | Sky built its own Metal engine partly to "preserve battery life" ([Apple][sky]); CoD drops 60 → 57 before cutting detail | 30 fps floor, and Low Power Mode caps the phone at 30 | Fine. A 30 fps cap on phone is the battery lever; keep it a setting | — |

## 2. Web / WebGL specifics on iOS Safari (2026)

| Practice | Who does it | Wildshard today | Gap | Row |
|---|---|---|---|---|
| **Know the hard ceilings** | WebKit (Ben Nham): iPhone WebContent limit **~1.5 GB** typical, iPad 8 GB "4 GB+"; typed arrays and wasm share the **Gigacage, 2 GB** on iOS ([bug 268816][wk-mem]) | `docs/ios-memory-watchdog.md` and the multi-draw record hold the physical evidence (ActiveHard 2,048 MB) | No written min-spec device, so no budget derived from one | MW11 |
| **Texture memory: compressed on the GPU** | 4096² RGBA with mips = **90 MB** on the GPU; KTX2 / Basis stays compressed, **4–8× smaller** ([McCurdy][ktx2]) | KTX2 sets per tier, baked and cached; Auto picks KTX2 once cached. **Nine Dragon on phone is forced to images** (E248, a WebKit compressed-upload failure) | The biggest memory lever is switched off on the heaviest shard | MW12 |
| **Geometry compression** | glTF meshopt decode in three.js | `meshoptimizer` + gltf-transform bake; `MeshoptDecoder` in the Blender island and Pine crags loaders | Fine | — |
| **WASM heap only grows** | `memory.grow` has no inverse; every grow detaches the old buffer ([MDN][mdn-grow]). A 2 GB wasm max OOMs on iOS ([Godot #70621][godot-wasm]) | Rapier (`rapier3d-simd`) owns a wasm heap; shards switch in-page | Nobody has measured Rapier's high-water across shard switches. The heap keeps its peak for the page's life | MW14 |
| **Context loss is normal on iOS** | Khronos: `preventDefault` on lost, then re-create every GL resource on restored ([wiki][khr-lost]) | `GpuRecovery.ts`: restore in place, or reload to `?at=` under the pause menu; `lifeTrace` reports what happened | Ahead of the practice | — |
| **Service-worker caching of large assets** | Hashed files cache-first; the shell network-first; the manifest network-only | Three caches (immutable / static-by-content-hash / shell-per-build) carried over by content hash; the SW announces a new build, never reloads mid-session; the build pill | Ahead of the practice | — |
| **Storage quota, eviction, persistence** | Safari 17+: origin quota up to 60 % of disk, home-screen apps the same; LRU eviction; `persist()` granted "based on heuristics like whether the website is opened as a Home Screen Web App" ([WebKit][wk-storage]). ITP's 7-day wipe counts a home-screen app's own days of use ([WebKit][wk-itp]) | Saves are write-through `localStorage` (native mirrors them to Preferences); no `navigator.storage.persist()` call anywhere | Saves and 70 MB+ caches sit in best-effort storage; no backup path | MW15 |
| **Per-level bundles (the Addressables analog)** | Unity Web: no file-system bundle cache on the web; a loaded bundle lives whole in memory, so unload promptly; a bundle is what loads and unloads together ([Unity][unity-ab], [Addressables][addr]) | Per-shard boot packs per tier, shard prefetch, and SW carry-over. **Code:** Nine Dragon is lazy (373 KB plus chunks); the other three ship in `main-*.js` (2.9 MB raw) | Decision 2 (lazy per shard) closes the code half. Add a per-shard manifest: code chunks + packs + KTX2 set + audio + precompile set + budgets | MW13 |
| **WebGPU is here, WebGL2 stays the floor** | Safari 26 ships WebGPU on iOS; every Home Screen site opens as a web app by default ([WebKit][wk-26]) | WebGL2 only; **87 `onBeforeCompile` in 42 files, 112 `ShaderMaterial`** (GLSL patches) | Every GLSL patch in a shard folder makes a later WebGPU backend costlier. No reason to switch now: the memory behaviour is unmeasured, and the multi-draw record shows why that matters | MW18 |
| **PWA / OTA update flow** | Capgo: the new bundle must call `notifyAppReady()` within `appReadyTimeout` (10 s), or the plugin rolls back and marks it failed ([Capgo][capgo]) | Native OTA calls `notifyAppReady`; the web announces and adopts on a tap; `release-url.sh` freezes a URL per version | The web build has no health-based rollback: a bad hourly deploy stays live until a human notices | MW21 |

## 3. Quality engineering

| Practice | Who does it | Wildshard today | Gap | Row |
|---|---|---|---|---|
| **Test pyramid with a game-object middle layer** | Sea of Thieves: **23,000+ tests**, 70 % "actor tests" (unit tests with engine objects), 5 % map integration tests. Unit ≈ 0.1 s, integration ≈ 20 s. **Integration covers the golden path only**, actor tests cover the edge cases, 12 : 1 ([GDC 2019][sot]) | 115 vitest files, node-only, pure modules. No test runs `bootstrap()` or a shard | No middle layer: engine systems (weapons, strike timing, bosses, quests) are not testable without a browser | MW4 |
| **Golden-path gameplay tests in the real game** | SoT integration maps; Unreal Gauntlet `BootTest` starts the client and exits after init ([Epic][gauntlet]) | `physics-baseline.mjs` walks, `test:gpu-boot` for Nine Dragon, one-off capture scripts per ask | No standing per-shard boot + swing + walk test; the planned N9 subset is not built | MW1, MW3 |
| **Screenshot tests with a threshold** | three.js: committed baselines, fail over **< 0.1 %** differing pixels ([three.js PR][three-e2e]). SoT: % of pixels different, plus a manual check against the last pinned image for non-deterministic scenes ([GDC 2019][sot]) | `scorecard.mjs`: 3 poses per shard with seeded `Math.random`, pinned time and weather, SSIM against goldens. Skips Nine Dragon | Scorecard is ~70 % of a golden master, but it runs by hand | MW1 |
| **Everything runs continuously; a red build stops submits** | SoT: every test at least every **20 min**; pre-commit runs the related subset (aim < 1 h); no submits while red; the change that broke it is backed out ([GDC 2019][sot]) | Hourly deploy of the latest node-green `main`; the pre-push Vercel-tree gate (~6 s) | "Green" means typecheck + lint + vitest + build. A shard that no longer boots on a GPU still deploys | MW3 |
| **Flaky-test policy** | SoT: re-run a failure, go red only on the second; the worst offenders go to quarantine (still run, not gating) and their owner is told ([GDC 2019][sot]) | None written | Needed the day the GPU gate exists, or agents will learn to ignore it | MW3 |
| **Perf regression detection with statistics** | Mozilla Perfherder: a t-test of 12–24 measurements before a revision against 12 after it; alert when T > 7 and the change > 2 %; even so, **12.5 %** of alert summaries are false positives ([paper][perfherder]). Arm: budgets in CI, daily trend ([Arm][arm-budget]) | BENCH.md: "compare counts, treat ms as a p50 trend"; `bench.budget.json`, `scorecard.budget.json` | The rule is right. Rows over budget (Driftwood's longest task 1.15 s against 100 ms) fail nothing | MW3, MW9 |
| **Bots and soak runs** | The Division: client bots play missions and wander the streets for perf data ([80.lv][division]). DICE: AutoPlayers, from 64-player soaks to scripted cases ([GDC 2019][dice]). EA SEED: RL agents added on top of scripted bots for coverage in Battlefield 2042 and Dead Space ([CoG 2023][seed]) | Navmesh baked per shard; the perf lap teleports to spots; physics walk and trails | No long unattended run looking for heap or GPU growth, stuck states or errors | MW19 |
| **Deterministic record / replay** | Riot: determinism so recorded inputs replay as tests (Delta Checker). It took "almost a full year" of several engineers, and removed dead code as a side effect ([Riot][riot-det]) | `rng.ts`, `fixedStep.ts`, `time.ts` exist; ~180 `Math.random` and ~235 `performance.now` in `src/**/*.ts` | Exact replay is a year-class job. Don't gate the refactor on it: ratchet first, replay later | MW2, MW22 |
| **Real-device lab** | Gauntlet drives iOS / Android devices ([Epic][gauntlet]). `safaridriver` drives Safari on a USB iPhone, iOS 13+ ([WebKit][safaridriver]) | `webkit-mem-reading.mjs` / `iphone-mem-reading.sh`: USB iPhone memory + 150 s fps through pymobiledevice3, by hand | Jake won't run phone chores (memory note). The phone lab has to run itself, on a tethered device that is not Jake's daily phone | MW9 |
| **Field telemetry: crash-free sessions and frame rate per state** | Apple MetricKit: daily frame-rate reports per `StateReporting` state, plus memory-limit exits ([WWDC26][wwdc26]) | `/api/errors` + optional Sentry (errors only, no sessions); `lastEnd` tells an unexpected end from a navigation; `lifeTrace` | Every signal needed is there, but nothing rolls them up into a per-build health number | MW10 |

### 3b. The minimum parity harness for a pure refactor, and the gate that stays

Copy SoT's shape, not its size. **Browser tests only for golden paths, vitest for everything else, and one list of
facts per shard that must not change.**

1. **Boot fingerprint** (per shard × tier, JSON, exact diff): the labelled systems in phase order, registry ids and
   collider counts, a scene census (meshes / instanced counts by name), `renderer.info` program keys (hashed),
   texture count, draw calls at 3 poses, audio beds requested, HUD slots shown, save keys read and written. An
   "identical" refactor step must diff empty; a wave's allowed diffs are listed on its board.
2. **Poses**: scorecard's 3 poses per shard (add Nine Dragon), SSIM plus % pixels differing (three.js-style < 0.1 %
   where deterministic, SoT's pinned manual check where not).
3. **Golden-path smoke**: boot → a 10 s scripted walk (0 stuck) → one melee swing and one shot that register a hit →
   a kill → a loot event. Edge cases go to vitest "actor tests" (MW4).
4. **Memory counts**: GPU bytes (scorecard's WebGL API accounting), textures and programs within a stated tolerance.
5. **Template shard** (the 5th-shard proof) boots in the same harness with zero engine edits.

**Per push (stays fast):** CI keeps the node gates and adds the lint ratchets (MW2), save-migration fixtures (MW7) and
asset audits (MW17). The Mac runs the GPU subset: 1–3 + boot for 4 shards on the phone tier, ≤ 5 min, in the browser
lane. It posts a commit status; the deploy ships only the newest SHA with that status green. **Nightly:** the full
harness, the soak bot (MW19) and the tethered-iPhone run (MW9).

## 4. Long-term codebase health for a live game

| Practice | Who does it | Wildshard today | Gap | Row |
|---|---|---|---|---|
| **A "pit of success": structure that makes the wrong code hard to write** | Overwatch: ~46 client systems over 103 component types; only 3 systems touch netcode ([GDC 2017][overwatch]) | `wildshard/no-url-switch` lint, the collider registry, `Game` phases, the Debug registry: each is a pit of success | Shard branches grew 240 → 269 while the plan waited. The shard boundary has no lint | MW2 |
| **Plugins through a registry of versioned APIs** | Our Machinery: a plugin is a module exposing APIs through an API registry, with explicit load / unload ([Our Machinery][ourmachinery]) | `ChunkDef` lazy strategy hooks (`render`, `structures`, `sword`, `roster`, `traversal`); Nine Dragon plugs in through them | No API version and no load / unload contract; a 5th shard learns the interface by reading four examples | MW20 |
| **Content as data, validated by audits** | Genshin: 200+ AI archetypes built as combinations of parameter settings ([GDC 2021][genshin-ai]). SoT: asset audit tests catch bad data without a test per asset ([GDC 2019][sot]) | `check-models.mjs`, the models tests, `targets.json` for Blender, tier tables | Tuning lives in code across the four shards (weapon feel, spawn tables, day clocks). E357 decision 5 (mechanism vs content) moves it into shard data; the audit has to follow it | MW17 |
| **Feature flags have a type and an expiry** | Fowler / Hodgson: release, experiment, ops and permission toggles; toggles are "inventory which comes with a carrying cost"; expiry dates and a cap on how many; flag off = legacy behaviour ([martinfowler.com][toggles]) | One Debug registry (`DEBUG_ROWS`), a test that every option has a row, "delete the loser in one commit" (E136 / E162) | No owner, no review date, no count ratchet. The registry will grow without bound | MW16 |
| **Save data versioned with a migration chain** | Minecraft's DataFixerUpper: schemas per data version, and fixes that move saves between versions ([Mojang][dfu]) | `ws.<thing>.v1` keys, 42 files read `localStorage` directly, one global `ws.elites.v1` shared by two shards | No schema version, no migration, no downgrade story (an old cached client meeting a newer save), no fixture corpus | MW7 |
| **Live cadence only as fast as the gates** | SoT: days to verify a build went from 10 (Kinect Sports Rivals) to 1.5; 17 manual testers where Kinect Sports needed 50; peak bug count 214 where Banjo reached ~3,000 ([GDC 2019][sot]) | Hourly deploys; 1,064 commits in 5 days; ~10 agents on one tree | The cadence is AAA-live; the safety net is not | MW3, MW10, MW21 |
| **Risky-commit triage** | Ubisoft La Forge Clever-Commit: learns from past bugs and fixes to flag risky commits ([Ubisoft][clever]) | Agents write most commits; `sweepguard` and the git guards | Out of scope now. The parity harness is the cheaper version of the same idea | — |

## 5. What Wildshard already does well (keep, don't re-invent in the engine)

- **Service worker + update flow**: content-hashed caches carried over by content, no mid-session reload, the build
  pill, `Clear-Site-Data` that spares saves (`docs/design/cache-policy.md`).
- **Shader warm-up** with `KHR_parallel_shader_compile` and sliced linking (`boot/precompile.ts`). This is the web
  equivalent of Unreal's PSO precache.
- **GPU loss / app-switch recovery** (`GpuRecovery.ts`, `Resume.ts`) and the **reload budget** (`reloadGuard.ts`).
- **Physical-device incident discipline**: the multi-draw ban, the native high-water watchdog, and the rule that a
  Simulator pass is not phone evidence.
- **Observability of the page's death**: `lastEnd.ts` (intentional vs unexpected end), `lifeTrace.ts`, `/api/errors`,
  Sentry.
- **Load and asset budgets as files** (`bench.budget.json`, `scorecard.budget.json`), and "compare counts, not ms".
- **The registries**: colliders (`registry.add`), Debug options, the `Game` phases with fault-isolated labelled
  systems, native OTA with `notifyAppReady`.

## 6. Recommended rows

| Row | When | What | Done when | Source |
|---|---|---|---|---|
| MW1 | N | **Parity harness v1** from `scorecard.mjs`: boot fingerprint + poses + golden-path smoke + memory counts, 4 shards × 2 tiers (§3b) | a deliberately planted one-line regression in each wave's area fails it | SoT, three.js, Gauntlet |
| MW2 | N | **Lint ratchets on day one**: shard-branch sites, engine→shard and kit→shard imports, raw `localStorage`, `Math.random` / `performance.now` outside `core/rng` + `core/time`. Counts may only go down (a `lint/*.json` baseline, like `url-params.json`) | the counts are in CI and fall with each wave | Overwatch, Riot |
| MW3 | N | **GPU gate that decides "green"** (= plan N9): the Mac runs the §3b subset per push in ≤ 5 min and posts a commit status; `deploy.yml` deploys the newest SHA with that status; re-run once, red on the second failure; a quarantine list with owners | a broken shard boot never reaches production | SoT, Perfherder |
| MW4 | N | **Actor-test layer**: a fake `Game` (phases, clock, rng, registry, no WebGL), so engine systems (weapons, strike timing, bosses, quest core) get vitest edge-case tests | each merged duplicate group lands with its actor tests | SoT |
| MW5 | N | **Shard contract carries its budgets and warm-up**: per tier, the draw calls, tris, programs, GPU MB, textures, load s and per-system ms; its material list for precompile; its tier knobs as data. MW1 / MW3 check them | a shard over budget fails the gate; `Game.ts` no longer overrides a shard's tier data | Genshin, Arm, UE PSO |
| MW6 | N | **Engine update-LOD scheduler**: near / mid / far tick rates plus paused-when-unseen, a per-class ms budget; generalise `Animal`'s far LOD to NPCs, elites, FX and weather | frame cost of far agents measured before / after; no shard hand-rolls throttling | Genshin AI LOD |
| MW7 | N | **One `SaveStore`** in the engine: per-shard namespaces, a schema version, a migration chain, unknown fields kept (downgrade-safe), write-through as today; a fixture corpus of real saves from each past version in vitest | every current key reads and migrates; direct `localStorage` count hits 0 outside it | DataFixerUpper |
| MW8 | A | **Thermal governor, never resolution**: stages from sustained frame time; knobs are shadow reach, LOD / card distances, far-animation rate, AI tick (MW6), particle caps. Ships as a default-off Debug row with a before / after board | Jake picks it on the board; a 10-min tethered run holds the floor | CoD Mobile, WWDC26 |
| MW9 | A | **Tethered-iPhone nightly**: `webkit-mem-reading.mjs` per shard, scheduled (native memory high-water, fps over 150 s for the thermal curve, context losses) into a trend file with Perfherder-style alerts. Buy a **min-spec used iPhone** to stay plugged in | a week of nightly points per shard, with no human steps | Gauntlet, safaridriver |
| MW10 | A | **Session health per build**: on the next boot, post last session's end kind (`lastEnd`), fatal count, context losses, fps p50 / p5 per shard-minute and a GPU-bytes estimate; roll up a crash-free-session rate per build | the build pill's build id has a health line in `inbox:pull` | MetricKit |
| MW11 | A | **Budgets from a min-spec device**: write the min-spec iPhone down, measure its jetsam limit, re-derive the 1.8 / 1.0 GB targets with headroom. Today 1.8 GB = ~84 % of the 17 Pro's 2,048 MiB and above the ~1.5 GB typical limit | a signed-off budget table in `ios-memory-watchdog.md` | WebKit bug 268816 |
| MW12 | A | **KTX2 on phone for every shard** (close E248's Nine Dragon image fallback) | Nine Dragon phone runs KTX2 on the physical iPhone within MW11's budget | McCurdy |
| MW13 | N | **Per-shard bundle manifest** (decision 2): lazy code, packs per tier, KTX2 set, audio, precompile set, budgets; a build check that `main-*.js` holds no shard code | 4 shards lazy; `main` shrinks by their code; offline boot of each shard proven | Addressables |
| MW14 | A | **Measure the wasm high-water** (Rapier) across Driftwood → Nalati → Pine → Nine switches; reuse one world if it keeps growing | a number per switch in the scorecard's switch route | MDN, Godot |
| MW15 | A | **`navigator.storage.persist()` on a standalone launch**, a `storage.estimate()` readout in Debug, and save export / import (a code or file) | persisted = true on Jake's home-screen app; a save round-trips through export | WebKit storage |
| MW16 | N | **Flag hygiene**: every `DEBUG_ROWS` entry gets an ask id and a review-by date; a test lists overdue rows; a count ratchet | the overdue list prints in the session brief | Fowler / Hodgson |
| MW17 | N | **Asset audit per shard plugin**: every referenced asset exists in its tier's pack, has its KTX2 stand-in, credits, and fits the budgets; no orphans | runs in `pnpm test` for all shards and the template | SoT asset audits |
| MW18 | L | **Renderer portability rule**: new shader code only through an engine material layer; no raw GL in shards. A WebGPU spike only on Jake's word, and only with physical memory evidence | GLSL patch sites in shard folders counted and ratcheted | Safari 26 |
| MW19 | A | **Soak bot**: a navmesh wanderer per shard, 20–30 min headless nightly on the Mac: stuck states, errors, heap / GPU-byte growth, fps trend | a leak planted on purpose is caught | The Division, DICE |
| MW20 | N | **Engine API version + template shard**: `ShardDef.api` version and explicit `load` / `unload`; the template shard boots in MW1 | a 5th shard is a copied folder plus data, with no engine edit | Our Machinery |
| MW21 | A | **Health-based rollback**: when MW10 shows a new build's unexpected-end rate above the previous build's, promote the previous deployment (`release-url.sh` / Vercel) and file an ask | the drill run once on a planted bad build | Capgo |
| MW22 | L | **Record / replay** of input over seeded rng and the fixed step, for the combat smoke, only once MW2 has fenced the randomness | one 20 s replay per shard matches its fingerprint | Riot |

[genshin-ai]: https://media.gdcvault.com/GDC+2021/20210528_+GDC21_shuo_presentation+_Final.pdf
[genshin-console]: https://www.docswell.com/s/UnityJapan/KWRPQ5-210617-unity-dojo20211mihoyozhenzhongyi
[arm-budget]: https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/game-cost-budgeting-and-more-with-mobile-studio-2020-2
[pubg]: https://gdcvault.com/play/1029294/LIGHTSPEED-STUDIOS-Developer-Summit-PUBG
[pubg-int]: https://www.pocketgamer.biz/interview/81247/pubg-mobile-co-developer-discusses-optimising-unreal-for-thousands-of-phone-types/
[codm]: https://developer.samsung.com/galaxy-gamedev/gamedev-blog/cod.html
[wwdc26]: https://developer.apple.com/videos/play/wwdc2026/388/
[wuwa]: https://www.unrealengine.com/en-US/developer-interviews/exploring-the-post-apocalyptic-charm-of-asg-open-worlds-in-wuthering-waves
[ue-pso]: https://dev.epicgames.com/documentation/en-us/unreal-engine/pso-precaching-for-unreal-engine
[khr-psc]: https://caniuse.com/wf-khr-parallel-shader-compile
[unity-mem]: https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-memory.html
[unity-ab]: https://docs.unity3d.com/6000.0/Documentation/Manual/webgl-assetbundles.html
[addr]: https://unity.com/blog/engine-platform/addressables-planning-and-best-practices
[wk-mem]: https://bugs.webkit.org/show_bug.cgi?id=268816
[sky]: https://developer.apple.com/news/?id=zm47it7t
[ktx2]: https://www.donmccurdy.com/2024/02/11/web-texture-formats/
[mdn-grow]: https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory/grow
[godot-wasm]: https://github.com/godotengine/godot/issues/70621
[khr-lost]: https://www.khronos.org/webgl/wiki/HandlingContextLost
[wk-storage]: https://webkit.org/blog/14403/updates-to-storage-policy/
[wk-itp]: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
[wk-26]: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
[capgo]: https://capgo.app/docs/live-updates/rollbacks/
[sot]: https://media.gdcvault.com/gdc2019/presentations/Masella_Robert_AutomatedTestingOf.pdf
[gauntlet]: https://dev.epicgames.com/documentation/unreal-engine/gauntlet-automation-framework-overview-in-unreal-engine
[three-e2e]: https://github.com/mrdoob/three.js/pull/34572
[perfherder]: https://arxiv.org/html/2606.18377v1
[division]: https://80.lv/articles/gdc-using-ai-controlled-players-to-test-the-division
[dice]: https://www.gdcvault.com/play/1026308/AI-for-Testing-The-Development
[seed]: https://www.ea.com/seed/news/cog23-challenges-deploying-rl-agents-game-testing
[riot-det]: https://www.riotgames.com/en/news/determinism-league-legends-introduction
[safaridriver]: https://webkit.org/blog/9395/webdriver-is-coming-to-safari-in-ios-13/
[overwatch]: https://www.gdcvault.com/play/1024001/-Overwatch-Gameplay-Architecture-and
[ourmachinery]: https://ourmachinery.com/tutorials/the-plugin-system/
[toggles]: https://martinfowler.com/articles/feature-toggles.html
[dfu]: https://github.com/Mojang/DataFixerUpper
[clever]: https://montreal.ubisoft.com/en/partnering-up-with-mozilla-to-develop-an-ai-coding-assistant/
