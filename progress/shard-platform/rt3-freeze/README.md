# rt3-freeze: template cells froze 1.0–1.6 s every ~6.2 s (playtest round 3, P0)

## Reproduction (Chromium)

- **Setup:** Playwright Chromium as an iPhone 16 Pro, phone tier, render scale 2×, muted, Memory saver off,
  **Developer off** (public grid: the seeded grid tap intent, borrowed Driftwood home).
- **Route:** `scripts/public-grid.mjs`'s real-input legs: Driftwood → road → the template copy `template-1`.
- **Measurement:** stand 30 s in the template under **4× CPU throttle**. It records rAF gaps over 50 ms,
  `longtask` entries and a CDP CPU profile (500 µs sampling), source-mapped against the build's hidden maps.

## Owner

The 300-fixed-tick autosave, `LiveGridSession` → `LiveGridHost.checkpoint` → `GridRegionDurability.checkpoint` →
`serializeSimSnapshot`.

A template copy saves its whole exact world each time: about 440 KB of Rapier bytes, carried as a JS number array.

Self time over the 4 freezes (`before-profile-top.txt`):

| Work | Self time |
|---|---|
| `jsonTree` walking every byte (`snapshotData.ts:96`) | 4.6 s |
| valibot piping every byte | 2.9 s |
| `packedPhysics` / the reference encoder re-hashing the whole basis | 1.6 s |

The ~6.2 s period is the 5 s of ticks plus the freeze that the fixed-step accumulator drops.

Driftwood, Pine and Nalati save logical continuations, so they never showed the freeze.

## Fix

- The byte array is checked in one flat pass and copied with an indexed loop.
- The encoder indexes the basis every 16 bytes and does not re-index bytes it copied from the basis.
- The autosave is staged:
  - It captures at the fixed boundary.
  - It then runs one stage a frame: validate, encode, deflate, stringify, write.
  - A later checkpoint, crossing or unload supersedes a staged save, which then writes nothing.
  - Direct saves (crossing, pagehide, recovery) stay one call.

## Before / after (4× throttle, 30 s standing in template-1)

| Build | Longest task | Period | Autosave work |
|---|---|---|---|
| `before-4x.json` (HEAD 5b86b0eb8) | **2254–2652 ms** (4 of 4 cycles) | ~7.2 s | one task |
| `afterA-4x.json` (cheap serializer only) | 110–123 ms | 5.1 s | one task |
| `afterD-4x.json` (cheap + staged, the landed change) | **50–89 ms** frames, none over 100 ms | 5.0 s | ~140–170 ms in total, spread over 5–6 frames |

In the after run, ordinary 4× frames without the autosave also read 50–60 ms (2.7 s, 8.1 s, 14.0 s).

Node, unthrottled, for one template checkpoint: 145 ms before, ~15 ms after.

Still to run by the coordinator, in a quiet window:

```
node scripts/frame-floor.mjs --shards=grid --surface=both --developer=off --grid-scenario=template
```
