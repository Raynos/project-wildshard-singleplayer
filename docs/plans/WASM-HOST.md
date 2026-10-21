# Plan: WASM-HOST — a fast, batched Wasm host for shard AssemblyScript

**State:** `in progress` (view lane only) 2026-10-21: Jake started **H0, H0b, H1–H6, H9, H13** scoped to Pine Hollow and Driftwood's per-frame view code (SHARD-PLATFORM G570, [dw-pine-zero-mini-plan.md](shard-platform/dw-pine-zero-mini-plan.md) row ZF); every other row stays parked until Jake says. Was: `open`, parked (2026-10-20): design now (two council rounds, H0 numbers); **nothing is built until Jake says
so**. Not built by the SHARD-PLATFORM builder or its lanes (G517).

Jake, 2026-10-20 (E489): *"It goes off the shard platform. I don't want to fuck around the builder with changing the
assembly script engine. It requires a lot of thought. And if we're going to fix it, we should fix it properly. … to
beef up what can be done with WASM to make it more performant, to unlock new capabilities so that other shards going
forward have more capabilities. And we might need some of these stuff to finish the shard platform to zero."* Earlier
the same morning: *"we want to absolutely min-max the JavaScript wasm boundaries … as few boundary calls as possible,
and for the wasm to do as much work with as much context as it needs"*; *"once you enter the WASM, it shouldn't be
going back into JavaScript"*; *"I do feel long term we want to run assembly code at 60 hertz or 30 hertz."*

Explainer: [Wasm Host v2](https://claude.ai/artifact/1WXaRYWNBAvABBeH4HvrAA) (why, problem, solution, trade-offs, plan).
Research: [AssemblyScript Step Lanes](https://claude.ai/artifact/Bu7aPc7FeeJM8BS6vgdU7m) (the 30/60 Hz audit and the
from-scratch design). The as-built contract is [SCRIPT-ABI.md](../SCRIPT-ABI.md).

## Why

Three separate costs, all measured from code; their relative CPU share is unmeasured until H0 (R1-01):
- **Module-sized fuel price.** Every function entry and every loop iteration charges `bytes*4 + 128*functions + 1024`
  of the whole module (`src/sdk/bake/compileScript.ts:56`). Pine's shipped `life` module pays 32,064 per iteration (the charge
  is computed from its uninstrumented input) (R2-18): about 12 iterations fit in a 400k call, and a 64-point loop (2.05M) exceeds even the 2M hard cap.
  That, not JS speed, is why integrators are refused today.
- **JS calls inside guest code.** Every function entry, loop header and f32/f64 op calls a JS import (`fuel`,
  `enter`/`leave`, `finite32`/`finite64`: `compileScript.ts:30,40,63,72`).
- **Memory copies.** Every v1 call rewinds the whole 64–256 KiB memory (`src/engine/script/decisionModule.ts:132-135`);
  every successful v0 call slices the whole memory (`host.ts:125-129`); every `ReturnProgram.project` rewinds
  (`src/game/population/returnProgram.ts:90`) (R1-23).

And two capability gaps:
- **Only ~10 Hz event decisions exist** (G503). Per-frame and 60 Hz logic (combo windows, blade sampling, weather
  light pushes) has to become a shared host or stay counted shard TypeScript.
- **New shards should be data plus AS with no TypeScript**, including combat feel and motion.

## The design (from scratch)

- **Three entry kinds plus bake** (R1-17). Events and sim are one mechanism: a fixed-tick, saved step with a divisor.
  **Sim** scripts run at one fixed rate on every device (10 Hz, or 30 Hz with a written reason, W9) inside the engine's
  60 Hz fixed step. **Projections** (`ws_project`) are synchronous, stateless call-and-return inside host code (today's
  `ReturnProgram`: about 109 `.project` calls in 35 files, many in dependent chains such as `encounterPatrol.ts:81-106`),
  batched per owner where callers are independent. Each projection family is tagged **sim** (runs headless, W13) or
  **view** (client-only, moves to `ws_view`); sim projections take terrain from their owner host, never the global
  `terrainHeight` port (R2-12, R2-14). **View** is client-only at the display rate, never saved, freezes on
  a trap. **Bake** is offline (generators).
