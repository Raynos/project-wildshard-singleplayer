# grid / round-8-soft-wall: a neighbour that isn't ready (V13)

**Question: what do you see at a neighbour cell's edge while its sim isn't resident** (SF18d's soft wall: never open air, never a fall)? Seen from the highway north of Driftwood toward Pine Hollow, bare hands (safe zone). Rounds 1–7 of `art/grid/` belong to the world agent.

| File | What it shows |
|---|---|
| `A-fog-bank.jpg` | A thick fog bank across the cell edge with a gentle push-back, one small pill "PINE HOLLOW IS STILL LOADING" |
| `B-shimmer-barrier.jpg` | A translucent cyan hex shimmer barrier with "LOADING PINE HOLLOW" and a progress bar on it |
| `C-toll-gate.jpg` | A closed toll-gate on the highway: boom barrier lowered, sign "LOADING PINE HOLLOW" with a progress bar and "62 %" |
| `board.jpg` | The pick board: A / B / C side by side |

**Recommended:** **A**: it is diegetic and matches the outer ring's sea fog, so a short wait reads as weather, not a broken game.

**How they were made** (ask E438, SHARD-PLATFORM mockups, 2026-10-04): codex `image_gen` edits of fresh iPhone 16 Pro portrait captures (402 × 874 @3×, muted, through the browser lane) of a `serve-build.sh --head` build of `3d06668e4` (the live deploy is 251 commits behind and has no grid entry). Every UI string was quoted in the prompt. 1024 × 1536 frames, JPEG q88. Mockups only: nothing here is built.
