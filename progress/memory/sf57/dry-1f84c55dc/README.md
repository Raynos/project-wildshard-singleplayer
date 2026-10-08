# SF57 Developer dry run — failed rehearsal

Pinned runtime: `1f84c55dc00fb1af857be583876abf1f10c44a30`; harness: `b2864d771`.
This is a five-minute functional rehearsal, never the thirty-minute memory gate.

```sh
node scripts/soak/soak.mjs --prepare --rev=1f84c55dc --layouts=dev --legs=cells --dry-run --out=<fresh-directory>
```

The owned production grid booted on the portrait iPhone Simulator, live clock, 2× render scale,
Developer enabled. It admitted Driftwood, then entered Pine, Nalati and `template-2` through the
shared route driver. Those three completed route witnesses passed; four residents were evicted.

The next leg timed out after 150 seconds: `template-2-to-far-reach`, waypoint 4, target `(0,-325)`;
feet stopped at `(-0.145720,0.425988,-284.475086)`. The traveller was on the road, gameplay ready,
with no residents, pending admissions or reported issues. Far's manifest had no `shardfile` or
`gridShardfile`, so the live driver's enterable-cell filter excluded it. SF49-g / SF50-g coverage
remains open. The recorded `seconds=122.01` is the last completed-leg timestamp; native sampling
recorded 271.8 seconds in the drive phase before the timeout.

Partial playing peak: **945,384,402 bytes WC+GL**; cold-loading peak: **851,491,451 bytes**.
GPU-process memory is recorded separately. These partial values do not prove a memory pass,
loop stability, or physical-phone performance. All recorded GL snapshots were reconciled and
had zero unlabelled allocations; eight cold-loading native samples lacked contemporaneous GL
because of navigation / main-thread timer gaps. No values were interpolated.

Unload reported zero disposal errors and every Scope counter zero, but the independent adjusted
listener census retained four `other` listeners. The first five raw stacks include harness error,
rejection and context-loss observers plus page listeners; they do not identify the four adjusted
deltas. Full listener identities are required before changing game ownership. The run therefore
fails both sampling and leak gates. There was no accepted five-minute completion or circuit.

The coordinator allowed one desktop build / smoke / full-suite run during the latter part of this
functional rehearsal. This run was not a quiet performance measurement. Simulator, Safari,
Inspector, native sampler and the owned preview all closed; sp-x5 received the native lane next.

`summary.json` and CSV are derived; `dev-cells-original.json.br` preserves the worker receipt.
The Brotli logs preserve the complete native and labelled-GL records, with raw SHA-256 hashes
in the summary. Shipped-layout, road-only, Far/Sun and qualifying thirty-minute coverage stay open.