- **One entry per module per tick; the module is the trust boundary** (R1-11, R2-02, R2-03). A module has one author, so
  its capabilities are the union of its rows' `reads` and `commands`, checked on every command. The host writes one
  observation block and calls `ws_step(tick, fuel)` once; exported entries are callable only by the host (admission
  refuses guest calls to them, so no entry can refill fuel). The guest SDK runs each due binding, reads the fuel global
  (read-only access is allowed) at each binding boundary and traps itself when a binding passes its slice; the module
  budget is the hard bound. v1's quotas stay (32 commands per call, 128 per tick, 4 spawns, 8 timers). The SDK writes
  the running binding id into a slot before each binding; on a trap the host treats it as a hint, discards that call's
  outputs and re-steps the module once without that binding; a second trap skips the whole module for that tick, and
  three-strike failures count per module. Execution and commit order is by stable declared binding id.
- **Staggered modules** (R1-10, R2-04): module *m* runs on ticks where `tick % divisor == m % divisor`, so 10 Hz work
  spreads over six fixed steps instead of spiking every sixth frame, without entering every module every step;
  bindings inside a module spread further only past a declared count.
- **Observations, inputs and queries** (R1-06, R1-07). Each sim tick the host fills standard per-binding observations
  in one batched physics + navmesh pass before the step (ground under self, line of sight to the player, nearest
  walkable, distance), plus **input edges stamped with the 60 Hz tick they happened on** and an `atTick` on every event,
  so ~100 ms windows resolve at 16.7 ms even at 10 Hz. Stamps are host-written: on a server, the receipt tick bounded by
  a lag window of at most 6 ticks (R2-11). Observations and input edges are keyed by player handle with a bounded count;
  the single-player client fills one row, so an MMO server needs no ABI v3 (R2-17). Other queries go in a request ring with request ids, answered
  in the same tick's `afterBodies` phase (`decisions.ts:184`) and delivered next sim tick; in-flight requests are part
  of the save. Dependent terrain heights come from a guest-readable height grid. **Contact never goes through
  queries**: the guest issues strike/sweep commands and the 60 Hz strike or held-melee host returns hit events. Those
  hosts are sim-side and run wherever the sim runs (R2-11).
- **Movers stay native** (R1-09). A guest emits motion segments (target, ticks, easing); the physics owner evaluates
  them every 60 Hz fixed step before collision; the save holds the segment and elapsed ticks.
