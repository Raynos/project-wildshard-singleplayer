# Home-grid spawn pose on the Simulator: bisect and attribution (sp-o132, 2026-10-13, G407)

**There's no clean first bad commit. The spawn pose sits right at the gate, and host load decides the reading.** HEAD
`aac6967f6` read p95 34, 39 and 36 ms across three runs. Every older pin read 34 when the load average was ≤ 15. The
bisect could only narrow the drift to the 150 first-parent commits after `45a8bd0e3` (near tier shipped). The next
steps ran at load 41–56 and say nothing either way. The other standing poses (deck-east, crossroads, deck-north) read
34 in every run, even at load 56. Nothing was changed in this lane.

Settings: `scripts/frame-floor.mjs --shards=grid --grid-scenario=baseline --devserver --surface=sim --rev=<sha>`.
Baseline measures the same boot spawn row the milestone does (spawn is sampled first, before any route), without
the drives. Diagnostic run D1 used `--grid-scenario=milestone --grid-routes=template-interior --frame-timeline
--safari-profile`, because `--safari-profile` refuses baseline. The standard settings applied throughout: Simulator Safari on
`frame-floor-iphone-17-pro`, phone tier, 2×, 30 fps cap, Developer ON, build pacing ON.

## Bisect table (spawn row)

Pos is the first-parent index after `fea49ae28` (0 = HEAD). Load is the 1-minute average at start and end.
"Off" counts the frames outside 32–35 ms in the 120-frame window; it needs `--frame-timeline`.

| Run | SHA (pos) | Load | p95 / p99 / max ms | Calls / tris | Off | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| G1 | `fea49ae28` (360) | 13.7–12.4 | 34 / 34 / 35 | 187 / 1.33M | – | good |
| G2 | `fea49ae28` (360) | 6.4–13.0 | 34 / 34 / 35 | 187 / 1.33M | 0 | good |
| B308 | `4ae956386` (308) | 12.3–47.2 | 34 / 37 / 46 | 187 / 1.33M | 4 | pass, load spiked |
| B255 | `1b39cec67` (255) | 12.3–13.5 | 34 / 38 / 38 | 175 / 1.31M | 6 | pass |
| P | `313de0199` (151) | 11.7–13.2 | 34 / 36 / 40 | 176 / 1.31M | 6 | pass |
| N | `45a8bd0e3` (150) | 11.9–15.6 | 34 / 40 / 42 | 177 / 1.37M | – | pass |
| B75 | `283601d36` (75) | 41.2–56.1 | **38** / 57 / 73 | 176 / 1.37M | 19 | void (load 56) |
| H1 | `aac6967f6` (0) | 6.4–17.1 | 34 / 35 / 38 | 175 / 1.37M | – | pass |
| H2 | `aac6967f6` (0) | 10.8–13.3 | **39** / 46 / 48 | 177 / 1.37M | – | FAIL |
| D1 | `aac6967f6` (0) | 11.2–7.7 | **36** / 38 / 43 | 177 / 1.37M | 13 | FAIL (diagnostic) |

By the brief's rule (a pin is bad if it fails twice or reads ≥ 37), HEAD is bad (39, 36) and every pin up to `45a8bd0e3`
is good. B75 read 38, but it ran at load 56, three or four times the load of every other row, so it doesn't count.
The off-cadence column shows jitter creeping in from B255 on, while p95 stays at 34. The margin was thinning before
the near tier shipped. The near tier added 40k triangles to spawn (1.31M → 1.37M) and moved deck-east from 53k to
280k with no cost there.

## Where the spawn frames go (D1)

- **Not the GPU, steady draws or game work.** The spawn window starts 13–17 s after load. Per-frame work is 6–9 ms,
  against 3–5 ms at the other poses. The long intervals come in pairs (24 + 43, 18 + 48 ms), so a frame lands late
  and the next one catches up. The frame timeline shows normal update and render times (3 / 3 ms) on those frames.
  The delay comes from main-thread tasks outside rAF.
- **Those tasks are Content Cache Storage traffic: 291 of the window's 990 Safari samples (29 %).**
  - `engine/boot/contentCache.ts:92–113` `get()` accounts for 161 samples, all in `metadata()`. Every cache hit rewrites
    the **entire** index: `Response.json(this.index)` plus `cache.put`. That costs O(index) per read, and the index
    grows with every cached asset.
  - `game/shardfile/product.ts:110` `browserContentHash` accounts for 39. It runs SHA-256 over a `Uint8Array.from`
    copy, once on the read and once more in the caller's check.
  - `contentCache.ts:21` `read()` accounts for 43: chunked stream reads, copied into a new buffer.
  - `product.ts:157–159`, the admission `load`, accounts for 17.
- **What drives the reads at spawn: the transport-release series.** `6c4cfd6ae` (pos 222), `c3d5078c0` (188) and
  `91e2f8953` (170) re-read every runtime-bound wire from disk after handoff (`releaseTransport`, called per whole
  geometry in `game/plugin/geometry.ts:1462` and from `productGround.ts`). Each one is a full `get()`: stream read,
  hash, index rewrite. The caller then hashes it again. Neighbour admissions do the same during the boot tail.
- **Coordinator's question (sp-x5 Sky warm-up).** The spawn window is *not* the entered-frame warm-up of shader
  compiles and texture uploads. Its cost is asynchronous cache I/O and hashing. A rendering-side upload or compile
  pacer would not fix spawn. The cache fix below helps every boot and entry tail, Sky included, but it does not
  replace sp-x5's warm-up work.

## Fix: non-visual, a Codex spec (not built here)

`src/engine/boot/contentCache.ts`, with focused tests next to the existing content-cache and quota tests:

1. **Stop rewriting the index on every `get()`.** Update `this.index[hash].used` in memory and mark it dirty. Flush
   `metadata()` at most once per 2 s, or on `put` / `evict` / `pagehide`, coalesced through one pending promise.
   Recovery already rebuilds missing entries from the `x-ws-bytes` / `x-ws-used` headers, so a lost flush only ages
   the LRU clock.
2. **Hash without a copy.** In `browserContentHash`, digest `bytes` directly when it owns its whole `ArrayBuffer`.
   Copy only views into a larger or shared buffer.
3. **Read and hash once on release.** `transportRelease` (`product.ts`) should skip its second `hash(bytes)`: `get()`
   has already verified the hash. Better, it could verify through `cache.has` plus the size header and re-read
   lazily, so release no longer streams the whole asset at all.
4. **Proof.** Two plain Simulator runs of the command above at p95 ≤ 35 on spawn, deck-east and crossroads, at load
   ≤ 15. Plus a focused test that N `get()` calls make at most one index `put` per flush window.

Raw JSONs and the Safari profile stayed in scratch and were deleted. Mac-backed Simulator Safari: no physical-iPhone
claim.
