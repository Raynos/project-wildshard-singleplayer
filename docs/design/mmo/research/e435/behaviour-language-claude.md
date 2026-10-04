# A TS-like language that compiles to WASM for Wildshard shard behaviour (E435 Fork B)

*Claude (Opus 5.5) research report, 2026-10-03. Web research plus a local lab
(`scratchpad/e435/wasm-lab/`: Node 24.18.1 (V8) and Bun 1.4.0 (JavaScriptCore, the engine iPhone Safari uses) on an
M-series Mac). Claims I could not verify are marked **[unverified]**. All numbers in §2 are my own measurements.*

---

## 0. Verdict (TL;DR)

**Top pick: AssemblyScript (AS)**, compiled to **linear-memory** Wasm (no WasmGC), behind a data-only buffer ABI, with
**fuel injected into the bytecode at upload** (one instrumented `.wasm` that every engine runs: Node, Bun, iPhone
Safari) and a **memory cap set by the host** (an imported `WebAssembly.Memory` with `maximum`).

- It is TypeScript syntax. Pine Hollow's `combatMath.ts` (97 lines, real shipping code) compiled under AS after
  **7 changed lines plus 2 added class lines**. Claude Code writes it fluently once it has a short page of AS gotchas
  (no closures that capture locals, no union types, no `any`, no try/catch, no inline object types).
- It is fast and small: equal to or faster than V8-JIT'd JS on a gameplay workload, **~20–28× faster than
  QuickJS-in-Wasm**, modules of 5–9 KB (3–4 KB gzipped) that instantiate in 0.2–0.6 ms.
- It is **deterministic across V8 and JavaScriptCore**, and plain TS is not. Wasm has no sin, cos or atan2
  instructions, so AS compiles its own libm into the module and every engine computes the same bits. **The game's
  current TS combat math already gives different bits on Node (V8) and on the iPhone (JSC).** I measured tens of
  thousands of mismatches per 200k calls (§2.4).
- The compiler is an 8 MB npm package written in TS that compiles in about 0.2 s inside Node or Bun, so the upload
  pipeline needs no Rust or LLVM toolchain.

**Runner-up: Rust**, on the same ABI. It is the most mature Wasm toolchain and Claude writes it very well. It is
"heavy" in toolchain and author ergonomics, not at runtime. Keep it for engine-grade plugins and for authors who want
it. MMO-REQUIREMENTS O4 currently says *"Rust first, AssemblyScript or QuickJS later on the same ABI"*. **My
recommendation flips that order: AS first, Rust also accepted.** Both languages produce a plain core-Wasm module, so the
host never knows which one was used.

