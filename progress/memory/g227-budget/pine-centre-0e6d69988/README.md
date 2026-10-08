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

## First source cut: shared procedural texture pixels

Memory saver ON now shares a weak source per seeded procedural set and colour/normal/ARM
plane in `engine/combat/view/ranged.ts`. Each held/drop/Explorer consumer gets its own
texture object, so repeat, wrapping and other sampler choices remain independent. Only
live consumers keep the immutable pixels alive. Eight bounded memo entries contain WeakRefs,
not texture or pixel ownership. OFF and the compressed path retain their existing behavior.
The buffers stay available for late clones such as Pine's rifle borrowWood; blindly dropping
them after upload was rejected during the reader audit.

`viewmodel-source-parity.json` comes from the actual generators and texture factory in
Mac WebKit. Fresh OFF/ON pages render 57 outputs, covering all planes, different repeat/wrap
settings, disposal of the first owner, late consumers and borrowWood-style clones. Both
pixel SHA-256s are `c3dd11f46c22de6a492d50945248770cf919c794a1fbcab0a1e2fc812c271262`;
zero differing pixels, nonzero output. The deliberately repeated fixture's unique CPU pixels
fall 43,319,296 → 13,402,112 bytes and GL allocations 39,949,828 → 25,226,076 bytes.
Those are fixture deltas, **not entered-Pine savings**. Existing texture pixels, material
parameters and shaders are unchanged. Three mock-free focused checks cover source lifetime,
independent sampler objects and the unchanged OFF path. Reproduce via browser-lane:
`node progress/memory/g227-budget/viewmodel-parity.mjs OUT_JSON`.

## Actual centre comparison: no texture saving

`texture-centre-comparison.json` compares the original Mac route against the isolated
candidate `162c069cb14e0f467eed88c73cfe63ba0abe2530` (parent `0e6d69988`, only the two
production source-sharing files from `70da4e333`). `texture-centre-after.json.gz` retains
the completed after report; both browsers closed. Scene CPU buffers are identical:
1,222 buffers / 64,501,290 bytes. Texture backing arrays remain 44 / 14,297,832 bytes.
Labelled GL remains 245,244,410 bytes / 1,249 resources. The raw heap class counts and
payloads also match exactly: ArrayBuffer 151,522,625; Float32Array 62,774,168;
AudioBuffer 112,106,585; CanvasRenderingContext2D 25,432,802; ImageBitmap 4,718,728 bytes.
These heap categories overlap backing storage and are not an additive memory bill.

**No entered-Pine saving is credited.** The fixture demonstrates sharing when repeated
procedural consumers exist; this real route does not demonstrate that duplication.
Six native cold runs are deferred until a candidate changes a real owner. For future native
credit, use at least three cold runs per side and report median and spread; a single pair
cannot distinguish ordinary process/allocator variation from a cut.

## Labelled GL target ranking

`gl-centre-cdad59776.json.gz` is a separate clean built-pin phone-tier, 2×,
Memory saver ON route with **228,777,182 labelled GL bytes / 1,248 allocations**.
The browser closed, no heap snapshot or GC was requested, and all route legs passed.
`gl-ranking-cdad59776.json` ranks the exact allocations. The older 245,244,410-byte
capture predates the separate platform atlas improvement; that change is not credited here.

The largest groups are platform/grid 57,216,910 bytes; composer/post targets
29,879,328; sky keys plus PMREM 21,643,264; KTX2 textures 12,242,408; and PBR arrays
8,167,608. `engine/scene` (51,725,882) remains a mixed label, not a single removable owner.
Two 8,760,384-byte composer colour targets are its input/output pair. Pine's two
1,572,864-byte PMREM targets are output/ping-pong storage. Their paired appearance is
not evidence of duplication. No smaller resolution or changed texel format is applied.

Rock-ground colour and normal files each have two 626,288-byte GL allocations;
one pair is absent from the plain active-scene texture census. The exact follow-up
`rock-texture-owners-cdad59776.json` proves both pairs are live: slab owner
`grid.world:pine-hollow` and crag owner `grid.object:pine-crags-crag-cliff`, with distinct
Source UUIDs but identical full GL sampler keys, dimensions, formats, file labels and repeats.
Crag uniforms are installed through onBeforeCompile, beyond the plain material-property
census. This is a shared-storage target (1,252,576 bytes), **not a dead owner or a saving**. A reuse change must preserve
file bytes, every sampler parameter, late consumers and disposal behavior, then pass
exact pixel comparison and an actual allocation delta.

## Cross-wave compressed source proof

`../ktx2-source-parity.mjs` exercises the production `ktx2Texture` loader and the
actual encoded rock colour/normal files in fresh Mac WebKit phone-tier pages,
Memory saver OFF then ON. `ktx2-source-parity.json.gz` preserves all allocation
stages. All 14 RGBA readbacks are byte-identical (zero different bytes, maximum
error zero). Two later decode waves keep the original owners live: their combined
GL allocation falls by exactly **1,252,576 bytes** with sharing. First-owner
disposal, same-sampler late clones, different samplers, a separate 512 mip chain,
and fresh uploads after the last owner is disposed preserve the exact pixels.
Disposing every texture returns to each page's renderer-only texture baseline.

The production change reuses only weak source identity, bounded to 256 keys of
exact encoded URL, selected mip level, format, type and dimensions. Each call still
gets fresh transcoded mip data and independent sampler/transform state. The memo
owns no strong source, texture, pixel or GL reference. Memory saver OFF retains
the previous behavior. This proves the real-file allocation mechanism; **actual
entered-Pine centre credit still awaits the corrected product route**, and native
WC saving / a 1.0 GB pass is not claimed.

## Handoff (sp-x5)

Pine remains over cap. The procedural shared-source comparison is zero. The new KTX2
real-file pixel/lifetime proof removes 1,252,576 GL bytes in its controlled allocation
fixture; actual centre credit awaits the corrected shared product route. Canvas/Float32
attribution belongs to sp-x1; sp-x2 owns generic music; sp-x4 owns Nalati cuts.
No native saving or cap pass is claimed.
