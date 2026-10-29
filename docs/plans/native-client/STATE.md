# NATIVE-CLIENT — State (≤ 3 KB)

**2026-10-29:** `draft`, parked (E509). Written from the E508 research
(`docs/audits/native-client-engines.md`, page https://claude.ai/artifact/KYjGx2ZtrhoekqWeQEMzoF). Ranking: Godot 4.6,
then Unity 6, then Unreal 5.

Seven phases, A–G, with every row open and nothing started:

- **A:** a client-neutral Shardfile (specs, test vectors, golden scenes);
- **B:** a shared prediction core;
- **C:** one wire schema;
- **D:** a two-week spike in Godot and Unity;
- **E:** the native client on one shard;
- **F:** every shard and the Steam release;
- **G:** optional, the web client on Steam through Electron.

The proposed decisions NC-D1 to NC-D6 and the questions Q1–Q6 wait for Jake's grill. Phases E and F need the MMO
server, whose plan Jake writes. The plan depends on WASM-HOST W13, SHARDFILE-NEXT J and HOST-AUDIT. It starts only on
Jake's word and is not the SHARD-PLATFORM builder's.
