# Shardfile v0

`SHARDFILE_VERSION = 0` covers both the format and script ABI. This is the provisional
author contract, published by `@wildshard/sdk/shardfile` (`ShardfileSchema`,
`parseShardfile`, `Shardfile`, `shardfileRules`) and `@wildshard/sdk/version`.
The build product is `shard.json` plus immutable files named by SHA-256. No placement,
three.js object, function, closure, custom shader or source generator appears in it.

The committed empty example is `test/fixtures/shardfile/empty.json`. Every object is
strict: unknown keys fail. Numbers are finite; counts and byte sizes are safe unsigned
integers. MB means 1,000,000 bytes. The platform owns caps in
`@wildshard/engine/core/config` (`CONTENT_CAPS`, measured caps v1).

| Section | Contract |
|---|---|
| `identity` | Kebab/dot slug, nonempty display name and author (128 characters max), positive revision, unsigned seed. No grid coordinates. |
| `requires` | SDK revision 0; capability names; declared SHA-256 commons hashes. |
| `budgets` | Library resident ≤25 MB and wire ≤8 MB; sim resident ≤25 MB and critical wire ≤2 MB; decode/refinement slack ≤80 MB. |
| `look` | Fixed platform family names; grade exposure/saturation/contrast and optional LUT reference; engine clock; optional normalised day override; ordered day keys carrying sky reference, fog and sun values. |
| `sim` | 60 Hz fixed step; positive script tick divisor dividing 60; command and snapshot schema version 0; script references. |
| `state` | Positive state-schema version, `sharedOwner: "host"`, `playerKey: "actorId"`; named shared and per-player fields with bool/i32/f64/string type and matching default. |
| Field `privacy` | `public` replicates to everyone; `owner` only to the owning actor; `host` never leaves the host. Shared writes always belong to the host regardless of visibility. Names are unique within each state scope. |
| `authorCaps` | 1–32 players (authors may lower the room cap); in-cell speed 0–15 m/s. Highway speed belongs to the platform. |
| `serverBudget` | Positive tick budget ≤16,666 μs, positive memory ≤25 MB, ≤10,000 entities, ≤1,024 commands per tick. These are author declarations, not a server implementation. |
| `edge` | Four ordered perimeter profiles with 2–129 height and RGB samples of equal length, heights inside ±250 m, colours in [0,1], road height exactly 0. North/south samples run west→east; east/west run south→north. |
| `files` | Unique lowercase 64-character SHA-256 hash, kind (`glb`, `ktx2`, `audio`, `json`, `wasm`, `binary`), compressed/decoded/GPU byte sizes, triangles, draws including shadows, dependency references, critical flag. |
| `tiles` | L0 62.5 m or L1 125 m; integer x/z address; exact horizontal grid bounds and vertical bounds inside the 500 m cube; nonnegative geometric error; file roots and declared costs. |
| `library`, `critical`, `far` | Library roots, critical roots, optional whole-shard proxy with bounds and costs. Critical flags match critical roots. |

Local references are file hashes; shared references are `commons:<hash>` and must be
declared in `requires.commons`. Every local dependency resolves. The dependency graph
is acyclic. A file's compressed bytes are its stored wire representation, decoded
bytes its persistent CPU representation, GPU bytes its uploaded representation.
Decoded geometry copies must be released after upload; decode/refinement overlap is
charged separately. CPU state that must persist stays in decoded bytes.

Per tile resident = decoded + GPU: L0 ≤4 MB / 0.3 MB wire / 40k triangles / 8 draws;
L1 ≤2 MB / 0.2 MB / 10k / 2; far ≤1.6 MB / 1 MB / 8k / 1. Shadow draws count;
only L0 within 80 m may cast them. L1 and far are self-contained and cannot depend
on the shard library. The builder verifies actual assets and transitive dependency
costs against declarations. The worst 150 m disc includes lookahead, three neighbours
at caps, deduplicated libraries/commons, L1, far, four sims and streaming overlap.
The engine base is 300 MB, playing envelope 850 MB, loading envelope 1.8 GB.

First-party products rebuild every build. The client accepts current v0; the only
previous-version exception in Part A will be offline-cached first-party content.
Older content needs upgrade without touching its source or saves. A version bump
migrates all first-party source and retains saves in one commit. Outside authors
must update `version`, `requires.sdk`, the sim ABI and affected fields, then rebuild
and validate; incompatible state changes require an explicit save migration.
Version 1 freezes only after SF22c's physical-phone reading. Future rows add content
schemas and bindings; v0 does not yet claim tiles, quests or scripts are playable.
