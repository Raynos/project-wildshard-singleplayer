# A native Steam client for the MMO: Unity, Godot or Unreal

Ask: [E508](../tasks/asks/E508.md). Jake, 2026-10-28: *"Imagine you had an MMO. Imagine you had a web client. Given
that we have this shard file format … how possible is it to build a second client, a native client, a Windows client
using either Unity, Godot, or Unreal Engine? … rank each one … The goal is to have the web client be able to connect
to the MMO, have the native client be able to connect to the MMO and to play all together … published to Steam …
better performance than the web client."*

Plan: [NATIVE-CLIENT](../plans/NATIVE-CLIENT.md) (draft, parked, E509).

This is research only. Three read-only agents worked on it: a codebase inventory, an engine comparison and a look at
precedents. The codebase numbers come from local `main` at `ac82a40b30` and a Pine Hollow build dated 10-23. The web
sources date from 2025–2026. A guess is marked as a guess.

## 1. Verdict

**1. Godot 4.6, 2. Unity 6, 3. Unreal 5.** A second client is very possible, but the engine is not the hard part.
The hard part is that a Shardfile's meaning is defined by about 230k lines of TypeScript. Bytes are not the problem:
about 80 % of a shard is already standard glTF, KTX2 and images. The MMO server will take the simulation off the
client. The native client still has to:

- reproduce every material graph, sky, water and grass look;
- stream and level-of-detail the world the same way;
- predict movement exactly like the server does.

Pick the engine where the shared Rust/Wasm core embeds most cleanly and where agents can work in text. That is Godot.

| | Godot 4.6 | Unity 6 | Unreal 5 |
|---|---|---|---|
| Runtime glTF + KTX2 | built in (`GLTFDocument`; KTX2 in core) | best loader (glTFast + KTX for Unity); shader variants must be forced into the build | glTFRuntime plugin (MIT) + KTX2 add-on; Epic's own runtime path has packaged-build bugs |
| Runtime materials | `.gdshader` text generated from our graph IR; stutters when a pipeline compiles on first use | shader variants must be decided at build time | cooked shaders/PSOs; runtime content misses the PSO precache and hitches; no Nanite for runtime meshes |
| Our Wasm scripts | godot-wasm (wasmtime, Rust GDExtension) exists | write our own P/Invoke over the wasmtime C API (the dotnet binding is unproven under IL2CPP) | write our own C++ over wasmtime/WAMR |
| Rapier (same solver as web + server) | Rapier plugin with a cross-platform deterministic build | none: write a C ABI + csbindgen | none: write a C ABI + cbindgen |
| Custom TS server | WebSocket/UDP built in; protocol code in C# or Rust (FlatBuffers has no GDScript) | C# sockets are fine; Albion proves the pattern | the gameplay framework assumes its own replication; going around it costs the most |
| Steam | GodotSteam | Steamworks.NET / Facepunch | Online Subsystem Steam |
| Render ceiling | lowest, but far above WebGL at our phone budgets | higher (GPU Resident Drawer, Burst) | highest, but unreachable for runtime content |
| Agents | text scenes, free headless CLI export, MIT source we can patch | C# is close to TS; noisy YAML scenes; batch builds need a licence | binary `.uasset`, C++, long builds |
| Cost | MIT, free | free under $200k/yr, then $2,310 per seat per year; pricing has changed once already | 5 % over $1M (3.5 % with an Epic store launch) |

**Why Godot over Unity is close.** Choose Unity if Pine Hollow's photoreal look or crowds of 200+ players become the
deciding factor. Unity has the higher render ceiling and the strongest precedents:

- Albion Online keeps its simulation completely outside Unity.
- Decentraland's official desktop client is Unity.

Godot wins for us on three things:

- **One shared Rust core.** A single Rust GDExtension can hold wasmtime, deterministic Rapier, the Shardfile
  decoders and the protocol. The same crates can feed the server.
- **Agent fit.** Scenes are text, headless builds are free and the engine source is MIT.
- **Our budgets don't need the ceiling.** Our content is sized for the phone (1.2 GB per shard), so Godot's lower
  ceiling does not limit us.

