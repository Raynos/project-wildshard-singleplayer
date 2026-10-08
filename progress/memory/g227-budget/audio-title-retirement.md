# Title and duplicate-sting PCM retirement

Source: `0f4a91dc4` (shared bank maps/title retirement), `bc86ae00e` (exact-content weak reuse), `8b0801cd4` (bounded missing-title return).

The source-identified Pine-centre Mac heap on `0e6d69988` contained **23,920,672 bytes** of title PCM and two distinct decoded objects per base sting (one redundant copy totals **3,850,312 bytes**). Active Pine calm/tension are legitimate gameplay stems; this change leaves them installed. These are attributable buffer sizes, **not a claimed native footprint saving**.

`Music.useBank` adopts the mutable bank maps, so completed boot promises and the installed `Audio.levelBank` share the title removal. Gameplay deletes the title; a fading Deck keeps its existing bar-aligned playback until retirement. Returning menus read compressed cached bytes again, keeping the current deck while decoding. Late banks delivered during gameplay lose their title too. A missing returning title settles to its existing fallback after one attempt.

`decodeBytes` hashes the exact compressed content before the fixed48k decoder. Pending work coalesces; completed entries hold only WeakRefs, with at most256 metadata entries. Identical live stings share PCM across boot/runtime decoder wrappers. Retired recordings can collect; different content never aliases; failed work retries.

## Playback proof

[`audio-title-parity.json`](audio-title-parity.json) compares committed audio implementations `f3e892eb9` → `8b0801cd4` in real WebKit OfflineAudioContext,48kHz stereo,14s each. Six cases: bank switch, calm→tension, shard handoff, title→game, game→returning title (actual decoder), and same-byte sting reuse. **8,064,000 samples total; maximum absolute difference0; RMS difference0**. No alignment shift or normalization. The return case pauses only the offline clock while bytes decode, testing the identical scheduled transition rather than making a latency claim. The fixture also proves one failed title read settles to synth with no retained title and no retry loop. No live audio device opened; browser closed.

Focused Node tests: three reuse tests (concurrency/content identity, retry/bounded metadata, weak retirement), three score-residency tests, five Deck lifecycle tests, one plugin lifecycle test. Typed source/test lint passes.

## Native proof status

Paired Simulator reading is queued after the current Nalati and corrected SF57 rehearsal slots. The accepted before baseline (`baseline-detail-0e6d69988`, sp-x5) is Memory saver ON: Pine centre WC939.495360 + labelled GL245.671812 = **1185.167172 MB**. Its live audio clock was INTERRUPTED at0, while the Mac attribution clock was RUNNING at42.8s. Keep those conditions distinct; no native saving is credited yet.
