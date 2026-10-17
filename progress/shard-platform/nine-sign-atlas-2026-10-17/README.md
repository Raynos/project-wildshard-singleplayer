# Nine sign atlas and face bake

SHARD-PLATFORM G465/G466/G467/G468/G469. The complete runtime atlas,
quad collector, sign-sink wrapper and font wait are replaced by admitted
data. The existing first-party product reader, KTX2 decoder and ordinary
rest-pool host load the result. No shared runtime host is added.

## Caller evidence

| Former caller | Complete replacement |
| --- | --- |
| Layout sign/light/tube replay | One prepared world draw, in the original append order; exact UVs, attributes, uint32 index and bounding sphere |
| Seeded facade signs | The 90 calls already retained by `nine-casts`, appended after the published layout calls, with no RNG rerun |
| Explorer atlas signs | All 399 distinct keys from world copies and declared variants; prepared origin-facing geometry through the existing pool reader |
| Drone navigation lights | The original three quads, with their blink modes and seeds, in a prepared local-space draw; live drone movement is unchanged |
| Neon calligraphy | Existing `NeonText` retains world board/tube assembly and live specimens over the previously baked glyph field; that separate renderer is unchanged |
| Font wait | Removed: no remaining sign consumer paints text during play |

There is no player-entered atlas text caller. The supported atlas inventory
is the world copies and declared variants; the bake refuses an Explorer
request that would allocate a new cell. The old atlas was also finished
once and discarded its canvases before Explorer use. Unknown prepared keys
refuse explicitly. Calligraphy specimens retain their existing live path.

Deleted whole files:

- `runtime/signs/signAtlas.ts`
- `look/signs.ts`
- `runtime/signs/fontWait.ts`

The authoring rasterizer and geometry writer live only in `generators/`.
No authoring code is moved into another play module. The small live
registration type belongs to the existing sign-copy reader.

## Exact reference

The retained bake runs macOS WebKit, emulating iPhone 16 Pro, with the
same system Kai/Song font stacks and canvas steps as the former runtime.
An independent copy of the original runtime module from `b65a4de9f` ran
beside the generator driver. Both tiers match every saved pixel, all 115
cell rectangles, 1,037 sign registrations, light-spill records and all 401
geometry buffers (world, 399 atlas specimens, drone). All 380 signed-zero
metadata values and original float32/index bits are preserved.

`test/fixtures/nine-sign-atlas.json` retains the independent hashes.
`test/scripts/nine-sign-atlas.test.ts` checks the lossless KTX2 payloads,
metadata and the actual existing pool reader's buffers and bounds.

| Tier | R8 pixels SHA-256 | RGBA8 pixels SHA-256 |
| --- | --- | --- |
| phone | `5f35e8c0904d5d21d8155daaf2ee32dac1dc75bf10f24c30bdb7b9efeb98c0a5` | `9f3834f5a3667318ed838522fdefb1dc1744ad3212fea6b78c6a0dfcc690eb58` |
| desktop | `0097cb927c6462b9b379e6b7405a2ee8b9944a1dfe26759b51d9f1863bba3b14` | `3b5e6dae2b994af3b9f62f26a6dc7d5899d82e982872576bddd2c314dff46f42` |

## Residency and storage

Both textures retain their formats, orientation, mip law, trilinear filter
and anisotropy 8. Their CPU sources release after upload, as before.

| Tier | R8 | RGBA8 | Base bytes before = after | Mipmapped bytes before = after |
| --- | --- | --- | ---: | ---: |
| phone | 1024 × 2048 | 512 × 1024 | 4,194,304 | 5,592,407 |
| desktop | 2048 × 4096 | 1024 × 2048 | 16,777,216 | 22,369,623 |

These are texture storage bytes, not native process RSS. KTX2 stores the
exact pixels with Zstd; the GPU generates the original mip chain. The
existing validator now charges raw R8 at one byte per texel. Its previous
four-byte assumption incorrectly refused the desktop atlas as over 25 MB.
The same corrected law is exercised with Signal Dunes' real R8 sand maps.
Other texture formats retain their existing admission law.

The retained native JSON is about 2.3 MB, below the 5 MB JSON cap. Every
emitted texture, metadata file and GLB is below 1 MB. Identical pools are
shared between tiers. Portable product builds need no canvas or fonts.

Run the native keeper through `scripts/browser-lane.sh` with
`node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs
src/shards/nine-dragon-stack/generators/bake-sign-atlas.mjs`; `--check`
compares the retained bytes. The recipe is `nine-sign-atlas` in the
generation catalogue.

## Source-basis result and checks

The shared `check3` mirror measured candidate `2ade7d229` with all ten
completed products and the real `sourceProgressInventory` from
`scripts/shard-platform.mjs`. Against parent `d5a135a13`, **Nine falls from
12,636 to 12,326 custom lines: −310 net**. Every other shard has zero
source-line change. This is the labelled source ruler, not a claim that
Nine's output runtime is closed. Generators are excluded under G467.

The three deleted files account for 353 code lines (329 atlas/builder,
19 sink wrapper, five font wait). The complete net includes the reader,
validation, registration type and every caller change.

Root types, layer types and changed-source typed lint passed in that
immutable mirror. All ten products built. Five selected test files passed
**35 cases**, including all **17 shard-headless cases**, all 401 sign
geometries per tier through the existing pool reader, the original cast
and facade-shell proofs, and world installation. The CLI output report
was also collected against those complete products.

The 14-view WebKit comparison passes: `e6066d1f4` against `a9e4bbbc9`,
six views per tier plus phone close views of the lightboxes and shrine
plaque/paper strips. Every full-frame pixel hash, draw/triangle count,
linked program count, GPU allocation byte and collider hash is identical.
Both sign-heavy phone views were visually inspected. The scalar receipts
are beside this note. No look change or variant board is needed.

Raw WebKit observed CPU backing bytes, without forced GC: phone
153,196,258 → 153,317,118; desktop 209,912,854 → 269,096,590. The ledger
uses weak references and WebKit cannot force collection; these are raw
telemetry, not a claim of native resident memory parity. Per G433 memory
is report-only. The separate atlas GPU storage equality is exact.

The immutable current-main composite `19bdc89be` independently passed
root/layer types, typed lint, all ten products and the same 35 cases. It
includes the other lane's committed lantern/portal graph changes. Its
source ruler reads 12,177 Nine lines; the isolated −310 delta above remains
the attribution for this landing (`ruler.json` records every shard).

The official `scripts/bake-maps.mjs` captured that served build. The map is
1,000 px and 13,454 bytes. Its fresh input hash is
`f8b0ed1ce81d089e007590cf33a8fb4a07ee837d77c5ffdffee0a2dbc0b7911c`;
its decoded raster hash is
`f8275f78a2a0555200ecb5995dee4586cf202a7fbe674f6f814a9672e1ee7144`.
Both source freshness and raster bytes verified. All ten products were
rebuilt after the official refresh, followed by the 35-case rerun.