The warning sign: The Mirror, a Roblox-like platform built on a Godot fork, left Godot in Nov 2024.

**Why Unreal is last.** Its strengths (Nanite, Lumen, PSO caching) all assume cooked content. A world downloaded at
runtime gets none of them without forking the engine. It also has the thinnest Wasm tooling and the worst fit for
agents.

## 2. What the native client would have to implement

Measured on Pine Hollow's build: `shard.json` (542 KB), 66 section JSONs (1.4 MB) and 828 SHA-256 blobs (112 MB).

| Kind | What it is | Native cost |
|---|---|---|
| Standard | 451 GLB (meshopt, 16 skins; no materials, only names), 50 KTX2, 81 WebP/JPEG/PNG; audio is shared mp3/m4a outside the shard | importer + meshopt + KTX2: days |
| Small custom binaries | `.wtt` terrain tile (`src/format/terrainTileBytes.ts`, 104 lines), WSNM navmesh (`navigationBytes.ts`, 111), zlib `.bin` sky frames and colliders, mesh collision bytes | a few hundred lines each |
| Section meaning | 42,696 schema paths (`docs/api/SHARDFILE.md`), `src/format` is 302 files / 50k lines, plus 387 custom sections read by 250 one-user hosts (HOST-AUDIT) | **the bulk of the work**; the server takes much of it |
| Wasm scripts | Pine has 9 modules, all `side: "sim"`; v1 imports `ws_read`, `ws_list`, `enter`, `leave`, `fuel`, `abort`, `finite32`, `finite64` | small; server-side only, unless the client predicts with them |
| Look | Every material is a graph IR (`materialGraph.ts`, about 118 ops, Pine uses 80). `render/graph/compile.ts` (1,663 lines) turns it into TSL, plus a fixed epilogue (fog, 3 shadow cascades, PCF, outline). Sky, weather, water, grass and post are engine code (`render/` 18k, `world/` 14k lines) | a second graph compiler (to `.gdshader` or HLSL) and a port of each shard's style |
| Movement | Rapier 0.21 SIMD (heightfield, trimesh, KCC, joints) + player laws (`src/engine/player`, about 4.6k lines) | embed Rapier; port the laws, or share them |

The two hardest pieces, ranked:

1. **Game meaning.** The 111k game lines and the 387 custom sections are where most of the work sits.
2. **Look parity.** Each shard keeps its own style: Driftwood toon, Nalati painterly, Pine photoreal.

## 3. What the precedents say

**It works when the second client is only a view.** The server owns the simulation, and every client loads one
spec'd content format.

- **Old School RuneScape / RuneLite:** two clients share one authoritative server and one content cache.
- **Albion Online:** the simulation layer lives outside Unity; Unity only renders and takes input.
- **Decentraland:** one scene protocol is implemented by Unity, Godot, Bevy and Babylon.js explorers.

**It fails when gameplay lives in both clients, or two clients run side by side forever.**

- **Minecraft Java vs Bedrock:** permanent parity bugs.
- **RuneScape:** Java and NXT ran side by side for 3.5 years; Jagex said NXT "evolved slower than we would have
  liked".
- **Vampire Survivors:** the JS and Unity builds ran side by side until Unity replaced JS everywhere.
- **Decentraland:** archived its Bevy explorer on 2026-10-23. It kept Unity for desktop and Godot for mobile.

**Decentraland is our closest case.** In Oct 2024 it moved from a browser client to a Unity desktop client and
reported faster loads, higher frame rates and 200+ avatars in one place.

**The cheap baseline.** Wrap the existing web client in Electron and add steamworks.js. Fantasy Online 2 shipped its
TS/WebGL MMO client to Steam this way in 2026. It gets us on Steam in weeks but no faster than Chrome:

- Windows runs WebGL through ANGLE.
- Linux and the Steam Deck have no WebGPU without a flag.

## 4. What makes the second client cheap (do these first)