**Avoid for sandboxed shard scripts:**
- **Every WasmGC language** (Kotlin/Wasm, Dart/Wasm, MoonBit's wasm-gc target, Wasmnizer-ts, loopdive js2). A WasmGC
  heap is the host JS heap, so a browser gives you no per-module memory cap and no memory snapshot.
- **JS-engine-in-Wasm**: StarlingMonkey/ComponentizeJS is about 8–10 MB. Javy/QuickJS is 20×+ slower; keep it only as
  an "any JS" escape hatch.
- **Porffor**: alpha, and it has pivoted to JS→C; its 2026 CLI has no direct Wasm output.
- **Static TypeScript**: it has no Wasm backend.
- **.NET** (MBs of runtime), and **Grain / TinyGo / Zig** (not TS-like; TinyGo randomises map iteration).

---

## 1. What Wildshard needs (the scoring rubric)

| Need | Why | What it implies |
|---|---|---|
| Claude Code writes it fluently, and existing TS gameplay ports with small edits | strangers author shards with Claude Code; ~20 % of today's shard code is custom TS | TS syntax and semantics close to TS |
| Untrusted and sandboxed | uploaded by strangers | Wasm core module, imports allow-listed at upload |
| **Metered** (an endless loop is stopped) | MMO server and client must survive runaway scripts | fuel that works in the **browser** too, where wasmtime fuel does not exist |
| **Memory-capped** | an author can't OOM a phone (Explorer budget 1.0 GB total) | linear memory with a host-set `maximum` |
| **Deterministic** server ⇄ client | prediction and replay | identical bits across V8 (server) and JSC (iPhone) |
| Node/Bun server and iPhone Safari | same module everywhere | core Wasm (MVP plus a few finished proposals); WasmGC only if Safari ≥ 18.2 |
| Small data-only host API | no DOM, no three.js | numbers, ids, typed arrays: shared buffers |
| Gameplay rate (events, 10–30 Hz ticks) | per-frame hot loops stay engine built-ins | startup and size matter more than peak FLOPS |

Platform facts that shape the ranking:
- **WasmGC and tail calls shipped in Safari 18.2** (iOS 18.2, Dec 2024); support continues in iOS 18.2 through 26.x
  ([caniuse](https://caniuse.com/wf-wasm-garbage-collection), [Kotlin docs](https://kotlinlang.org/docs/wasm-configuration.html)).
  Early 18.x builds had broken GC and tail calls ([platform.uno](https://platform.uno/blog/state-of-webassembly-2024-2025/)).
  WebKit sped up WasmGC by about 40 % in 2026 ([WebKit JetStream 3 post, 2026-03-31](https://webkit.org/blog/17899/introducing-the-jetstream-3-benchmark-suite/)).
- **Lockdown Mode:** historically `WebAssembly` was undefined in Lockdown Mode, even for excepted sites since iOS 17.4
  ([WebKit bug 273824](https://bugs.webkit.org/show_bug.cgi?id=273824)). Safari 18.4 added JIT-less Wasm (the IPInt
  in-place interpreter) ([Privacy Guides thread quoting WebKit notes](https://discuss.privacyguides.net/t/safari-now-supports-jitless-wasm/26558)).
  WebKit's 2026 post describes JIT-less Wasm as "a requirement in some contexts … e.g. when Lockdown Mode is enabled"
  ([WebKit](https://webkit.org/blog/17899/introducing-the-jetstream-3-benchmark-suite/)). **[unverified]**: that
  Wasm is exposed in Lockdown Mode on iOS 26; check on a device. Fallback if not: §2.6 (wasm2js keeps both the fuel
  and the determinism).
- **Wasm 3.0** (2025-09-17) standardised GC, exceptions and memory64, and defines a **deterministic profile** (fixed NaN
  results and fixed relaxed-SIMD choices) ([webassembly.org](https://webassembly.org/news/2025-09-17-wasm-3.0)).
  Browsers don't promise that profile, so the ABI rules in §6 stay away from the two remaining sources of
  nondeterminism: NaN bit patterns and relaxed SIMD.

---

## 2. Experiments (my numbers)

Lab: `wasm-lab/` (sources kept, `node_modules` and the Rust `target/` deleted afterwards). AssemblyScript 0.28.20,
quickjs-emscripten 0.32.0, Porffor 0.0.0-alpha.15, a ~90-line Rust fuel injector of my own (walrus 0.27.2).

### 2.1 Gameplay workload: a "boss move policy" (256 entities; score, pick, apply effects; sin/cos drift; per-tick object allocation)

10,000 ticks, median of 11 runs (QuickJS: median of 3):

| Build | Size (gz) | Instantiate | Node 24 (V8) | Bun 1.4 (JSC) |
|---|---|---|---|---|
| AS `--runtime incremental` -O3 | 8.8 KB (4.1 KB) | 0.33 / 0.61 ms | 50.2 ms | 45.9 ms |
| AS `--runtime minimal` -O3 | 6.8 KB (3.4 KB) | 0.26 / 0.42 ms | 32.7 ms | 30.3 ms |
| AS `--runtime stub` -O3 (bump allocator, never frees) | 5.3 KB (2.6 KB) | 0.20 / 0.25 ms | 28.4 ms | 23.9 ms |
| Plain JS, host JIT | n/a | n/a | 51.5 ms | 40.6 ms |
| **QuickJS in Wasm** (quickjs-emscripten, the baseline) | 503 KB (232 KB) | 4.1 / 5.6 ms (module) | **993 ms** | **678 ms** |

AS is on par with V8's JIT and 20–40× faster than QuickJS. `minimal` or `stub` runtimes (collect or reset per tick)
fit tick-scoped scripts best.

### 2.2 Metering: fuel injected at the bytecode level

My injector adds an exported mutable `fuel` global. At every function entry and loop header it subtracts that block's
instruction count and traps when fuel goes negative. Every engine runs the same instrumented bytes, so **the fuel used
is identical everywhere** (178,161,032 units for the 2,000-tick run on both Node and Bun). Overhead after `wasm-opt
-O3` on both sides:

| Module | Node unmetered → metered | Bun unmetered → metered |
|---|---|---|
| AS incremental (allocation-heavy) | 43.5 → 48.4 ms (**+11 %**) | 24.5 → 28.2 ms (**+15 %**) |
| AS stub (tight float loops) | 24.3 → 33.2 ms (+37 %) | 17.8 → 31.9 ms (+79 %) |

- A `while(true)` with 1e8 fuel **trapped in 7–22 ms**, and the instance kept working afterwards. Policy should
  still be to discard it (§6).
- My injector is naive: it checks at every loop header. Per-basic-block accounting with hoisted checks, as in
  [wasm-instrument](https://github.com/paritytech/wasm-instrument) and NEAR's
  [finite-wasm](https://github.com/near/finite-wasm), should cut the tight-loop overhead. **[unverified]**: by how much.
- QuickJS's interrupt handler also stops runaways, but only on QuickJS.

### 2.3 Memory cap

- AS built with `--importMemory --maximumMemory 64`, and the host passed `new WebAssembly.Memory({initial:1, maximum:64})`.
- A script that hoards 64 KB arrays **trapped at exactly 4 MiB** on Node and on Bun.
- The host owns the cap, not the author.

### 2.4 Determinism: the most important finding

**Host `Math` is not deterministic across engines.** Over 1,000,000 random inputs I counted bit-for-bit mismatches
between the host's `Math.*` and the libm that AS compiles into Wasm:

| | sin | cos | pow | exp |
|---|---|---|---|---|
| Node / V8 vs wasm libm | 9,554 | 9,573 | 2,386 | 102,648 |
| Bun / JSC vs wasm libm | 38,191 | 38,207 | 2,386 | 11 |

The mismatch sets differ, so **V8 and JSC also disagree with each other**.

**The shipping Pine Hollow combat math** (`src/shards/pine-hollow/combat/combatMath.ts`): I ran the original TS on the
host and the AS build on the same 200,000 random inputs.

| | Mismatched results |
|---|---|
| V8 | fleeHeading 22,420; wrapAngle 2,390 |
| JSC | fleeHeading 37,237; wrapAngle 42,949; headingTo 33,892 |

All of those functions go through `atan2`, `sin` and `cos`. **A Node server and an iPhone client running today's TS
compute different bits for the same fight.** The AS build runs the same Wasm bytes on both engines and computes the
same bits.

How the divergence plays out:
- After 10,000 ticks the boss sim's checksum was **1628922.9398** on AS-wasm (Node and Bun) and on QuickJS-in-Wasm,
  but **1647472.9338** as plain JS. One ulp flipped a target choice, and the runs diverged from there.
- **The host must be deterministic too.** My King port's effect stream hashed differently on Node and Bun until the
  host's own test harness (player path, motion integration) also took sin and cos from the Wasm libm. After that change
  the hash matched (`5a4fa168…` on both). Lesson: any host-side maths that feeds script inputs belongs in the
  deterministic core as well, or in Wasm.

### 2.5 Porting real code: the Antler King (the SP21 pilot)

- **`combatMath.ts` → AS:**
  - Edits: `as const` became `StaticArray<f64>`; `?? 0` was dropped; the two inline object return types became small
    classes; one default parameter got a type.
  - Diff: 7 changed lines plus 2 added.
  - Result: compiled first time; 6.1 KB.
- **`KingGoals.ts` → AS** (`port/kingGoals.as.ts`, ~110 lines):
  - The *logic* moved over almost line for line. The *shape* had to change: an abstract class calling host objects
    (`k.setMotion`, `this.ctx.hurt`, closures over `this` and `k`) became **"read an input record, append effect
    records"**.
  - That restructuring is required by *any* sandbox language with a data-only ABI; it isn't an AS cost. The
    AS-specific parts were string modes becoming `enum`s and closures being removed.
- **Results:** 6.4 KB (3.3 KB gz). A 10-minute fight at 30 Hz (18,000 ticks) ran at a **tick p50 of 0.04–0.08 µs, p99
  0.17–0.21 µs**, including the JS→Wasm call. The worst tick used 1,071 fuel units.
- **Compile time:** `asc.main()` called from Node/Bun took **176–194 ms**. The compiler package is 7.8 MB, plus
  binaryen.

### 2.6 Other measurements

- **Snapshot and rollback:** the script's 64 KiB linear memory copies in 3–5 µs and restores in 0.6–0.8 µs. That
  gives cheap prediction rollback. Caveat: AS keeps top-level `let`s in Wasm globals, so the snapshot must include them
  (§6). WasmGC cannot be snapshotted at all.
- **No-Wasm fallback (Lockdown):**
  - Binaryen's `wasm2js` turned the *already metered* MVP-feature AS build into 66 KB of JS (11.5 KB gz).
  - It produced the same checksum (1628922.9398…) and still stopped `spin()`.
  - Speed: Node 169 ms (3.4× slower than Wasm); **Bun/JSC 34.6 ms (about Wasm speed)**.
  - So a Lockdown fallback keeps metering and determinism. Caveat: JS `Math.fround` and `f32` work correctly; NaN
    payloads may differ (§6 bans observing them).
- **Porffor:** it ran the boss script correctly natively (checksum 324279.155…, 2,000 ticks). `porf c` emitted 290 KB
  of C that includes POSIX headers (`sys/mman.h`, `signal.h`, `sys/wait.h`). The alpha-15 CLI has no `wasm` command.

---

## 3. Candidate by candidate

Format: **TS-likeness** · **maturity** · **size / startup / speed** · **GC** · **determinism** · **metering** ·
**memory cap** · **debugging** · **licence** → verdict.

### AssemblyScript ★ top pick
- **TS-likeness:** TS syntax and tooling (`.ts` files, tsc-compatible types such as `i32`, `f64` and `number` = `f64`).
  Not supported: closures that capture locals, exceptions (a throw aborts), union types (except nullable classes),
  `any`, structural interfaces (rudimentary), `for..of` iterators, async/generators, RegExp/JSON in the standard
  library ([status page](https://www.assemblyscript.org/status.html)). Claude writes it well given a gotcha list;
  ported TS needs edits wherever it leans on closures, unions or object literals (§2.5).
- **Maturity:**
  - 18k stars, ~78 contributors; v0.28.20 on 2026-07-22, v0.28.19 on 2026-06-12; last push 2026-09-14; Apache-2.0
    ([GitHub](https://github.com/AssemblyScript/assemblyscript)).
  - 35–50k npm downloads/week; 29k+ GitHub projects ([Wikipedia](https://en.wikipedia.org/wiki/AssemblyScript)).
  - Production: Fastly Compute's language list ([diamondtechsoft](https://www.diamondtechsoft.com/blog/webassembly-future-web-development-2026)),
    and The Graph subgraphs **[unverified, from memory]**.
  - Risk: still 0.x after years; a small core team; the roadmap wiki was last edited 2024-11
    ([wiki](https://github.com/AssemblyScript/assemblyscript/wiki/Status-and-Roadmap)).
- **Performance:** 5–9 KB modules, 0.2–0.6 ms instantiate, roughly JIT-JS speed (§2.1).
- **GC:** in linear memory (TLSF allocator; incremental, minimal or stub runtime). It is independent of the host GC,
  so it is **deterministic and capped by `memory.maximum`**.
- **Determinism:** the libm is compiled in; Maps are insertion-ordered and string hashing is unseeded **[unverified:
  believed true from AS's std/Map design]**; `Math.random` needs a host seed import, which the host supplies from the
  shard's seeded RNG.
- **Metering:** bytecode injection (§2.2); wasmtime fuel also works if the server ever moves off Node.
- **Debugging:** source maps (`--sourceMap`, 380–430 KB `.map` for these modules), `--debug` names, an `abort(msg,
  file, line, col)` import carrying the location. **[unverified]**: how well Safari Web Inspector steps Wasm through
  source maps; Chrome DevTools supports it.
- **Licence:** Apache-2.0.

### Rust ★ runner-up
- **TS-likeness:** none syntactically. Claude Code is excellent at Rust, but ported TS gameplay becomes a rewrite.
  Strangers' Claude sessions would also fight the borrow checker on gameplay-style code with shared state.
- **Maturity:** best-in-class (LLVM, wasm-bindgen, walrus, wasm-tools).
- **Size and speed:** speed equals or beats AS (LLVM). Size `opt-level="z"`, LTO, `panic="abort"` and `wasm-opt -Oz`
  give no_std/core-only modules in the low tens of KB; std plus formatting is 100 KB+
  ([Leptos size guide](https://book.leptos.dev/deployment/binary_size.html)) **[unverified for this exact workload;
  not built: Homebrew rustc here ships without the wasm32 std]**.
- **GC:** none (ownership); linear memory, so capped.
- **Determinism:** good. The `libm` crate, or `f64::sin` with std, compiles into Wasm. Hash maps are randomly seeded by
  default (`RandomState`), so ban them or use a fixed hasher (`BTreeMap` or `FxHash`).
- **Metering:** the best tools are Rust tools (wasm-instrument, finite-wasm, walrus).
- **"Too heavy":** heavy in the author toolchain (rustup plus a target), in compile times, and in a ~1 GB build image
  for server-side builds. Not heavy at runtime.
- **Licence:** MIT/Apache.

### Porffor (AOT JS/TS → C → native/Wasm)
- 5.3k stars; publishes on every push (alpha.15 on 2026-10-02); MIT ([GitHub](https://github.com/CanadaHonk/porffor)).
- The 2026 pipeline is **JS → typed IR → C**, and "the same pipeline targets WebAssembly"
  ([porffor.dev](https://porffor.dev), [compiler docs](https://porffor.dev/docs/compiler.html)). The alpha CLI exposes
  only `run`, `c` and `native`.
- It has its own GC (`--no-gc` exists for investigation); TS annotations are hints, never trusted.
- Status is self-described as "alpha … most existing JavaScript projects will not work out of the box yet."
- Full JS semantics would be the dream for porting. But no Wasm CLI, no metering story and alpha conformance make it a
  **watch, don't build on** in 2026.

### Wasmnizer-ts (Intel ts2wasm → WasmGC)
- Strict TS subset to WasmGC, with `any` handled through host APIs.
- "Highly experimental … DO NOT use in production"; **last push 2024-11-29**, about 11 contributors
  ([GitHub](https://github.com/web-devkits/Wasmnizer-ts)). **Dead end.**

### loopdive js2 (new, 2025–26; JS/TS → WasmGC AOT)
- Loopdive GmbH; v0.71.0 on 2026-09-01; very active (pushed 2026-10-04); Apache-2.0 with LLVM exception.
- test262: 73.4 % in JS-host mode and 70.7 % standalone. Offers gc, linear and wasi targets, WIT generation and source
  maps.
- Self-described as "early-stage research prototype — a tech demo, not a production-ready compiler"
  ([JSR](https://jsr.io/@loopdive/js2), [GitHub](https://github.com/loopdive/js2)).
- The most interesting full-JS AOT effort of 2026. Its main backend is WasmGC, which has the cap and snapshot problems
  of §5. **Watch.**

### jawsm (JS → WasmGC)
- Experimental Rust project, 2024 ([post](https://itsallaboutthebit.com/jawsm/)); same WasmGC caveats. Not viable.

### Static TypeScript (Microsoft MakeCode)
- A well-designed subset: no `any`, unions, `typeof` or casts; classes, generics and closures are allowed
  ([paper](https://www.microsoft.com/en-us/research/uploads/prod/2019/09/static-typescript-draft2.pdf),
  [MakeCode](https://makecode.com/language)).
- Backends in `pxtcompiler/emitter` are **JS, ARM Thumb and a VM bytecode**; there is **no Wasm backend** (I listed the
  repo). It is part of the pxt framework, not a standalone compiler; pxt itself is active (pushed 2026-10-03, MIT).
- **Useful as a spec for the AS-style subset, not as a toolchain.**

### MoonBit
- **Language:** Rust/OCaml/Go-flavoured, not TS. Targets wasm (linear), wasm-gc, JS and native; output is tiny.
- **Maturity:**
  - Beta since June 2025 ([beta post](https://www.moonbitlang.com/blog/beta-release)); v0.10.14 on 2026-09-21
    ([notes](https://www.moonbitlang.com/updates/2026/09/21/index)).
  - 1.0 slipped from H1 2026 to "Q3 2026" ([roadmap](https://www.moonbitlang.com/blog/roadmap)).
- **Licence:** a relaxed-SSPL compiler licence. Artifacts are yours, but modifying the compiler commercially is not
  allowed ([open-source post](https://www.moonbitlang.com/blog/compiler-opensource)).
- **Claude fluency:** low; the corpus is small and the language changes monthly. MoonBit markets itself as
  "AI-native".
- **Verdict:** technically strong. The linear backend could meet every rule, but it is not TS, it is pre-1.0 and the
  licence is unusual. **Not for stranger-authored scripts now.**

### Grain
- ML-family functional language. Compiler is LGPL-3.0, stdlib MIT; 0.7.x (stdlib v0.7.2 on 2026-02-08), about 62
  contributors ([GitHub](https://github.com/grain-lang/grain),
  [changelog](https://cdn.jsdelivr.net/npm/@grain/stdlib@0.7.2/CHANGELOG.md)).
- Not TS-like, niche, pre-1.0. **No.**

### Javy / QuickJS-in-Wasm (the baseline)
- Bytecode Alliance; v9.1.0 on 2026-07-30; Apache-2.0; production at Shopify Functions
  ([GitHub](https://github.com/bytecodealliance/javy)).
- Modules are 1–16 KB when dynamically linked, but they need the ~869 KB QuickJS plugin; static linking is 869 KB+.
  Requires WASI p1 imports, so a browser needs a WASI shim.
- quickjs-emscripten (the browser-friendly binding) is 503 KB (232 KB gz) with interrupt and memory-limit hooks
  ([GitHub](https://github.com/justjake/quickjs-emscripten)).
- **Full JS, deterministic** (libm inside Wasm; my checksum matched AS). **But it is 20–28× slower** than AS (§2.1),
  each context costs startup, and debugging is console only.
- **Keep it as the "any JS" escape hatch** behind the same ABI (it's how you run an npm library), not as the default.

### StarlingMonkey / ComponentizeJS
- SpiderMonkey compiled to Wasm (WASI 0.2 component), with Wizer pre-initialisation and weval AOT. StarlingMonkey
  v0.3.0 (2026-03); ComponentizeJS 0.23.0 (2026-09-21).
- The embedding is **about 8 MB** and a trivial component's core.wasm is 10.6 MiB
  ([ComponentizeJS](https://github.com/bytecodealliance/componentizejs),
  [component-model docs](https://component-model.bytecodealliance.org/language-support/building-a-simple-component/javascript.html)).
- Browsers need `jco transpile`. **Too big for an iPhone tab running many shards. No.**

### Kotlin/Wasm
- Beta since Kotlin 2.2.20 (2025-09) ([InfoWorld](https://www.infoworld.com/article/4056077/kotlin-2-2-20-boosts-webassembly-support.html)).
  Requires WasmGC (Safari ≥ 18.2) plus exception handling ([docs](https://kotlinlang.org/docs/wasm-configuration.html)).
- Modules of a few hundred KB with stdlib (one report: 405 KB).
- Fine for apps; for untrusted scripts the WasmGC heap is uncapped and can't be snapshotted. Not TS. **No.**

### Dart/Wasm (dart2wasm)
- WasmGC. Flutter 3.44 (mid-2026) **still serves the JS build to Safari and all of iOS**
  ([startdebugging, 2026-07](https://startdebugging.net/2026/07/how-to-build-a-flutter-web-app-with-webassembly-using-flutter-build-web-wasm/)).
  That's a renderer issue, but it shows how much iOS gets exercised. Same WasmGC caveats. **No.**

### C# / .NET
- The .NET 10 browser runtime is about 1.3 MB; real apps run tens of MB, and AOT builds are larger
  ([.NET blog](https://devblogs.microsoft.com/dotnet/copilot-studio-dotnet-10-migration/),
  [MS Learn](https://learn.microsoft.com/en-us/aspnet/core/blazor/webassembly-build-tools-and-aot)).
- Mono interpreter or AOT. **Far too heavy per shard. No.**

### TinyGo
- Hello world is about 575 B to a few KB; a conservative mark-sweep GC in linear memory, so it is capped
  ([wazero](https://wazero.io/languages/tinygo/), [TinyGo size guide](https://tinygo.org/docs/guides/optimizing-binaries/)).
  v0.42.0 (2026-09-01), about 263 contributors.
- Go semantics make **map iteration order unspecified**, and Go deliberately randomises it
  ([Go issue 6719](https://golang.org/issue/6719)). **[unverified]**: whether TinyGo randomises too; ban ranging over
  maps either way.
- Not TS-like. **Viable second-tier; no reason to prefer it over Rust or AS.**

### Zig
- Excellent tiny freestanding Wasm and manual memory, so it is capped and deterministic.
- Pre-1.0 with breaking releases; Claude is less fluent; not TS-like. **[unverified]**: specifics, not tested. **No.**

### Luau-in-Wasm
- A gradually typed Lua designed for untrusted code (Roblox), with **interrupt callbacks** for time limits and a
  custom allocator for memory limits ([luau.org/sandbox](https://luau.org/sandbox)). MIT; 0.741 on 2026-10-02.
- Emscripten builds exist ([pluau / Simon Willison, 2026-03](https://simonwillison.net/2026/Mar/9/pluau-wasm-pyodide)).
  **[unverified]**: likely 0.5–1 MB of Wasm and interpreter speed roughly QuickJS-class.
- Claude knows Luau very well, and **roblox-ts compiles TS to Luau**, so a "TS → Luau → Luau VM in Wasm" route exists.
- **The best interpreter alternative to QuickJS, but still an interpreter.** It is slower and bigger than AS, and its
  metering is VM-specific.

### Component-model tooling (2025–26)
- jco (pushed 2026-10-04) and WIT are the way to *describe* an ABI across languages.
- In the browser components must be transpiled to core modules plus JS glue
  ([jco](https://github.com/bytecodealliance/jco)). A numbers-and-buffers ABI doesn't need the canonical ABI's string
  and record lowering. **Use plain core Wasm now**; a WIT file can describe the same ABI later.

---

## 4. Comparison table

★ = good fit, ◐ = workable with caveats, ✗ = poor fit for Wildshard's sandbox.

| Option | TS-like / Claude-fluent | Port existing TS | Maturity (2026) | Output size | Startup | Speed vs JS-JIT / vs QuickJS | Memory model | iOS Safari | Deterministic V8⇄JSC | Browser metering | Mem cap | Debug | Licence |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **AssemblyScript** | ★ / ★ (with gotcha list) | ◐ small edits; closures, unions, object types | ◐ 0.28.x, active, small team | ★ 5–9 KB | ★ 0.2–0.6 ms | ★ ≈1× / 20–28× faster | linear, own GC | ★ any | ★ (measured) | ★ bytecode fuel (measured) | ★ (measured) | ◐ source maps | Apache-2.0 |
| **Rust** | ✗ / ★ | ✗ rewrite | ★ | ★ 10s of KB | ★ | ★ ≥ AS | linear, no GC | ★ | ★ (ban RandomState maps) | ★ best tools | ★ | ◐ DWARF / source maps | MIT/Apache |
| QuickJS (Javy / q-emscripten) | ★ full JS / ★ | ★ as-is | ★ | ✗ 0.5–0.9 MB shared VM | ◐ 4–6 ms + context | ✗ 20–28× slower | linear (VM inside) | ★ | ★ (measured) | ◐ interrupt handler (VM-specific, deterministic if counted) | ★ setMemoryLimit | ◐ console | MIT / Apache |
| Luau-in-Wasm | ◐ typed Lua; roblox-ts / ★ | ◐ via roblox-ts | ★ VM; ◐ Wasm builds | ✗ ~0.5–1 MB [unverified] | ◐ | ✗ interpreter | linear (VM inside) | ★ | ◐ likely [unverified] | ◐ interrupt callback | ★ allocator | ◐ | MIT |
| Porffor | ★ full JS/TS / ★ | ★ (once conformant) | ✗ alpha, C pivot | ◐ (C 290 KB for a demo) | ? | ? | linear, own GC | ? (no Wasm CLI) | ? | ✗ none | ? | ✗ | MIT |
| loopdive js2 | ★ JS/TS / ★ | ◐ 73 % test262 | ✗ research prototype | ◐ | ? | ? | **WasmGC** (linear target exists) | ◐ ≥ 18.2 | ? | ✗ | ✗ on GC target | ◐ source maps | Apache-2.0+LLVM |
| Wasmnizer-ts | ◐ strict TS / ◐ | ◐ | ✗ dead since 2024-11 | ◐ | ? | ? | WasmGC | ◐ | ? | ✗ | ✗ | ✗ | Apache-2.0 |
| Static TypeScript | ★ subset / ★ | ◐ | ★ inside pxt only | n/a | n/a | n/a (no Wasm) | n/a | n/a | n/a | n/a | n/a | n/a | MIT |
| MoonBit | ✗ / ◐ | ✗ | ◐ beta, 1.0 pending | ★ tiny | ★ | ★ | linear or WasmGC | ★ / ◐ | ★ likely | ★ (core Wasm on linear target) | ★ on linear target | ◐ | relaxed SSPL (compiler) |
| Grain | ✗ / ✗ | ✗ | ✗ 0.7 | ◐ | ◐ | ◐ | linear, own GC | ★ | ? | ★ core Wasm | ★ | ✗ | LGPL / MIT |
| Kotlin/Wasm | ✗ / ★ | ✗ | ◐ beta | ◐ 100s of KB | ◐ | ★ | **WasmGC** | ◐ ≥ 18.2 | ◐ | ◐ needs GC-aware injector | ✗ | ◐ | Apache-2.0 |
| Dart/Wasm | ✗ / ★ | ✗ | ★ (Flutter) | ✗ MBs w/ Flutter; small for pure Dart [unverified] | ◐ | ★ | **WasmGC** | ◐ (Flutter skips iOS) | ◐ | ◐ | ✗ | ◐ | BSD |
| .NET | ✗ / ★ | ✗ | ★ | ✗ MBs | ✗ | ◐ | linear (Mono) | ★ | ◐ | ✗ | ★ | ◐ | MIT |
| StarlingMonkey | ★ full JS / ★ | ★ | ◐ | ✗ 8–10 MB | ✗ | ◐ (weval) | linear (VM) | ◐ via jco | ★ likely | ◐ | ★ | ✗ | Apache/MPL |
| TinyGo | ✗ / ★ | ✗ | ★ | ★ KBs | ★ | ★ | linear, conservative GC | ★ | ◐ (map order) | ★ | ★ | ◐ | BSD-3 |
| Zig | ✗ / ◐ | ✗ | ◐ pre-1.0 | ★ | ★ | ★ | linear, manual | ★ | ★ | ★ | ★ | ◐ | MIT |

---

## 5. Cross-cutting findings

1. **Linear memory beats WasmGC for *sandboxed* scripts.** A WasmGC module's objects live in the host's JS heap, and no
   browser API caps one module's share or snapshots it **[unverified as an absolute claim, but I know of no such
   API]**. Linear memory gives:
   - a hard cap (`maximum`);
   - free snapshot and rollback (copying 64 KiB takes µs);
   - deterministic allocation addresses, which make bugs reproducible across machines.

   WasmGC on iOS works (18.2+), but for a sandbox it's the wrong primitive.
2. **Determinism lives in Wasm, not in "TS".** The same script source gives different bits on V8 and JSC whenever it
   touches transcendental `Math` (§2.4). Compiling to Wasm with an embedded libm fixes this for the script.
   - The host's own simulation that feeds script inputs must be deterministic too.
   - Remaining Wasm nondeterminism: NaN bit patterns, relaxed SIMD, stack-overflow depth (engine-specific), and
     anything imported. The ABI rules (§6) close each one.
3. **Metering must be in the bytecode** to work in the browser and to be identical on server and client.
   - Wasmtime fuel and epochs ([docs](https://docs.wasmtime.dev/examples-interrupting-wasm.html)) exist only on
     wasmtime.
   - A Worker-plus-`terminate()` watchdog is neither deterministic nor synchronous.
   - Injection costs 11–15 % on realistic code with a naive injector (§2.2), and it also lets you **bill fuel
     identically** on server and client.
   - Add a **call-depth counter** too (finite-wasm and wasm-instrument both inject stack limits), so recursion traps
     at the same depth everywhere instead of at each engine's native stack size.
4. **Toolchain weight is the real "Rust is heavy" cost.** AS compiles inside Node in about 0.2 s; Rust needs a native
   toolchain on the build server and on every author's machine.

---

## 6. Proposed host ABI (language-neutral; AS first)

**Shape:** a core Wasm module (no WASI, no component model), loaded per shard instance. Data goes through two typed
regions in the module's own linear memory: an **input record and event queue** written by the host, and an **effect
queue** written by the script. The script never calls the host mid-tick except for a tiny pure import set, so each
call is a deterministic function of inputs ⊕ memory ⊕ globals.

### 6.1 Upload-time validation and instrumentation (server, Node)
1. Compile (`asc`, or accept a prebuilt `.wasm` from Rust or anything else).
2. **Validate:**
   - only allow-listed imports: `env.memory`, `env.abort`, `env.log` (dev only), `env.seed`;
   - Wasm features limited to MVP plus mutable-globals, sign-ext, bulk-memory and nontrapping-f2i;
   - **reject threads, relaxed-SIMD, SIMD (for now), GC, memory64 and exceptions**;
   - required exports present;
   - size cap of about 256 KB.
3. **Instrument:** fuel global, call-depth limit, then re-run `wasm-opt -O3`. Store the *instrumented* bytes and their
   hash; server and client load identical bytes.
4. Optionally emit a `wasm2js` twin for no-Wasm clients (Lockdown), generated *after* instrumentation.

### 6.2 Module contract
```ts
// ---- exports every script provides ----
abi_version(): i32                    // = 1
init(seed_lo: i32, seed_hi: i32): void // once per instance; author state setup
in_ptr(): usize; in_cap(): i32         // input region (host writes)
out_ptr(): usize; out_cap(): i32       // effect region (script writes)
on_tick(): void                        // 10–30 Hz: reads IN header, drains events, writes effects
out_count(): i32                       // effects written this call
// exported by the instrumenter, not the author:
fuel: mutable i32 global               // host sets per call; trap when < 0
// ---- imports (the whole host API) ----
env.memory  : WebAssembly.Memory {initial, maximum}  // host-owned cap (e.g. 1–4 MiB per script)
env.abort(msg, file, line, col): never               // AS assertion → host logs + kills instance
env.seed(): f64                                      // deterministic: from the shard's seeded RNG, never Math.random
```

### 6.3 Input record (host → script; little-endian; f64 slots keep JS writes cheap)
```
IN[0]  tick number            IN[1] dt (fixed, e.g. 1/30)     IN[2] sim time
IN[3]  self entity id         IN[4..6] self x,y,z             IN[7] self yaw    IN[8] self hp frac
IN[9]  target id              IN[10..12] target x,y,z         IN[13] target airborne(0/1)
IN[14] device/lane state …    (per-script schema declared in the shard's data file: name → slot)
IN[32] event count N, then N × 6 f64: [type, a, b, c, d, e]
       types: Hit(attacker, dmg, part) · TriggerEnter(zoneId, entityId) · DeviceDone(deviceId)
              · Interact(entityId, verbId) · Timer(timerId) · QuestFlag(flagId, value)
```

### 6.4 Effect records (script → host; validated before they touch the world)
```
[op, a, b, c, d] × out_count()   (cap e.g. 32 per tick; extra effects dropped and counted)
Motion(yaw, speed, turnRate) · Action(animId) · Attack(windup) · Contact(strikeId, traumaOnHit)
Ring(x, z, r, alpha) / RingHide · Sound(soundId) · Spawn(archetypeId, x, z) · CallThralls(n)
SetFlag(flagId, value) · StartTimer(timerId, seconds) · DeviceCmd(deviceId, verbId, arg)
Damage(entityId, amount, kind) · Say(stringTableId) · LaneStart(x, z, speed)
```
- Ids index the **shard's data tables** (sounds, anims, strikes, strings), so no strings cross the ABI.
- The host rejects any effect with a non-finite number, an out-of-range id or a rate-limit violation. That is also the
  NaN-payload rule: **scripts may compute NaN, but a NaN never crosses the ABI**.
- The host resolves physical outcomes itself: `Contact` is resolved by the engine's hit query, `DeviceCmd` by the
  approved device. A script *requests*; approved systems *do*.

### 6.5 Host loop (same code on server and client)
```ts
const mem = new WebAssembly.Memory({ initial: 1, maximum: 64 });          // 4 MiB cap
const { instance } = await WebAssembly.instantiate(bytes, { env: { memory: mem, abort, seed } });
const x = instance.exports as ScriptExports;
x.init(seedLo, seedHi);
function tick(input: Float64Array, events: Float64Array): Effect[] {
  const f64 = new Float64Array(mem.buffer);                                // re-view after growth
  f64.set(input, x.in_ptr() >> 3); f64.set(events, (x.in_ptr() >> 3) + 32);
  x.fuel.value = FUEL_PER_TICK;                                            // e.g. 200k units
  try { x.on_tick(); } catch { return quarantine(script); }                // trap = fuel, OOM, depth, abort
  return decodeAndValidate(f64, x.out_ptr() >> 3, x.out_count());
}
```
- **Lifecycle:** on any trap, the instance is **discarded**, because AS's GC invariants may be mid-update. Re-instantiate
  from the last good **snapshot**, meaning the memory bytes *plus* the mutable globals. Have the instrumenter export
  every mutable global (or require author state to live in memory) so a snapshot is complete. Repeat offenders get
  disabled per the shard's policy.
- **Prediction and replay:** the client snapshots before predicted ticks and restores on server correction (µs, §2.6).
  The server's effect stream and fuel totals hash-match the client's (§2.4).

### 6.6 What an author writes (AS)
```ts
import { input, events, emit, Op, Ev } from "@wildshard/script";   // tiny AS lib over the ABI
let mode = Mode.Stalk;                                              // state lives in the module (snapshotted)
export function on_tick(): void {
  for (let i = 0; i < events.count(); i++) if (events.type(i) == Ev.Hit) onHit(events.a(i));
  const d = Math.hypot(input.targetX() - input.selfX(), input.targetZ() - input.selfZ());
  if (mode == Mode.Stalk && d < 7.1) { emit(Op.Action, Anim.Sweep); mode = Mode.Sweep; }
}
```
The same `@wildshard/script` surface can be written as a Rust crate, so Rust authors target ABI v1 too.

---

## 7. Ranked recommendation

1. **AssemblyScript on linear memory + injected fuel + host-set memory cap + data-only buffer ABI.**
   - Why: TS-shaped, so Claude writes it and today's gameplay TS ports. Small and fast on the iPhone. Bit-identical on
     server and client, which plain TS demonstrably is not. The compiler runs inside the Node upload pipeline.
   - Mitigations:
     - ship an `AS-GOTCHAS.md` and a lint for the unsupported features;
     - pin the AS version per ABI version, since it is 0.x;
     - keep the ABI language-neutral, so a stalled AS can't strand content.
2. **Rust** on the same ABI: for engine-grade or heavier plugins and for authors who prefer it; the backbone if AS ever
   stalls. Not the default authoring language for strangers.
3. **QuickJS (quickjs-emscripten) as the "any JS" tier** on the same ABI, with a lower fuel budget per tick. It's the
   compatibility valve for npm-style logic and rapid prototyping; it is deterministic, just 20×+ slower.

**Avoid:**
- WasmGC languages for sandboxed scripts (Kotlin, Dart, Wasmnizer, js2's GC target, MoonBit's wasm-gc target): no cap,
  no snapshot.
- StarlingMonkey/ComponentizeJS (8–10 MB).
- Porffor until it ships a Wasm CLI and passes much more of test262.
- Static TypeScript (no Wasm backend).
- .NET (size), Grain (niche), and TinyGo/Zig (no advantage over Rust; TinyGo map order).

**Concrete next steps for SHARD-PLATFORM P4:**
- **SP20:** build the plugin host on this ABI, using the injector from this lab or a binaryen.js port of it so the
  pipeline is all Node, plus a stack-depth limit.
- **SP21:** pilot the King port here (`port/kingGoals.as.ts` is a working start) against the parity harness.
- **Separately:** route the deterministic core's own trig (atan2, sin, cos) through one deterministic libm. Today's
  shipping combat math diverges between V8 and JSC.
- **Change MMO-REQUIREMENTS O4** from "Rust first" to "AssemblyScript first, Rust also; one ABI". That change is
  Jake's pick.

---

## 8. Open questions and unverified items
- Is Wasm exposed in iOS 26 Lockdown Mode for a site the user has excepted? Test on a device; the wasm2js twin covers
  the "no" case.
- Safari Web Inspector stepping AS through source maps; not tested.
- A tuned injector (per-basic-block, hoisted) on tight-loop code; I expect well under the naive +37–79 %, not measured.
- Whether AS's `Map` iteration is insertion-ordered and its hashing unseeded: believed true, not re-verified.
- TinyGo map randomisation, Luau-Wasm size and speed, Rust module size for this workload, and Porffor's C→Wasm path:
  none built here.
- Phone numbers: all timings are M-series desktop. Expect the iPhone, thermally throttled, to be about 2–4× slower. The
  King tick still costs well under 1 µs.

## Sources
AssemblyScript: [repo](https://github.com/AssemblyScript/assemblyscript) · [status](https://www.assemblyscript.org/status.html) · [roadmap wiki](https://github.com/AssemblyScript/assemblyscript/wiki/Status-and-Roadmap) · [Wikipedia](https://en.wikipedia.org/wiki/AssemblyScript) ·
Porffor: [repo](https://github.com/CanadaHonk/porffor) · [site](https://porffor.dev) · [compiler docs](https://porffor.dev/docs/compiler.html) · [honk.foo post](https://honk.foo/porffor/) ·
[Wasmnizer-ts](https://github.com/web-devkits/Wasmnizer-ts) · [loopdive js2 (JSR)](https://jsr.io/@loopdive/js2) · [js2 repo](https://github.com/loopdive/js2) · [jawsm](https://itsallaboutthebit.com/jawsm/) ·
Static TypeScript: [paper](https://www.microsoft.com/en-us/research/uploads/prod/2019/09/static-typescript-draft2.pdf) · [MakeCode languages](https://makecode.com/language) · [pxt](https://github.com/microsoft/pxt) ·
MoonBit: [beta](https://www.moonbitlang.com/blog/beta-release) · [roadmap](https://www.moonbitlang.com/blog/roadmap) · [v0.10.14](https://www.moonbitlang.com/updates/2026/09/21/index) · [licence](https://www.moonbitlang.com/blog/compiler-opensource) ·
Grain: [repo](https://github.com/grain-lang/grain) · [changelog](https://cdn.jsdelivr.net/npm/@grain/stdlib@0.7.2/CHANGELOG.md) ·
[Javy](https://github.com/bytecodealliance/javy) · [quickjs-emscripten](https://github.com/justjake/quickjs-emscripten) · [StarlingMonkey](https://github.com/bytecodealliance/StarlingMonkey) · [ComponentizeJS](https://github.com/bytecodealliance/componentizejs) · [component-model JS docs](https://component-model.bytecodealliance.org/language-support/building-a-simple-component/javascript.html) · [jco](https://github.com/bytecodealliance/jco) ·
Kotlin: [Wasm config](https://kotlinlang.org/docs/wasm-configuration.html) · [InfoWorld 2.2.20](https://www.infoworld.com/article/4056077/kotlin-2-2-20-boosts-webassembly-support.html) ·
Dart: [Flutter Wasm](https://docs.flutter.dev/platform-integration/web/wasm) · [startdebugging 2026-07](https://startdebugging.net/2026/07/how-to-build-a-flutter-web-app-with-webassembly-using-flutter-build-web-wasm/) ·
.NET: [devblogs](https://devblogs.microsoft.com/dotnet/copilot-studio-dotnet-10-migration/) · [MS Learn AOT](https://learn.microsoft.com/en-us/aspnet/core/blazor/webassembly-build-tools-and-aot) ·
TinyGo: [size guide](https://tinygo.org/docs/guides/optimizing-binaries/) · [wazero](https://wazero.io/languages/tinygo/) · [Go map order](https://golang.org/issue/6719) ·
Rust: [Leptos size](https://book.leptos.dev/deployment/binary_size.html) ·
Luau: [sandbox](https://luau.org/sandbox) · [pluau](https://github.com/gluau/pluau) · [Willison](https://simonwillison.net/2026/Mar/9/pluau-wasm-pyodide) ·
Platform: [caniuse WasmGC](https://caniuse.com/wf-wasm-garbage-collection) · [WebKit bug 273824](https://bugs.webkit.org/show_bug.cgi?id=273824) · [JIT-less Wasm thread](https://discuss.privacyguides.net/t/safari-now-supports-jitless-wasm/26558) · [WebKit JetStream 3](https://webkit.org/blog/17899/introducing-the-jetstream-3-benchmark-suite/) · [Wasm 3.0](https://webassembly.org/news/2025-09-17-wasm-3.0) · [platform.uno](https://platform.uno/blog/state-of-webassembly-2024-2025/) ·
Metering: [wasmtime interrupting](https://docs.wasmtime.dev/examples-interrupting-wasm.html) · [wasmtime determinism](https://docs.wasmtime.dev/examples-deterministic-wasm-execution.html) · [wasm-instrument](https://github.com/paritytech/wasm-instrument) · [finite-wasm](https://github.com/near/finite-wasm) · [walrus](https://crates.io/crates/walrus)