- **No JS calls inside guest code, hostile-binary safe** (R1-02, R1-03). A fuel global internal to the module (never
  exported) is decremented per basic block by instruction count; the budget arrives as a `ws_step` argument and the
  remainder is returned. Admission checks the exact charge sequence at every entry and loop header and refuses any
  other access to that global; builds the direct-call graph, refuses cycles and refuses a longest path over 64 so depth
  is static; replaces `abort` with a local trap; admits no guest function imports. NaN checks become inline in-Wasm
  traps on float stores and reinterpret inputs; reinterpret stays allowed (AS's own Math needs it); SIMD and relaxed
  SIMD stay refused.
- **Sim lane resets each entry** (R1-05, R2-01). Committed state lives in host-owned columns outside guest memory;
  candidate writes are validated before commit. Before every sim and projection entry, and before a re-step, the host
  restores the **whole** memory image plus every mutable global (any byte is otherwise hidden storage: a raw store above
  the heap pointer survives a partial reset). Sim memories are one 64 KiB page where possible, so the copy stays small.
  Every mutable global stays exported except the fuel global. Only the view lane keeps memory between frames (W10).
- **View lane** (R1-15, R1-16, R2-04, R2-05, R2-06). Each sim tick the host copies declared public sim columns
  (previous and current, each stamped with its sample tick) into the view block; the SDK computes each binding's own
  interpolation from those stamps, so staggered modules interpolate correctly. **No local-player prediction**: each sim
  tick the guest publishes its cancel/combo transition table as data (input, from-tick, to-tick, next move), and the 60 Hz
  held-melee host applies it the instant the input arrives, so the swing starts at once, contact matches visuals, nothing
  rolls back and a server runs the same table. Hit-stop stays presentation-only. After `ws_view` returns, the host
  validates and clamps transforms in place (translation, scale, shear) against declared bounds and sets `needsUpdate`
  only on success, so the GPU keeps the last good upload (zero-copy kept); on a trap or NaN the binding freezes, and after
  a WebGL context loss a frozen binding is hidden rather than re-uploaded.
- **Nothing client-only feeds the sim** (W13, R2-12): wall clock, frame `dt`/alpha, display rate, tier, Low Power Mode,
  Debug/Developer rows, camera, view columns, page residency or streaming radius as an activation trigger, and
  `Math.random` never reach a sim binding or sim projection; activation comes from world state. Timers count sim ticks
  and pause while offline; wall-clock catch-up belongs to the future MMO plan (R2-13).
- **One memory per shard module per lane**, fixed size so typed views never detach; never shared with Rapier or
  engine Wasm. The host reads only offsets it owns and clamps every count.
- **Engine in Wasm only where a profile proves it**: a Rapier batch wrapper (Rust) and a SIMD animation sampler are
  candidates; particles and cloth stay on the GPU. Shards stay AssemblyScript (G454 (4)/(6), W8) (R1-24).

## Decisions (Jake, 2026-10-20 grill)

| # | Decision |
|---|---|
| W1 | **Ambition: A now, B on evidence.** Fix the host (AS shards, JS engine, no JS calls inside guests, batched entries, sim and view lanes). Each engine-in-Wasm piece (H10, H11) starts only when a phone profile shows it. No Rust engine core. |
| W2 | **Outside authors.** Design for untrusted scripts: in-Wasm fuel, output validation, one memory per shard module per lane. |
| W3 | **Phone numbers: the Simulator plus one benchmark page** Jake opens once on his iPhone; it runs and reports by itself. |
| W4 | **Parked: design now, build only when Jake says.** |
| W5 | **ABI v2 replaces v1 and v0 in one go**: every existing script (Nalati, Pine, Driftwood, Sky, Signal, the v0 lanes) is ported in the same wave, v1/v0 deleted, one save migration. |
| W6 | **Guest pure, loads valid** (re-picked after council R1-04): a sim step gives bit-identical results on every device for the same state and observation block (geometry helpers in AS math, no host Math in the guest path). A desktop save loads on the phone and plays on validly, drifting with physics (rapier3d-simd, dropped backlog ticks). Co-op later uses one authoritative host, not lockstep; a parked row (H16) covers a deterministic physics build. |
| W7 | **Two council rounds** on this plan before it parks ([COUNCIL.md](../process/COUNCIL.md)). |
| W8 | **Language-neutral binary ABI, AssemblyScript SDK first**; a Rust SDK stays possible later. |
| W9 | **Sim lane at 10 Hz, or 30 Hz with a written reason**, the same on every device; no 60 Hz sim scripts. Jake: *"stays at 10hz or 30hz if you need it to go up from 10hz explain why"*. Reasons that qualify: player-felt combat windows (parry/combo) and gameplay contact (movers the player stands on, projectile hits). The view lane smooths visuals between sim steps. SHARD-PLATFORM keeps G503's ≤ 10 Hz. Re-confirmed after council R1-07: 30 Hz stays allowed but every first user is expected to fit 10 Hz, since inputs carry their 60 Hz tick and contact and movers stay native. |
| W10 | **View lane: display rate, halving under budget, memory persists between frames**; client-only, never saved, freezes on a trap. |
| W11 | **Threads: not now**; a parked row once v2 is profiled on the phone. |
| W12 | **Done = a demo shard plus a budget**: a sample shard whose combo, mover and view effect are pure AS with zero shard TS, a phone reading of ≤ 1 ms per frame for 20 active bindings, every existing script on v2, v0/v1 deleted. |
| W13 | **Server-runnable sim, MMO-ready** (Jake, 2026-10-20: *"We need an MMO server … play on the desktop, make progress … log out on desktop, log in on the phone, and log in right where they were"*): continuity is state-based through one authoritative server, never replay or lockstep. The sim lane and `ws_project` run headless in Node from the same admitted bytes, take no client-only inputs, and save with stable ids and a versioned schema; the view lane stays client-only. The MMO server, client prediction and server-side saves are a future plan, not this one. |

## Rows

| Row | What | Effort (est.) | Status |
|---|---|---|---|
| **H0** | Benchmark on the existing calibration page (`/calibration/`, `src/engine/calibrate/`) Jake opens once (W3), plus the Mac and the Simulator. Measures JS→Wasm entry, Wasm→JS import, internal vs exported fuel global, the whole-image reset, Rapier sync/query cost (H10's trigger) and real Nalati/Pine scripts across the three Why costs. Timing: JIT warm-up, then adaptive batches repeated until ≥ 50 ms elapse, reported as ns/op (Safari's clock is ~1 ms without cross-origin isolation). Results post like today's calibration (`sendNote` perf → `/api/inbox`, read by `pnpm inbox:pull`), with build and module hashes, upload acknowledged before the page says done; Low Power Mode recorded as `unknown`, inferred or confirmed, never inferred from 30 fps alone. Decision rules, per frame (entries × steps): a Wasm→JS import round trip ≤ 2× a direct Wasm call counts as cheap → H4/H6 drop in priority (H1–H3 still land); fuel overhead over 15 % → coarser per-block charges (R1-13, R2-07, R2-08) | 1–2 days | open |
| **H0b** | **ABI v2 wire contract** written before any code: every region's layout, alignment, scalar widths (ticks i32; durable columns f64 so v1 slots round-trip), version field, lengths validated from host metadata, overflow handling, memory sizing, the three entries' signatures, per-player keyed observation rows, per-binding sample-tick stamps, view halving thresholds, minimum rate and recovery (R1-20, R2-04, R2-17) | 1–2 days | open |
| **H1** | Replace the per-op `finite32`/`finite64` imports with inline in-Wasm NaN traps on float stores and reinterpret inputs; validate outputs; keep refusing SIMD (R1-03) | 0.5–1 day | open |
| **H2** | Internal per-basic-block fuel global (budget in, remainder out); exported entries callable only by the host; admission verifies the charge sequence, allows only read access elsewhere, refuses call-graph cycles and depth over 64; local trap replaces `abort`; no guest imports; applies to every entry including init and view; recalibrate the ceiling; rejection tests include an acyclic entry-calls-entry refill (R1-01, R1-02, R2-02) | 1–2 days | open |
| **H3** | Whole-image reset plus globals before every sim/projection entry and re-step; one-page sim memories where possible; committed state in host-owned columns; a test that writes raw addresses and scrambles scratch between steps and expects identical results (R1-05, R2-01) | 0.5–1 day | open |
| **H4** | Host-written observation block (standard per-binding observations, 60 Hz-stamped input edges, `atTick` on events) plus an AS SDK geometry library (distance, bearing, radial in AS math), replacing per-value `ws_read` calls (R1-07) | 3–5 days | open |
| **H5** | Request ring for other queries (ray, overlap, path, walkable) with ids, answered in the same tick's `afterBodies` phase by one batched physics + navmesh pass, delivered next sim tick, saved in flight; guest-readable height grid; contact stays in the 60 Hz strike/held-melee hosts (R1-06) | 3–5 days | open |
| **H6** | One `ws_step` per module per tick; module as trust boundary (union capabilities, SDK-enforced per-binding slices, one re-step, then skip); staggered modules (R1-10, R1-11, R2-02, R2-03, R2-04) | 3–5 days | open |
| **H6b** | `ws_project` entry: synchronous stateless projections, batched per owner where callers are independent; ~109 calls in 35 files, each family tagged sim or view; dependent chains (e.g. `encounterPatrol.ts`) rewritten as staged continuations; borrowed RNG rollback kept (R1-17, R2-12, R2-14) | 4–6 days | open |
| **H7** | Saves as declared state columns plus pending events, staged commands, in-flight queries, timers, RNG and failures | 2–3 days | open |
| **H8** | Sim step lane at 10 Hz, or 30 Hz with a written reason (W9), opt-in per row, only while active. First real user: Nine's Jian **input windows and combo transition table** in AS while the G475 held-melee host keeps contact, hit-stop and applies the table at 60 Hz, so the host keeps its user (R1-21, R2-05). Movers stay native via motion segments; only far-reach-legacy's v0 mover is ported or deleted with it (R1-09) | 3–5 days | open |
| **H9** | View frame lane (W10): `ws_view(dt, alpha)` at the display rate, halving under budget (thresholds, minimum rate and recovery defined in H0b), memory kept between frames, stamped sim columns copied in, in-place validation with `needsUpdate` only on success. First real users: the pastel-plain, ink-cel-valley and `_template` client scripts; delete DecisionHost's dead `side:'view'` paths (R1-15, R1-16, R1-21, R2-04, R2-06) | 1–2 weeks | open |
| **H10** | Rapier batch wrapper (`sync_poses`, `cast_rays`), only if an iPhone profile shows the cost | 1–2 weeks | open |
| **H11** | Wasm SIMD animation sampler writing bone matrices, only if a profile shows crowd cost | 2–4 weeks | open |
| **H12** | SCRIPT-ABI v2 written as built; ENGINE.md sections; amend HOST-BAR.md's "at most 10 Hz" AS row and SCRIPT-ABI's per-shard v0 retirement for WASM-HOST, recording the superseded picks G454 (7), G457 (5)–(8) and G484 (7) (R1-22, R2-18) | 1 day | open |
| **H13** | **The cutover (W5).** v2 is built alongside v0/v1 behind Developer with explicit compiler and admission versions, so H1–H6 change no shipped module hash (R1-19). **Ports land one by one** on main, each script compiled for both v1 and v2, with a CI check that every AS source admits under both; only the flip, the save migration and the deletions are one commit set (R2-09). Scope, snapshotted when the wave starts: AS in 56 files / 2,791 lines today (Nalati 1,346, Pine 501, `_template` 141 first, DW 136, pastel-plain 115, ink-cel-valley 115, Signal 100, Sky 55, commons 28, blender-template 24; the four `-legacy` shards' 230 deleted with NEXT N5 or ported); every v0 `ScriptHost` user: species/elite brains (`brain.ts`, 1,293), `DirectorLane` (`director.ts`, 467), `weaponFamily.ts` (695), `mover.ts` (592), client scripts (`client.ts`, 167; consumer `game/shardfile/clientScripts.ts`), `lane.ts` + `composition.ts` (320; wired by `game/shardfile/scripts.ts` and `game/plugin/simulation.ts` `installScriptLane`), declared item hooks (`engine/combat/items.ts:33`, `simulation.ts:709-727`: become sim bindings or projections), the prepared-memory lease (`game/shardfile/pagePreparation.ts`, `driftwood-isle/runtime/index.ts:71`: replaced by fixed v2 memories), `far-reach-legacy/headlessMovers.ts` (90), generated AS `sdk/moverPrograms.ts` (213) and `sdk/directorAbi.ts` (77); every `ReturnProgram` family; 46 test files (5,045 lines). Saves: script state lives inside the SimSnapshot string of `platform.region` (`game/grid/durability.ts`), so migration runs through SimSnapshot adapters (bump `SIM_API_VERSION`, per-adapter decoders for DecisionHost and ScriptHost state); v0 memory saves are decoded per module hash or fall back to the existing **logical ClientCheckpoint mode** (the restart-on-load policy); store.ts migrates only the `platform.region` envelope; migration-only decoders stay after deletion; an old-save fixture per shard loads mid-fight and mid-ride. Then v0 and v1 are deleted (R1-14, R1-18, R2-15, R2-16) | 2–3 weeks | open |
| **H14** | Demo shard (combo, mover, view effect in pure AS, zero shard TS) supplying the W12 reading, measured as p99 total script time per frame (sim + view + marshalling + renderer adapter), demo brains at 10 Hz plus the view lane at 30 Hz, Low Power Mode on, after 5 min warm-up, at 20 bindings (the bar) and 40 (stress), counting reset copies and re-steps. Percentiles come from **per-frame samples**, never batch averages: the bench page is served cross-origin isolated for µs timing, or each frame is counted against the 1 ms threshold; the phone reading comes from the W3 page on a final open at build end, LPM recorded honestly (R1-12, R2-07, R2-08) | 1 week | open |
| **H17** | Extend the existing headless runtime (`src/sdk/headlessRuntime.ts`, `sdk/headlessWorker.ts`, its tests) with the v2 sim lane and sim-tagged projections (W13): record a browser observation trace from a browser-made `platform.region` save, replay `ws_step`/`ws_project` in Node, and get byte-identical outputs on V8 vs JavaScriptCore; save-codec round trip; a check that callers of sim bindings and sim projections pass nothing from the client-only list; the observation producer stays renderer-free. A full headless world (physics, navmesh, player) belongs to the future MMO plan (R2-10, R2-12) | 2–3 days | open |
| **H15** | Threads / SharedArrayBuffer sim worker: revisit after v2 is profiled (W11); needs COOP/COEP | — | parked |
| **H16** | Deterministic physics build (`@dimforge/rapier3d-deterministic`, a deterministic character motor, no dropped ticks) for a future co-op or server mode (W6) | — | parked |
| **D1** | Council, two rounds, on this plan (W7); fixes folded in before it parks | 1 day | done (2026-10-20) |

Order: D1 (design) → on Jake's word: H0 → H0b → H1–H6b built alongside v1 behind Developer → H7 → H8, H9 → H13
cutover → H17 → H14; H10/H11 only on profile evidence; H12 with each landing.

## Ties to SHARD-PLATFORM

SHARD-PLATFORM keeps its G515/G516 host routes (held-melee host for the Jian combo, blade-sampling rows, weather
host rows) and does not wait for this plan. If a SHARD-PLATFORM row truly cannot reach zero without H8 or H9, it is
listed here with its lines instead of being forced into a one-user host.

**Bug-fix exceptions landed before this plan starts (G517 allows only bug fixes):**

- 2026-10-20, sp-o3 (granted by the SHARD-PLATFORM coordinator): stateless AssemblyScript return programs share one
  `WebAssembly.Memory` per page size instead of creating one each, because iOS runs a full GC for every new Memory
  (40–80 ms each). H-rows that redesign memory ownership start from this.
- 2026-10-21, Jake (SHARD-PLATFORM G566): AssemblyScript **body operations** (spawn a declared body, teleport, enable/disable its collider) land now for Driftwood's quest barrels, ahead of this plan's design. The H-rows that design the AS physics surface start from this API.

**Pine and Driftwood lines this plan takes (G570, measured at d16f3c3ae3):** Pine per-frame view 174 (`quest/views.ts` 63, `poolSurface.ts` 62, `beaverPool.ts` 33, `water.ts` 13) plus per-frame one-user code (King pose 54, posedInstances 61); Driftwood per-frame view 166 (rope bridge 128, creatureLooks 21, per-frame systems 17) plus NPC head focus, figures, gulls and cover (~150). Full span list: the plan agent's inventory, re-run with `sourceProgressInventory()`.
- 2026-10-21 (G573): H0 runs now on the Mac, Chromium and the iOS Simulator; Jake opens the calibration page on his iPhone when he has time, and the view-lane work adjusts to his numbers then. The phone run never blocks.
