# G227: retire decoded music without changing its output (E435)

**The four traced retired Deck pairs release exactly 115.611520 MB of inspected AudioBuffer payload. The same native road ruler improves, but entered Nalati still exceeds 1.0 GB. No budget or runtimeCost discount is taken.** Decimal MB; Simulator-relative evidence, not a physical-phone cap pass.

## Changes and ownership

- `81f9f6f4d` + fixture lint forward `9478d5b03`: each Deck owns its source handles and ended/state listeners in its child Scope. Retirement stops/disconnects sources, clears `source.buffer` and its decoded `SlotAudio` reference, and disconnects gains. A fading live context that suspends retires immediately rather than retaining buffers until an unreachable audio-clock deadline. Active running crossfade/bar timing stays unchanged.
- `0d00ae763`: the page music bank keeps incoming slots, reusing matching recordings, rather than unioning every prior level's PCM. `SetScore.onDeck` releases the outgoing cached slot immediately after the new deck owns playback. The outgoing Deck alone retains it through the original fade. Requested scores decode from cached compressed bytes on demand; short SFX are unchanged.
- `29f650e1e`: preserve scheduled OfflineAudioContext fades before `startRendering` (an offline context initially reports suspended). Explicit region/Deck disposal still releases it. Five lifecycle fixtures cover running, suspended, suspension during fade, offline pre-start, and parent retirement; two residency fixtures cover bounded banks and immediate score handoff. Existing audio/profile tests bring focused validation to 28 tests. Root strict TypeScript and scoped typed lint passed.

## Sample-aligned output proof

`audio-parity.mjs` bundles the committed Music, Stems and SetScore implementations from `8ecb6c70b` and `29f650e1e`. Other engine helpers are shared; hashes of all six compared audio source files are in `audio-parity.json`. Playwright WebKit renders deterministic nonzero stereo stems through the actual Music graph, using OfflineAudioContext at 48 kHz. No live audio device opens. Events occur at the same context times, without normalization, alignment shifts or a human A/B chore.

| Transition | Samples compared | Max absolute difference | RMS difference |
|---|---:|---:|---:|
| Bank switch | 1,344,000 | **0** | **0** |
| Calm → tension on the bar grid | 1,344,000 | **0** | **0** |
| Shard score disposal / handoff | 1,344,000 | **0** | **0** |

The signal RMS is nonzero in every case (0.02997 / 0.04959 / 0.03491); silence cannot pass. Stop is scheduled at 9 s and each output renders 14 s, including the crossfade tails. This proves output equivalence for the exercised transitions and deterministic inputs, not every possible authored recording or an audio-device implementation.

Reproduce: `scripts/browser-lane.sh --max 5 node progress/memory/g227-budget/audio-parity.mjs 8ecb6c70b 29f650e1e`.

## Same cold native ruler after each step

Each run uses muted cold Safari on the iPhone Simulator, Developer ON, phone Auto/KTX2, 2×, memory saver OFF. It enters owned Driftwood, drives directly to Nalati entry/centre, returns to the neutral road and verifies `residents=[]`. Three settled one-second kernel physical-footprint readings per pose; same-pose labelled GL. No forced collection before original poses. Heap.snapshot is a separate post-road experiment, and its later footprint never replaces the original.

| Pin / pose | WC MB | GL MB | Combined MB | Model MB |
|---|---:|---:|---:|---:|
| cc2371ac6 baseline — home | 599.166504 | 211.555187 | 810.721691 | 934.896463 |
| cc2371ac6 — Nalati centre | 979.373776 | 306.614524 | 1285.988300 | 1128.784955 |
| cc2371ac6 — empty road | 975.638272 | 160.961638 | **1136.599910** | 588.246941 |
| 9478d5b03 Deck lifetime — home | 488.181528 | 211.555187 | 699.736715 | 934.896463 |
| 9478d5b03 — Nalati centre | 881.151936 | 305.525476 | **1186.677412** | 1126.069145 |
| 9478d5b03 — empty road | 888.344560 | 155.369238 | **1043.713798** | 555.518462 |
| 29f650e1e bounded cache — home | 625.036864 | 211.555187 | 836.592051 | 934.896463 |
| 29f650e1e — Nalati centre | 810.831544 | 306.614524 | **1117.446068** | 1128.784955 |
| 29f650e1e — empty road | 820.547304 | 155.369238 | **975.916542** | 555.518462 |

One cold run per revision, not repeat medians: release timing/noise is visible even at home. The Deck-only road is 92.886112 MB below baseline; the final road is 160.683368 MB below baseline. **Neither whole-process delta is isolated audio credit.** `29f650e1e` also contains the independent `92d593e40` debug/performance-counter retirement, so its additional 67.797256 MB road drop cannot be assigned to the bank change. Its inspected AudioBuffer bill is unchanged from the Deck-only pin: zero additional PCM saving is demonstrated on this route. The bank fixtures prove bounded retention for future switches.

The final empty-road sample has only 24.083458 MB margin. Nalati centre remains **117.446068 MB over** the 1.0 GB cap, or 167.446068 MB above a 950 MB margin target. Pine has not been remeasured after these changes; the earlier 1137.636412 MB Pine result remains evidence, not a new pass.

## Heap evidence

| Inspected payload | cc2371ac6 | Deck-only 9478d5b03 | Bounded cache 29f650e1e |
|---|---:|---:|---:|
| All heap categories MB | 606.986317 | 485.840920 | 485.549165 |
| AudioBuffer MB | **153.513721** | **37.902201** | **37.902201** |
| AudioBuffer objects | 40 | 32 | 32 |

The removed eight buffers equal the four calm/tension pairs traced in `native-audit.md`: **115.611520 MB exactly**. Inspector class payloads are already WC subsets, never added to WC + GL. The snapshot can contain unrooted objects awaiting native/GC release: for example the remaining 23.919392 MB calm buffer in the Deck-only snapshot has an unrooted SlotAudio parent. The remaining 37.9 MB is not claimed as all strongly reachable, nor as freeable physical memory without owner proof.

Compressed full native reports, sampling JSONL and heap snapshots plus original vmmap summaries accompany this receipt. `audioSummary.py` validates closed successful reports and reproduces class totals and pose numbers in `audio-memory-summary.json`; `nativeSummary.py` retains the full region comparison. Every measured route reports zero page errors. Both owned previews, all Inspector/proxy/Safari/Simulator resources and the offline browser were closed. No unrelated process was stopped.

The broader residual audit remains open: platform lifetimes, retired contexts/textures and native/typed-array retention need owner-specific retirement and another measurement. These results justify the audio lifecycle fix, not a model calibration or cap increase.
