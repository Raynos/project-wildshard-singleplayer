# Title and duplicate-sting PCM retirement

Source: `0f4a91dc4` (shared bank maps/title retirement), `bc86ae00e` (exact-content weak reuse), `8b0801cd4` (bounded missing-title return).

The source-identified Pine-centre Mac heap on `0e6d69988` contained **23,920,672 bytes** of title PCM and two distinct decoded objects per base sting (one redundant copy totals **3,850,312 bytes**). Active Pine calm/tension are legitimate gameplay stems; this change leaves them installed. These are attributable buffer sizes, **not a claimed native footprint saving**.

`Music.useBank` adopts the mutable bank maps, so completed boot promises and the installed `Audio.levelBank` share the title removal. Gameplay deletes the title; a fading Deck keeps its existing bar-aligned playback until retirement. Returning menus read compressed cached bytes again, keeping the current deck while decoding. Late banks delivered during gameplay lose their title too. A missing returning title settles to its existing fallback after one attempt.

`decodeBytes` hashes the exact compressed content before the fixed48k decoder. Pending work coalesces; completed entries hold only WeakRefs, with at most256 metadata entries. Identical live stings share PCM across boot/runtime decoder wrappers. Retired recordings can collect; different content never aliases; failed work retries.

## Playback proof

[`audio-title-parity.json`](audio-title-parity.json) compares committed audio implementations `f3e892eb9` → `8b0801cd4` in real WebKit OfflineAudioContext,48kHz stereo,14s each. Six cases: bank switch, calm→tension, shard handoff, title→game, game→returning title (actual decoder), and same-byte sting reuse. **8,064,000 samples total; maximum absolute difference0; RMS difference0**. No alignment shift or normalization. The return case pauses only the offline clock while bytes decode, testing the identical scheduled transition rather than making a latency claim. The fixture also proves one failed title read settles to synth with no retained title and no retry loop. No live audio device opened; browser closed.

Focused Node tests: three reuse tests (concurrency/content identity, retry/bounded metadata, weak retirement), three score-residency tests, five Deck lifecycle tests, one plugin lifecycle test. Typed source/test lint passes.

## Isolated native comparison

The [raw comparison](audio-title-native-964988732/comparison.json) preserves the accepted before and after plus compressed after JSON, native journal, sampler log and each pose’s vmmap / footprint. Candidate `964988732` is parent `0e6d69988` plus **only Music.ts and preload.ts from `8b0801cd4`**. No other concurrent cut or cost-model change. Phone / 2x / Auto / Memory saver ON / Developer ON / volume0 / seed357, cold boot and the same home→Pine-centre route.

| Pose | Before WC + GL MB | After WC + GL MB | Combined change MB |
|---|---:|---:|---:|
| home-settled | 761.999835 | 647.770731 | -114.229104 |
| pine-hollow-entry | 1120.429768 | 1082.348068 | -38.081700 |
| pine-hollow-centre | 1185.167172 | 1208.449028 | +23.281856 |

**Pine centre: 1185.167172 → 1208.449028 MB, +23.281856 MB WC; labelled GL identical at245.671812 MB. No native footprint saving is credited.** One cold run per side cannot establish a native saving; the three samples per pose are only within-run samples. The source-identified27.770984 MB redundant-buffer attribution is separate from this whole-page result. Neither allocator cost nor runtimeCost is reduced.

Both native live audio clocks were **INTERRUPTED at0**; the prior Mac attribution clock was RUNNING at42.8s. Do not merge these regimes or infer a timed fade leak from the interrupted clock. WebKit may retain freed malloc pages, but this pair does not isolate the cause of its increase. Every pose has three distinct fresh sample timestamps at the fixed admitted game PID. After: errors=[], samplerexit0, no GC/heap command before WC+GL, browser/Inspector/proxy/sampler closed. Simulator released to the next owner.

Plan-State: unchanged. Native saving remains unproved; see the README A/B rule before crediting a later paired measurement.
