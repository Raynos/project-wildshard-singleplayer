# Signal Dunes: the shardfile tiles are the only ground (G266, E435)

Jake approved the tiles (G266). This round deletes the code-built ground, the "Signal Dunes ground tiles" Developer
tool and their dead code. `board.jpg` shows BEFORE (code-built ground, main `4811026f9`) and AFTER (tiles only,
candidate `76cecd299`) at three dev poses: iPhone 16 Pro portrait, muted Chromium / Metal.

- **Frame floor** (`scripts/frame-floor.mjs --shards=sunscar-dunes --surface=both`):
  - tool on at main `4811026f9`: desktop 59.88 fps; Simulator 30.30 fps; PASS.
  - tiles-only candidate `76cecd299`: desktop 59.88 fps (spawn, whip); Simulator 30.30 fps (spawn, ray); PASS.
  - Receipts: `progress/frame-floor/4811026f9-96612-*.json` and `progress/frame-floor/76cecd299-87160-*.json`.
- **Pixel parity** (`progress/shard-platform/hybrid-tiles/part2/capture.mjs`, five dev poses; `pixel-diff.json`).
  - Before against after: mean abs 0.30–1.02 and 0.8–4.9 % of px > 8. This matches the tiles-shade proof: grain shimmer
    from the 1.953 m lattice, with no line and no tonal step.
  - The tool-on frames at main against the candidate: ≤ 0.09 mean abs, at the noise floor.
  - The player's feet move by at most 6.4 cm. The candidate draws 48 terrain tiles with 0 page errors.
- **Physics bake** rebaked from the candidate. Only `plugin.ts`'s input hash and the revision change; the actors,
  colliders and spots are byte-identical.
