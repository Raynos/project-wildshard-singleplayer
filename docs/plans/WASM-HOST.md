# Plan: WASM-HOST — a fast, batched Wasm host for shard AssemblyScript

**State:** `open`, parked (2026-10-20): design now (two council rounds, H0 numbers); **nothing is built until Jake says
so**. Not built by the SHARD-PLATFORM builder or its lanes (G517).

Jake, 2026-10-20 (E489): *"It goes off the shard platform. I don't want to fuck around the builder with changing the
assembly script engine. It requires a lot of thought. And if we're going to fix it, we should fix it properly. … to
beef up what can be done with WASM to make it more performant, to unlock new capabilities so that other shards going
forward have more capabilities. And we might need some of these stuff to finish the shard platform to zero."* Earlier
the same morning: *"we want to absolutely min-max the JavaScript wasm boundaries … as few boundary calls as possible,
and for the wasm to do as much work with as much context as it needs"*; *"once you enter the WASM, it shouldn't be
going back into JavaScript"*; *"I do feel long term we want to run assembly code at 60 hertz or 30 hertz."*

Research pages: [AssemblyScript Step Lanes](https://claude.ai/artifact/Bu7aPc7FeeJM8BS6vgdU7m) (the 30/60 Hz audit
and the from-scratch design). The as-built contract is [SCRIPT-ABI.md](../SCRIPT-ABI.md).

## Why

Three separate costs, all measured from code; their relative CPU share is unmeasured until H0 (R1-01):
- **Module-sized fuel price.** Every function entry and every loop iteration charges `bytes*4 + 128*functions + 1024`
  of the whole module (`src/sdk/bake/compileScript.ts:56`). Pine's `life` module (8,370 B, 21 functions) pays 32,064
  per iteration: about 12 iterations fit in a 400k call, and a 64-point loop (2.05M) exceeds even the 2M hard cap.
  That, not JS speed, is why integrators are refused today.
- **JS calls inside guest code.** Every function entry, loop header and f32/f64 op calls a JS import (`fuel`,
  `enter`/`leave`, `finite32`/`finite64`: `compileScript.ts:30,40,63,72`).
- **Memory copies.** Every v1 call rewinds the whole 64–256 KiB memory (`src/engine/script/decisionModule.ts:132-135`);
  every successful v0 call slices the whole memory (`host.ts:125-129`); every `ReturnProgram.project` rewinds
  (`returnProgram.ts:90`) (R1-23).

And two capability gaps:
- **Only ~10 Hz event decisions exist** (G503). Per-frame and 60 Hz logic (combo windows, blade sampling, weather
  light pushes) has to become a shared host or stay counted shard TypeScript.
- **New shards should be data plus AS with no TypeScript**, including combat feel and motion.

## The design (from scratch)

- **Three entry kinds plus bake** (R1-17). Events and sim are one mechanism: a fixed-tick, saved step with a divisor.
  **Sim** scripts run at one fixed rate on every device (10 Hz, or 30 Hz with a written reason, W9) inside the engine's
  60 Hz fixed step. **Projections** (`ws_project`) are synchronous, stateless call-and-return inside host code (today's
  `ReturnProgram`: taming, stealth, boss arenas, pageLife, population sites, held weapons; 48 call sites in 16 files),
  batched per owner where callers are independent. **View** is client-only at the display rate, never saved, freezes on
  a trap. **Bake** is offline (generators).
- **One entry per module per tick, per-binding accountability** (R1-11). The host writes one observation block, calls
  `ws_step(tick, fuel)` once; the guest SDK runs each due binding, writing the running binding id into a host-owned
  slot before each one. Each binding gets its own fuel slice and keeps v1's quotas (32 commands per call, 128 per tick,
  4 spawns, 8 timers) and three-strike failure count. On a trap the host blames the binding in the slot, discards that
  call's outputs and re-steps without it. Commands carry their binding id and are checked against that binding's row;
  observations are written only for reads a row declares. Execution and commit order is by binding id.
- **Staggered bindings** (R1-10): binding *b* runs on ticks where `tick % divisor == b % divisor`, so 10 Hz work
  spreads over six fixed steps instead of spiking every sixth frame.
- **Observations, inputs and queries** (R1-06, R1-07). Each sim tick the host fills standard per-binding observations
  in one batched physics + navmesh pass before the step (ground under self, line of sight to the player, nearest
  walkable, distance), plus **input edges stamped with the 60 Hz tick they happened on** and an `atTick` on every event,
  so ~100 ms windows resolve at 16.7 ms even at 10 Hz. Other queries go in a request ring with request ids, answered
  in the same tick's `afterBodies` phase (`decisions.ts:184`) and delivered next sim tick; in-flight requests are part
  of the save. Dependent terrain heights come from a guest-readable height grid. **Contact never goes through
  queries**: the guest issues strike/sweep commands and the 60 Hz strike or held-melee host returns hit events.
