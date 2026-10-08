# Pine centre attribution, before cuts (E435 / G227)

**Pine centre fails the 1.0 GB ruler: 1185.167172 MB WebContent + labelled GL. No saving is claimed.**
The cold retry completed the real title → Infinite Wildshard → Pine entry → Pine centre route.
Pin `0e6d69988`, phone tier, 2×, Developer ON, Memory saver ON, muted, seed 357.
The raw device picks for pineMemoryTrim, pineHybrid and nalatiHybrid were absent:
the existing grid trim was effective, hybrids were OFF. Three settled native samples per pose;
one cold run, not repeat-run medians. All owned Inspector/browser resources closed afterward.

| Pose | WebContent median MB | Labelled GL MB | Combined MB |
|---|---:|---:|---:|
| Home | 565.825088 | 196.174747 | 761.999835 |
| Pine entry | 872.009640 | 248.420128 | 1120.429768 |
| Pine centre | 939.495360 | 245.671812 | **1185.167172** |

`native.json.gz` contains the full unmodified original census and native samples;
`native-samples.jsonl.gz` preserves the sampler ledger. One fixed WebContent PID (17200)
was followed after home. Passive Memory categories were sampled after the original ruler,
without GC. Their changing native categories are diagnostic, not additive WC bills.
Simulator-relative measurements do not establish a physical iPhone cap pass.

The earlier run remains a completed **FAIL**, in `recovery-failure.json.gz`: the document
changed during pine-interior, before the entry sample, and the new page displayed RELOAD.
Its old diagnostic did not retain a reason, so GPU restart is a hypothesis, not a proven cause.
The passing retry does not erase that failure. The native harness now retains recovery reasons.

## Exact audio owners

The separate Mac Playwright WebKit phone-tier run (`mac-webkit.json.gz`) freezes frames and
collects only after its original centre census. Weak decoded-buffer provenance follows actual
Response bytes through ArrayBuffer copies and the unchanged decoder. `audio-owners.json`
records exact object identity, not a duration/size match. Large live AudioBuffer payloads:

| Source | Bytes |
|---|---:|
| Pine oneshots sprite | 30,691,344 |
| Piano title | 23,920,672 |
| Piano Pine calm | 23,633,952 |
| Piano Pine tension | 11,816,992 |
| Pine hollow bed | 3,504,032 |
| Piano death sting, two distinct buffers | 2 × 1,728,536 |
| Piano chunk sting, two distinct buffers | 2 × 1,351,704 |
| Piano pickup sting, two distinct buffers | 2 × 770,072 |

Pine calm/tension are held by Music.deck and PineScore.theme, so they are active score data,
not proved outgoing title audio. The title's direct owner is SlotAudio.calm; the snapshot's
opaque Map edges did not yield a complete root chain. sp-x2 owns title/sting lifetime fixes.
Mac live AudioContext was running at 42.8 s; native was interrupted at 0. Those clocks must
not be conflated when diagnosing scheduled releases. Mac heap/external payload is not
subtracted from Simulator WebContent to manufacture a remainder.

## Rejected sprite cut

`../sprite-parity.mjs` isolates the proposed crop: copy the same decoded PCM window with
128-source-frame guards, preserve fractional offset, duration, pitch, gains and start time.
All 84 shipped clips are compared at 48/44.1 kHz, −40/0/+40 cents, without alignment shifts
or normalization. Candidate payload 27,510,240 bytes vs original 30,691,312 bytes (excluding
object overhead), a possible 3,181,072-byte cut. **Every case fails the zero-difference rule**;
worst absolute difference 0.000014215707778930664. The signal is nonzero in every case.
Reformulating the offset in source frames produced the same differences. We have not
proved the internal cause. No crop/helper remains in the live engine or Pine source.

`rejected-sprite-crop.json` records asset and probe SHA-256. Reproduce through browser-lane:
`node progress/memory/g227-budget/sprite-parity.mjs OUT_JSON` (expected exit 1 on this engine).
This negative result is preserved; the assertion is not relaxed and no native saving is credited.

## Handoff (sp-x5)

Pine remains over cap. Next: immutable procedural weapon texture CPU sources (exactly
matched by object identity to held items and parked drops), with late-reader/clone audit
and exact pixel proof before retirement. sp-x2 owns generic music; sp-x4 owns Nalati cuts.
Native after-cut readings and the selected 30-minute soak pin are still pending.
