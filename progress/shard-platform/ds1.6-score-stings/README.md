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
and Nine arm meshes differ, and their sixteen same-named authored clips also
have different track bytes; they must not be falsely combined as one asset.
