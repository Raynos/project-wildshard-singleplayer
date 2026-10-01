# E357 R9 — preload readiness proof

The detailed approved Captain is present before both first spawn and saved-altar restore: 45,192 vertices, 1024 px map. The asset files are unchanged.

- `fresh-encounter.jpg`: fresh flags, then `flags.set("used:altar")`.
- `saved-altar-reload.jpg`: reload the same origin without clearing saves; the Captain is already textured at restore, before waking.
- `proof.json`: exact build, geometry/map readings, all-seven boot errors and full-suite count.

Captured from a clean production export of candidate `1a286dffc48faafc45f502525e72c90592da863a`, phone tier, 390×844, muted, native GPU. Both final images inspected. Browser closed and previews stopped.

Reproduce: serve that candidate with `scripts/serve-build.sh --rev <sha>`, open Driftwood phone tier with `skipintro=1&nolock=1&mute=1&sw=0`, read `__wildshard.shard["driftwood.adventure"]`, set `used:altar` and inspect `finale.captain().mesh.geometry.getAttribute("position").count` and its first material map. Reload without clearing storage, repeat the measurement immediately after the loading screen. To frame the encounter, `world.player.spawn(pool.x, pool.z + 5, 0, adventure.floorAt(pool.x, pool.z + 5))`; the pool is the `shrine.pool` anchor.

Validation: TypeScript, whole-tree oxlint, CSS check, full Vitest (316 files / 2296 tests), and `parity --shards=all --tiers=phone --only=fingerprint+poses`; all seven `boot.errors` arrays are empty. Baseline differences are registry save-key growth and Pine drawing its approved NPCs before play; the lead owns the batch rebaseline.