These steps pay off for the web client and the server whatever engine is chosen. They belong in the MMO plan Jake
writes, not in a plan opened from this audit.

1. **The server owns the simulation.** WASM-HOST W13 already commits to a server-runnable sim with no lockstep.
   SHARDFILE-NEXT J (sides `server` / `shared` / `client`, two build cuts) is the format half.
2. **Spec the look as data with conformance renders.** The material graph IR is already data. Give it a written op
   spec and golden scenes that every client must match. We have golden compare tooling, so those renders become the
   parity bar for the native client.
3. **One shared prediction core,** usable by both clients and the server:
   - Rapier built with `enhanced-determinism` on all three (we ship the SIMD build today, which is not bit-exact
     across platforms);
   - the player laws compiled once (Rust or AssemblyScript → Wasm for the web, native for Godot);
   - never written twice by hand.
4. **One generated wire schema** (FlatBuffers or protobuf) for TS, C# and Rust. Static zone, NPC and quest
   definitions come from the cached Shardfile, never from gameplay messages.
5. **Fewer one-user hosts.** Every one of the 250 is code the native client must re-read. HOST-AUDIT's
   zero-custom-TS goal is also the native client's cost curve.

## 5. Shape of the attempt (guess)

1. **Proof spike, about 2 weeks.** Godot 4.6 plus one Rust GDExtension (wasmtime, Rapier, `.wtt` / WSNM / scene
   decoders) loads one Pine Hollow cell from its real Shardfile. Run the same spike in Unity in parallel. Measure on
   a Windows PC and a Steam Deck:
   - frame time;
   - first-load pipeline stutter;
   - memory.

   Pick the engine on those numbers.
2. **One shard at parity, months.** Scope:
   - the material-graph compiler and epilogue;
   - one shard's sky, water and grass;
   - streaming and LOD;
   - movement prediction against the TS server;
   - the baseline HUD.

   Golden renders against the web client set the bar.
3. **Every shard.** Mostly look ports, once steps 1–5 of section 4 hold. Without them, it is a second game.

## Sources

- **Engines:**
  - glTFast: https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.15/manual/features.html
  - Godot runtime loading: https://docs.godotengine.org/en/4.6/tutorials/io/runtime_file_loading_and_saving.html
  - Godot pipeline compilation: https://docs.godotengine.org/en/4.6/tutorials/performance/pipeline_compilations.html
  - glTFRuntime: https://github.com/rdeioris/glTFRuntime
  - Unreal PSO precaching: https://dev.epicgames.com/documentation/en-us/unreal-engine/pso-precaching-for-unreal-engine
  - godot-wasm: https://github.com/Dheatly23/godot-wasm
  - wasmtime-dotnet-unity: https://github.com/mochi-neko/wasmtime-dotnet-unity
  - Rapier determinism: https://rapier.rs/docs/user_guides/rust/determinism/
  - Rapier for Godot: https://godot.rapier.rs/docs/documentation/determinism
  - FlatBuffers languages: https://flatbuffers.dev/support/
  - Unity pricing: https://unity.com/products/pricing-updates
  - The Mirror leaves Godot: https://gamefromscratch.com/the-mirror-stops-using-the-godot-game-engine/
- **Precedents:**
  - Albion Online: https://unity.com/blog/albion-online-cross-platform-pvp-mmo-architecture
  - RuneScape: https://secure.runescape.com/m=news/the-future-of-runescape-technology
  - Old School RuneScape: https://oldschool.runescape.wiki/w/Official_Client
  - Decentraland explorers: https://github.com/decentraland/protocol-squad
  - Decentraland Bevy explorer (archived): https://github.com/decentraland/bevy-explorer
  - Decentraland desktop move: https://decrypt.co/285318
  - Vampire Survivors: https://gamingonlinux.com/2023/07/vampire-survivors-switching-to-new-game-engine-on-august-17
  - Fantasy Online 2: https://blog.fantasyonline2.com/blog/devlog-80-pxengine-start
  - steamworks.js: https://github.com/ceifa/steamworks.js
