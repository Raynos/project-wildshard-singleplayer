# WASM-HOST council: the frozen ledger

Settled. A seat reopens an item only with new evidence (file and line, quote, source); preference is not evidence.

- **G517** (Jake, 2026-10-20): Wasm host work is its own plan, off SHARD-PLATFORM; the SHARD-PLATFORM builder doesn't
  touch the Wasm host; SHARD-PLATFORM keeps G503's ≤ 10 Hz and its G515/G516 host routes.
- **W1** A now, B on evidence: fix the host (AS shards, JS engine, no JS calls inside guests, batched entries, sim and
  view lanes); engine-in-Wasm pieces only on phone-profile evidence; no Rust engine core.
- **W2** Design for outside (untrusted) authors.
- **W3** Phone numbers: the Simulator plus one benchmark page Jake opens once; it reports by itself. Jake does no other
  phone chores (docs/process/JAKE.md).
- **W4** Parked: design now, build only when Jake says.
- **W5** ABI v2 replaces v1 and v0 in one wave; every existing script ported; one save migration.
- **W6** (re-picked 2026-10-20 after R1-04) Guest pure, loads valid: a sim step is bit-identical on every device for the
  same state and observation block; a desktop save continues validly (not identically) on the phone; co-op later via one
  authoritative host; deterministic physics is parked (H16).
- **W7** Two council rounds.
- **W8** Language-neutral binary ABI; AssemblyScript SDK first.
- **W9** Sim lane at 10 Hz, or 30 Hz with a written reason; same rate on every device; no 60 Hz sim scripts (re-confirmed after R1-07: 30 Hz allowed, first users expected to fit 10 Hz). Jake:
  *"stays at 10hz or 30hz if you need it to go up from 10hz explain why"*.
- **W10** View lane at the display rate (30 phone / 60 desktop), halving under budget, memory persists between frames,
  client-only, never saved, freezes on a trap.
- **W11** Threads: not now.
- **W12** Done = a demo shard (combo, mover, view effect in pure AS, zero shard TS) + a phone reading ≤ 1 ms per frame
  for 20 active bindings + every script on v2 + v0/v1 deleted.
- Jake, 2026-10-20: *"we want to absolutely min-max the JavaScript wasm boundaries … as few boundary calls as
  possible, and for the wasm to do as much work with as much context as it needs"*; *"once you enter the WASM, it
  shouldn't be going back into JavaScript"*.
- Repo givens: iPhone 17 Pro portrait Safari PWA is the target (Low Power Mode 30 fps, ~2× throttle); render scale 2×;
  memory limits 1.8 GB loading / 1.0 GB Explorer (AGENTS.md); graphical work Opus-only; HOST-BAR six tests.
