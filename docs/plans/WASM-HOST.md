# Plan: WASM-HOST — a fast, batched Wasm host for shard AssemblyScript

**State:** `open` (2026-10-20) — design first; no lane starts until Jake picks the open decisions below. Not built by
the SHARD-PLATFORM builder or its lanes (G517).

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

- **The cost is the JS calls inside guest code, not the entry.** Every function entry, loop header and f32/f64 op
  calls a JS import (`fuel`, `enter`/`leave`, `finite32`/`finite64`: `src/sdk/bake/compileScript.ts`), and every v1
  call copies the whole 64–256 KiB memory back to its start image (`src/engine/script/decisionModule.ts`). A
  64-point integrator is refused today for fuel.
- **Only ~10 Hz event decisions exist** (G503). Per-frame and 60 Hz logic (combo windows, blade sampling, weather
  light pushes) has to become a shared host or stay counted shard TypeScript.
- **New shards should be data plus AS with no TypeScript**, including combat feel and motion.

## The design (from scratch)

- **Two runtime lanes plus bake.** Events and sim are one mechanism: a deterministic, fixed-tick, saved step with a
  divisor (events = sparse inbox every 6th tick). **Sim** runs at one fixed rate on every device (60 Hz; the phone
  already steps the sim twice per frame at 30 fps). **View** is different on every axis: client-only, display rate
  30/60 with `dt` and `alpha`, never saved, freezes on a trap. **Bake** is offline (generators).
- **One entry per module per tick.** The host writes one observation block (typed arrays), calls `ws_step(tick)` once,
  and the guest loops over all its bindings, writing a command ring and a deferred-query ring; the host validates and
  commits. The view lane calls `ws_view(dt, alpha)` once per frame and writes transform arrays that three.js reads in
  place.
- **No JS calls inside guest code.** An in-Wasm fuel global with a trap replaces `fuel`/`enter`/`leave`; recursion is
  refused so call depth is static; finiteness is checked only on outputs.
- **No copies on success.** A/B state buffers are the transaction; on a trap the host doesn't flip and restores only
  the touched range. Saves are declared state columns, never instance memory.
- **One memory per shard module per lane**, fixed size so typed views never detach; never shared with Rapier or
  engine Wasm. The host reads only offsets it owns and clamps every count.
- **Engine in Wasm only where a profile proves it**: a Rapier batch wrapper (Rust) and a SIMD animation sampler are
  candidates; particles and cloth stay on the GPU. Shards stay AssemblyScript (G484 (4)); a single linked module would
  force Rust/C shards.

## Rows

| Row | What | Effort (est.) | Status |
|---|---|---|---|
| **H0** | Microbench on the Mac, the Simulator and one physical-iPhone soak: JS→Wasm entry, Wasm→JS import, Wasm→Wasm cross-instance import, fuel-global overhead, memory rewind; µs timing in DecisionHost | 1–2 days | open |
| **H1** | Drop the per-op `finite32`/`finite64` imports; validate finiteness on outputs; refuse float reinterpret and relaxed SIMD in the sim lane | 0.5–1 day | open |
| **H2** | In-Wasm fuel global plus trap instead of `fuel`/`enter`/`leave`; refuse recursion; recalibrate the per-call fuel ceiling | 1–2 days | open |
| **H3** | No full-memory rewind on success; A/B state transaction; restore only on a trap | 0.5–1 day | open |
| **H4** | Host-written observation arrays plus an AS SDK query library, replacing per-value `ws_read` calls | 3–5 days | open |
| **H5** | Deferred batched world queries (ray, overlap, path, walkable) answered next tick in one Rapier pass; gives v1 raycast/overlap | 3–5 days | open |
| **H6** | One `ws_step` per module per tick over its binding table; typed i32/f32 records read through long-lived views | 3–5 days | open |
| **H7** | Saves as declared state columns; retire v0 memory checkpoints | 2–3 days | open |
| **H8** | Sim step lane: fixed 60 Hz, opt-in per row, only while active. First users Nine's Jian combo, then v0 movers moved to v1 and the v0 `ScriptHost` deleted | 3–5 days | needs pick |
| **H9** | View frame lane: `ws_view(dt, alpha)` at the display rate, halving under budget; transform arrays bound to three.js; wires view ids 100–105 and events 30–32; deletes v0 `ClientScriptLane` | 1–2 weeks | needs pick |
| **H10** | Rapier batch wrapper (`sync_poses`, `cast_rays`), only if an iPhone profile shows the cost | 1–2 weeks | open |
| **H11** | Wasm SIMD animation sampler writing bone matrices, only if a profile shows crowd cost | 2–4 weeks | open |
| **H12** | SCRIPT-ABI v2 written as built; ENGINE.md sections | 1 day | open |

Order: H0 → H1–H3 (about 3 days, removes nearly every JS call inside guests) → H4–H7 → H8/H9 after their picks →
H10/H11 only on profile evidence → H12 with each landing.

## Open decisions for Jake

1. Allow the sim step lane (amends G503, G454, G457)? Recommendation: yes, opt-in per row and only while active.
2. Sim rate: 60 or 30 on every device? Recommendation: 60.
3. View lane at the display rate, halving under budget? Recommendation: yes.
4. Hot-path fixes H1–H3 before any new lane? Recommendation: yes.
5. View-lane memory persists between frames? Recommendation: yes.
6. Shard language stays AssemblyScript (no Rust/C shards)? Recommendation: yes.
7. Threads / SharedArrayBuffer (needs COOP/COEP on every asset)? Recommendation: not now.
8. When does this plan start, and who builds it (its own coordinator, after SHARD-PLATFORM, or alongside)?

## Ties to SHARD-PLATFORM

SHARD-PLATFORM keeps its G515/G516 host routes (held-melee host for the Jian combo, blade-sampling rows, weather
host rows) and does not wait for this plan. If a SHARD-PLATFORM row truly cannot reach zero without H8 or H9, it is
listed here with its lines instead of being forced into a one-user host.