- **Movers stay native** (R1-09). A guest emits motion segments (target, ticks, easing); the physics owner evaluates
  them every 60 Hz fixed step before collision; the save holds the segment and elapsed ticks.
- **No JS calls inside guest code, hostile-binary safe** (R1-02, R1-03). A fuel global internal to the module (never
  exported) is decremented per basic block by instruction count; the budget arrives as a `ws_step` argument and the
  remainder is returned. Admission checks the exact charge sequence at every entry and loop header and refuses any
  other access to that global; builds the direct-call graph, refuses cycles and refuses a longest path over 64 so depth
  is static; replaces `abort` with a local trap; admits no guest function imports. NaN checks become inline in-Wasm
  traps on float stores and reinterpret inputs; reinterpret stays allowed (AS's own Math needs it); SIMD and relaxed
  SIMD stay refused.
- **Sim lane resets each entry** (R1-05). Committed state lives in host-owned columns outside guest memory; candidate
  writes are validated before commit. Each sim entry resets the mutable globals, the heap pointer and the static data
  range, so no hidden state survives between ticks and a loaded game runs like continuous play. Only the view lane keeps
  memory between frames (W10).
- **View lane** (R1-08, R1-15, R1-16). Each sim tick the host copies declared public sim columns (previous and
  current) into the view block; `alpha = (ticksSinceSim + fixedAlpha) / divisor`. The local player's own swing plays
  the moment the input arrives and the sim confirms or corrects it; hit-stop stays presentation-only. Candidate
  transforms are validated and clamped against declared bounds before they replace a protected last-good publication,
  so a trap or NaN leaves the last good frame on screen. InstancedMesh matrices and bone textures bind zero-copy; other
  consumers are copied.
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

## Rows

| Row | What | Effort (est.) | Status |
|---|---|---|---|
| **H0** | Benchmark as a calibration reading (`src/calibrate.ts`, posted to `api/telemetry.ts`) at one URL Jake opens once (W3), plus the Mac and the Simulator: JS→Wasm entry, Wasm→JS import, internal vs exported fuel global, 64 KiB rewind, and real Nalati/Pine scripts profiled across the three Why costs; timings from batches of 1,000 calls (Safari's clock is ~1 ms without cross-origin isolation); build and module hashes and Low Power Mode state recorded. Decision rule: if a Wasm→JS import is cheap on JavaScriptCore, H4/H6 drop in priority but H1–H3 still land (determinism, fuel); fuel overhead over 15 % → coarser per-block charges; a 64 KiB rewind under 5 µs → keep full rewind as the reset (R1-13) | 1–2 days | open |
| **H0b** | **ABI v2 wire contract** written before any code: every region's layout, alignment, scalar widths (ticks i32; durable columns f64 so v1 slots round-trip), version field, lengths validated from host metadata, overflow handling, memory sizing, the three entries' signatures (R1-20) | 1–2 days | open |
| **H1** | Replace the per-op `finite32`/`finite64` imports with inline in-Wasm NaN traps on float stores and reinterpret inputs; validate outputs; keep refusing SIMD (R1-03) | 0.5–1 day | open |
| **H2** | Internal per-basic-block fuel global (budget in, remainder out); admission verifies the charge sequence, refuses other access, refuses call-graph cycles and depth over 64; local trap replaces `abort`; no guest imports; applies to every entry including init and view; recalibrate the ceiling (R1-01, R1-02) | 1–2 days | open |
| **H3** | Sim-lane per-entry reset of globals, heap pointer and static data; committed state in host-owned columns; a test that scrambles guest scratch between steps and expects identical results (R1-05) | 0.5–1 day | open |
| **H4** | Host-written observation block (standard per-binding observations, 60 Hz-stamped input edges, `atTick` on events) plus an AS SDK geometry library (distance, bearing, radial in AS math), replacing per-value `ws_read` calls (R1-07) | 3–5 days | open |
| **H5** | Request ring for other queries (ray, overlap, path, walkable) with ids, answered in the same tick's `afterBodies` phase by one batched physics + navmesh pass, delivered next sim tick, saved in flight; guest-readable height grid; contact stays in the 60 Hz strike/held-melee hosts (R1-06) | 3–5 days | open |
| **H6** | One `ws_step` per module per tick with per-binding fuel slices, quotas, blame slot and re-step on trap; staggered bindings; capability-scoped observations and commands (R1-10, R1-11) | 3–5 days | open |
| **H6b** | `ws_project` entry: synchronous stateless projections, batched per owner where callers are independent; dependent callers rewritten as staged continuations; borrowed RNG rollback kept (R1-17) | 2–3 days | open |
| **H7** | Saves as declared state columns plus pending events, staged commands, in-flight queries, timers, RNG and failures | 2–3 days | open |
| **H8** | Sim step lane at 10 Hz, or 30 Hz with a written reason (W9), opt-in per row, only while active. First real user: Nine's Jian **input windows** in AS while the G475 held-melee host keeps contact and hit-stop, so the host keeps its user (R1-21). Movers stay native via motion segments; only far-reach-legacy's v0 mover is ported or deleted with it (R1-09) | 3–5 days | open |
| **H9** | View frame lane (W10): `ws_view(dt, alpha)` at the display rate, halving under budget (thresholds, minimum rate and recovery defined in H0b), memory kept between frames, sim columns copied in, local-player prediction, protected last-good publication. First real users: the pastel-plain, ink-cel-valley and `_template` client scripts; delete DecisionHost's dead `side:'view'` paths (R1-08, R1-15, R1-16, R1-21) | 1–2 weeks | open |
| **H10** | Rapier batch wrapper (`sync_poses`, `cast_rays`), only if an iPhone profile shows the cost | 1–2 weeks | open |
| **H11** | Wasm SIMD animation sampler writing bone matrices, only if a profile shows crowd cost | 2–4 weeks | open |
| **H12** | SCRIPT-ABI v2 written as built; ENGINE.md sections; amend HOST-BAR.md's "at most 10 Hz" AS row and SCRIPT-ABI's per-shard v0 retirement (G457 (5), G484 (7)) for WASM-HOST, recording which picks W5/W9/W10 supersede (R1-22) | 1 day | open |
| **H13** | **The cutover, one atomic wave (W5).** v2 is built alongside v0/v1 behind Developer, with explicit compiler and admission versions, so H1–H6 change no shipped module hash (R1-19). The wave ports, at the inventory snapshotted when it starts: AS in 57 files / 2,791 lines today (Nalati 1,346, Pine 501, `_template` 141 first, DW 136, pastel-plain 115, ink-cel-valley 115, Signal 100, Sky 55, commons 28, blender-template 24; the four `-legacy` shards' 230 deleted with NEXT N5 or ported); every v0 `ScriptHost` user: species/elite brains (`brain.ts`, 1,293), `DirectorLane` (`director.ts`, 467), `weaponFamily.ts` (695), `mover.ts` (592), client scripts (`client.ts`, 167), `lane.ts` + `composition.ts` (320), `far-reach-legacy/headlessMovers.ts` (90), generated AS `sdk/moverPrograms.ts` (213) and `sdk/directorAbi.ts` (77); every `ReturnProgram` family; 46 test files (5,045 lines). Saves: every persisted owner inventoried; v1 identities and state mapped; v0 memory saves decoded per module hash or given a declared restart-on-load policy; run by the `engine/saves/store.ts` migrate hook; migration-only decoders kept after deletion; an old-save fixture per shard loading mid-fight and mid-ride. Then v0 and v1 are deleted (R1-14, R1-18) | 2–3 weeks | open |
| **H14** | Demo shard (combo, mover, view effect in pure AS, zero shard TS) supplying the W12 reading, measured as p99 total script time per frame (sim + view + marshalling + renderer adapter), demo brains at 10 Hz plus the view lane at 30 Hz, Low Power Mode on, after 5 min warm-up, at 20 bindings (the bar) and 40 (stress) (R1-12) | 1 week | open |
| **H15** | Threads / SharedArrayBuffer sim worker: revisit after v2 is profiled (W11); needs COOP/COEP | — | parked |
| **H16** | Deterministic physics build (`@dimforge/rapier3d-deterministic`, a deterministic character motor, no dropped ticks) for a future co-op or server mode (W6) | — | parked |
| **D1** | Council, two rounds, on this plan (W7); fixes folded in before it parks | 1 day | in flight (2026-10-20, wildshard-v) |

Order: D1 (design) → on Jake's word: H0 → H0b → H1–H6b built alongside v1 behind Developer → H7 → H8, H9 → H13
cutover → H14; H10/H11 only on profile evidence; H12 with each landing.

## Ties to SHARD-PLATFORM

SHARD-PLATFORM keeps its G515/G516 host routes (held-melee host for the Jian combo, blade-sampling rows, weather
host rows) and does not wait for this plan. If a SHARD-PLATFORM row truly cannot reach zero without H8 or H9, it is
listed here with its lines instead of being forced into a one-user host.
