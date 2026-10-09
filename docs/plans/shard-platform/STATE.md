# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten, never appended)

**2026-10-09 15:00 CT.** Councils done (11 rounds, 4 councils). Plan file = decisions + rows; this file = live status.

**Live:**
- **Production:** b20b732d (13:10 UTC).
- **main:** 1c74e4319, CI green. Not deploying: boot-smoke skipped on it (sp-x5 fixing).
- **G258** (public Pine / Nalati / Sky Reach) and **G270–G272** (public grid, saver off) ship with the next deploy.

**Gates:**
- Desktop 59.88 fps on the template with the harness on (`d34018fdc`).
- SF57 soak: both shipped-layout legs PASS (`ee8c0bcfd`).
- Frame floors on HEAD: op-floor is re-measuring all 8 shards and both grids.

**Done today:**
- **Public grid:** G258 admission (`986dc7495`). G266 Signal tiles-only (`8cce2181c`). G270 grid, G271 saver, G272 verified (`d3704c31e`, `195597049`).
- **New shard / legacy / kit:** SF55a + blender-template playable behind Developer (`d9312d5cc`, `48a8de415`). SF73 legacy copies + SHARDFILE for all six (`10a4fbc7d`, `0eabd2285`). SF54 kit guard (`4811026f9`).
- **Maps, rendering:** SF66 places, coverage and bake fixes (`934b319ec`, `b44a3f020`). Shadow-acne fix (`f9fe9e81e`).
- **Push pipeline:** witness manifests re-recorded at push (`ec89b2e60`), gate cache, own lease, exact-tip push (`420b061c8`, `693c85f5c`, `d8f159aa2`).

**Lanes (cap 5 Codex + 5 Opus):**
- **sp-x1:** Nalati SF72. Elites, reins, mounted body, crouch and player driver done. Next: storm/night elites, boss, sabre, witness.
- **sp-x2:** Pine SF72 tail. King FK activation, native ranged, dialogue, producers, weather, thralls.
- **sp-x4:** Driftwood SF72. Posed volumes, then treasures, camera, zipline, ecology.
- **sp-x5:** release pipeline (deploy stuck). Then idle.
- **sp-x6:** blender-template card facade (`16d7eb142` API), far-deck seams, floor.
- **Opus:** op-audit (true open rows), op-floor (fps on HEAD), op-loading (SF67), op-memdbg (SF64), op-process (G273–G275 CI and hook cuts).

**Open, not assigned:**
- SF66 map inside the shardfile (after G258).
- frame-floor.mjs still refuses Signal's Developer-off entry.
- Blender Template's public slot (Jake's board pending).

**Waiting on Jake:**
- G269: grid public after three phone runs.
- G260: Blender Template board (sent).
- Pier ramps: done (flared).
