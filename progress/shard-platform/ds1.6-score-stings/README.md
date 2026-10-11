# DS1.6 shared score recordings v1

The reusable TypeScript `scoreStingsPack` reads existing style manifests and packs
pickup, death and chunk as original encoded audio. No resampling, fades, trimming,
bar-grid or playback change. Driftwood and Pine both select the platform score;
template and frozen legacy copies are excluded from the user count.

| Style | Three encoded files (bytes) | Shared decoded claim (bytes) |
|---|---:|---:|
| Folk | 124431 | 3874816 |
| Piano | 124454 | 3874816 |
| Orchestral | 124245 | 3874816 |

Costs derive from the engine's bounded 48 kHz stereo AAC-LC packet index. Every
full 1024-frame packet is charged, including encoder delay and final padding.
The parser and complete admission path refuse unsupported/truncated/fragmented
containers. WAV remains supported. Commons validation, leasing and CLI estimates
use the same kind inference, so compressed audio cannot be charged as binary.

Proof: 39 focused tests pass, root strict and touched typed lint pass, ratchet
passes. All four native witness payloads/outcomes remain byte-identical. SF26
admits real recordings for two shard identities: each hash is fetched once,
cache bytes are unique, decoded claims have two independent leases and retire
at the last release. Repeated pack generation is byte-identical.

This slice makes real sound packs available to authoring products. Native music
bank routing into emitted commons addresses is still open; it is not a production
network-saving claim. Real shared model/rig/clip packs remain open. The Driftwood
and Nine arm meshes differ and must not be combined as one mesh asset. Their
sixteen shared clips are identical after the actual Meshopt decoder: raw buffer
views in compressed GLBs cannot establish accessor identity. These clips qualify
for the next non-visual pack slice.

## Real compiler and Node ownership follow-up

The actual author compiler builds two separate TypeScript projects selecting the
real Folk pack. Both outputs contain the same three original recording hashes,
shard data and real validation receipts. There is no runtime commons module.
The 16 focused compiler/pack/admission tests and root strict/touched lint pass.
Four native witness payloads/outcomes remain byte-identical.

This proof exposed the Node `Buffer.slice()` shared-view pitfall. Pack intake and
the generic commons compiler now take `Uint8Array.from` copies. A regression
mutates the original reader Buffer after compilation and verifies both owned
pack bytes and catalogue bytes still equal the original recording. Sound bytes,
hashes, decoder settings and costs are unchanged.
