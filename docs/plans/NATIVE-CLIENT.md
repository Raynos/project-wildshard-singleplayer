# Plan: NATIVE-CLIENT — a native Steam client for the Wildshard MMO

**State:** `draft`, parked (2026-10-29, E509). Nothing here is built until Jake says so. Not worked by the
SHARD-PLATFORM builder or its lanes. Status: [native-client/STATE.md](native-client/STATE.md).

Jake, 2026-10-28 (E508): *"Imagine you had an MMO. Imagine you had a web client. Given that we have this shard file
format … how possible is it to build a second client, a native client, a Windows client using either Unity, Godot, or
Unreal Engine? … The goal is to have the web client be able to connect to the MMO, have the native client be able to
connect to the MMO and to play all together. The goal is to basically be able to have a native client that can be
published to Steam. And obviously the native client should have better performance than the web client."* Then, the
next day (E509): *"Turn it into a draft parked plan."*

Source: the research [docs/audits/native-client-engines.md](../audits/native-client-engines.md)
([page](https://claude.ai/artifact/KYjGx2ZtrhoekqWeQEMzoF)). Its ranking: Godot 4.6, then Unity 6, then Unreal 5. The
engine is not the hard part. About 80 % of a shard's bytes are already standard glTF, KTX2 and images. The rest of
the cost is that a Shardfile's meaning is defined by about 230k lines of TypeScript:

- the material-graph compiler and its epilogue;
- sky, weather, water and grass;
- streaming and LOD;
- 250 hosts that each serve one shard;
- the movement laws.

This plan makes that meaning portable first. Then it spikes two engines, and builds the winner one shard at a time.

## What it delivers

1. **A client-neutral Shardfile.** Every part a second client must reproduce has a written spec and test vectors,
   not just a TypeScript reader.
2. **A look parity bar.** Golden scenes for each shard style that every client must match.
3. **One shared prediction core.** Rapier and the player laws run identically on the server, in the web client and
   in the native client.
4. **One wire schema.** It is generated for TypeScript, C# and Rust, and static content never travels in it.
5. **An engine picked on measured numbers.** A two-week spike in both Godot and Unity, measured on a Windows PC and a
   Steam Deck.
6. **A native client on Steam.** It plays on the same MMO server as the web client, at parity with it, and is faster
   than it.

**Order (proposed):** A, B and C can run in parallel (they help the web client and the server too), then D, E, F.
G is optional and independent.
**Done when** a native Steam player and a web player meet in the same zone on one server. The native client must
pass every shard's golden scenes and run faster than the web client on the same PC.

## Dependencies (owned elsewhere, not copied here)

- **The MMO server itself.** There is no plan yet; Jake writes it (OCTOBER-BACKLOG item 3). Phases E and F need a
  running server. Phases A to D do not.
- **[WASM-HOST](WASM-HOST.md) W13:** a server-runnable sim, with no lockstep and nothing client-only feeding it.
- **[SHARDFILE-NEXT](SHARDFILE-NEXT.md) phase J:** the server-only cut. Sections and files get a side (`server`,
  `shared` or `client`), and the build writes `shard.json` and `shard.server.json`. The native client reads only the
  client cut.
- **[HOST-AUDIT](HOST-AUDIT.md):** every one-shard host it removes is code the native client never has to re-read.
  Its zero-custom-TS goal is this plan's cost curve.

## Rules for every row

- The web client stays the reference. A native look change ships with a side-by-side capture against the web
  client's golden render (G844). Anything a player sees is Opus-only work (G848).
- Every spec row is generated from, or checked against, the TypeScript that defines the behaviour today. A spec that
  drifts from the code fails a test, so it never becomes a second source of truth.
- Web-side changes follow the usual rules:
  - no URL switches;
  - a risky rendering, physics or memory change ships default-off behind a Debug row until a device reading backs it;
  - memory stays 1.2 GB per shard playing and 1.8 GB loading.
- The storage policy holds: no engine binaries, export templates or `.pck` / build outputs in Git. Godot and Unity
  projects commit text only.
- No new bots, cron jobs or proof machinery (G585). Numbers go in commit messages.
- Script ABI changes are agreed with WASM-HOST, which owns the ABI.

## Proposed decisions (from the research; Jake's grill settles them)

- **NC-D1 Godot 4.6 is the lead engine, and Unity 6 is spiked beside it.** The spike (phase D) decides. Unreal is out:
  its cooked shaders, PSOs and Nanite assume build-time content.
- **NC-D2 One Rust core.**
  - It holds wasmtime, Rapier, the Shardfile binary decoders and the wire codec.
  - The native client embeds it as a GDExtension, or as a C ABI for Unity.
  - The server and the web client use the same crates through Wasm or napi wherever prediction must match.
- **NC-D3 The server owns the simulation; clients are views that predict only movement.** Gameplay Wasm runs on the
  server. The native client hosts Wasm only for what it predicts.
- **NC-D4 Rapier switches to `enhanced-determinism` everywhere** if B1 shows the web client can afford losing SIMD.
  Otherwise prediction tolerates drift and the server corrects.
- **NC-D5 The native client starts with one shard:** Pine Hollow, the hardest look, so the spike tests the ceiling.
  It also ships the baseline HUD only.
- **NC-D6 Steam first targets Windows and Steam Deck** (native Linux build, no Proton). macOS waits.

## Rows

### A. A client-neutral Shardfile (M–L)

Today the meaning of a shard's data lives in TypeScript. Every material is a graph IR (`src/format/materialGraph.ts`,
about 118 ops, Pine uses 80). `src/engine/render/graph/compile.ts` (1,663 lines) turns those graphs into TSL, and adds
a fixed epilogue: fog, 3 shadow cascades, tent PCF, outline. The binary formats each have a ~100-line reader and no
spec.

- **A1** Material-graph op spec. For each op, a generated reference page gives its inputs, outputs, maths and one
  numeric test vector, generated from `GRAPH_OPS` so it cannot drift. — open
- **A2** Epilogue and presets spec: fog, cascades, PCF, outline, and the toon / PBR / painterly / emissive presets
  (`render/graph/presets.ts`), with the constants each shard may set. — open
- **A3** Binary format specs with test vectors for each format below; a test round-trips every vector through the TS
  reader. — open
  - `.wtt` terrain tiles (`src/format/terrainTileBytes.ts`);
  - WSNM v1 navmesh (`navigationBytes.ts`);
  - mesh collision bytes (`meshCollisionBytes.ts`);
  - zlib collider and sky-frame `.bin` files;
  - `world/scenes.json` batches (instance matrices, LOD bands, cull rules).
- **A4** Custom vertex attributes (`_CDATA`, `_CTINT`, `_SPLAT`, `_CANOPY`, `_AMOSS`, `_WS_CHANNEL_0`) are declared in
  the format with their meaning, not only read by graph ops. — open
- **A5** Golden conformance scenes for each shard style (Driftwood toon, Nalati painterly, Pine photoreal, plus the
  rest). Each is a fixed camera, time of day and weather, rendered by the web client with the existing golden compare
  tooling. These renders become the parity bar for phase E. — open
- **A6** Sky, weather, water, grass and post: list the data rows each one reads, and spec the parts a second client
  must match. The cost may make some of them "approximate within a golden tolerance" instead of exact; A6 says
  which. — open

**Done when** a reader with only the specs and test vectors could decode every blob of Pine Hollow and compile every
one of its materials.

### B. One shared prediction core (M)

Today: Rapier 0.21 SIMD build (`@dimforge/rapier3d-simd`), and player laws in `src/engine/player` (~4.6k lines). The
Script ABI doc already warns that physics and navigation are not bit-identical across platforms.

- **B1** Measure the `enhanced-determinism` Rapier build against SIMD in the web client: frame time on the phone tier,
  shipped behind a default-off Debug row. Settles NC-D4. — open
- **B2** Extract the movement laws (walk, jump, swim, board, dash, KCC settings) into one portable core: a Rust crate,
  or AssemblyScript to Wasm (NC-D2). The web client runs it and its behaviour does not change. — open
- **B3** A cross-runtime determinism test: the same input tape run in browser Wasm, Node and native must produce the
  same positions (bit-exact, or within the tolerance NC-D4 allows). — open

**Done when** one movement tape gives the same result in all three runtimes.

### C. One wire schema (M)

There is no networking code today. The nearest pieces are the Worker tick protocol (`TickCommandSchema`,
`src/sdk/tickProtocol.ts`), the sim snapshot codec (`src/engine/sim/snapshot.ts`) and the client-ownership rules
(`src/format/clientOwnership.ts`). This phase moves to the MMO server plan once Jake writes it.

- **C1** Pick the schema tool: FlatBuffers or protobuf, both with TS, C# and Rust codegen. The schema is a committed
  text file and the bindings are build outputs. — open
- **C2** Commands, snapshots and deltas are defined in that schema. Static zone, NPC and quest definitions come from
  the cached Shardfile by id and never travel in messages. — open
- **C3** A test that the TS and Rust codecs round-trip each other's bytes. — open

**Done when** the web client's tick commands travel through the generated schema.

### D. Engine spike, two weeks (M)

- **D1** Godot 4.6 plus one Rust GDExtension (wasmtime, Rapier, the A3 decoders) loads one Pine Hollow cell from its
  real Shardfile:
  - terrain, scene batches and GLB/KTX2 content;
  - three materials compiled from the graph IR;
  - walking with the B2 core. — open
- **D2** The same cell in Unity 6, using glTFast, KTX for Unity, and a C ABI over the same Rust core. — open
- **D3** Measure both on a Windows PC and a Steam Deck, numbers in the commit:
  - frame time;
  - first-load pipeline stutter;
  - memory;
  - a golden-scene diff against the web client. — open
- **D4** The engine pick goes to Jake as one question, with the numbers and a recommendation. — open

**Done when** Jake has picked the engine.

### E. Native client v1: one shard on the MMO server (L)

- **E1** Shardfile loader and streamer: admission, tiles, tiers and LOD from the A specs. — open
- **E2** The material-graph compiler to the engine's shader language, plus the epilogue and presets. — open
- **E3** Pine Hollow's sky, weather, water and grass to the A6 bar. — open
- **E4** Connect to the MMO server through the C schema, with movement prediction through the B core and server
  correction. — open
- **E5** The baseline HUD, input (keyboard, mouse and gamepad) and settings. — open
- **E6** Steam integration (GodotSteam, or Steamworks.NET): sign-in to the same player record (SHARDFILE-NEXT phase
  I), overlay and achievements. — open
- **E7** A headless export build from the command line, committed as a script. — open

**Done when** a native player and a web player meet in Pine Hollow on one server. The native client must pass Pine's
golden scenes and beat the web client's frame time on the same PC.

### F. Every shard and the Steam release (L)

- **F1** Port each remaining shard's look to its golden scenes, one shard per row when the plan starts. — open
- **F2** The Steam store page, depot builds, beta branch and Steam Deck Verified review. — open
- **F3** Crash reporting and an update channel for the native build. — open
- **F4** A parity check in CI: golden scenes rendered by both clients on every native release. — open

**Done when** every shipped shard passes its golden scenes natively and the build is live on Steam.

### G. Optional: the web client on Steam first (S)

- **G1** Wrap the web client in Electron with steamworks.js: a Steam page and achievements in weeks, no faster than
  Chrome. It is replaced by phase F. Only on Jake's yes (Q2). — open

## Open questions (answer when the plan is unparked)

- **Q1** Spike both engines, or only Godot? Recommended: both (NC-D1). Two weeks buys a decision backed by numbers.
- **Q2** Should the Electron wrapper go on Steam before the native client? Recommended: no, unless a Steam page is
  wanted early.
- **Q3** Where does the native client live? Recommended: in this repo, with `native/` for the engine project as text
  and `crates/` for the Rust core, so the specs and the code move in one commit.
- **Q4** Is the phone allowed to lose Rapier SIMD for determinism (B1)? Recommended: decide on B1's numbers.
- **Q5** Does the native client ever run gameplay Wasm locally, beyond movement prediction? Recommended: no (NC-D3).
- **Q6** Which shard goes first? Recommended: Pine Hollow (NC-D5).

## Not in this plan

- The MMO server, its hosting and interest management: Jake writes that plan.
- Unreal (NC-D1), consoles, macOS and mobile native clients.
- Shared world state across zones: SHARD-PLATFORM-NEXT S10.
