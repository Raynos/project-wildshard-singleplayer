# E12g: the Titan gate, the hidden arena and the three-phase fight

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the arena and fight part of
**EB8** and parent **K6**, **LS3** for the Titan (×22 a common, ~18,700 HP, ~3.6 min at equal level), ruling 19ac (the
boss portal) and round 5's Titan gate and arena. Opus (G848).

## 1. The showcase piece

- **The Titan gate** (surface, SE corner): a 14 m lane between 4 m crate walls into a 39 × 38 m plaza with the last
  checkpoint, the L20 plaque ("THE LAST CONTRACT"), the **18 m portal arch** (a ⌀12 m portal, the boss fog) and the
  return pad. Reached through G3 (E11d) or the Titan road once unlocked.
- **The hidden arena** at floor y −150 under the SE (x 80–220, z 95–235, its own sky to −80; an E10a interior): a ⌀104 m
  floor, 8 m wall, stands to ⌀140 with four floodlights, four 10 m rolling lanes, an edge-leap band at r 40–50, four
  crate covers at r 30, the **south alcove** (inner checkpoint, exit portal, fog gate).
- **The fight, L20**: P1 "Stacked" (100–66 %): fist **slam** (ring 1.2 s, then a shock ring to jump), arm **sweep**
  (180°, 0.9 s), **crate rain** on ringed spots (1.0 s); knees glow 2 s after a slam (×1.5). P2 "Unpacked" (66–33 %):
  sheds four Mite adds; the chest core shows (break it for a 4 s stagger); denser rain. P3 "Overflow" (< 33 %): faster;
  an edge leap and three ground-pound rings; a 4 × 8 block rolls down a lane (1.0 s); rain piles shrink the cover. No
  enrage. Retries respawn in the alcove without a reload.

## 2. Engine / game / host work, just in time

None new if the earlier slices hold: the boss host with an interior arena (E12a, E12c), the interior (E10a), strike
shapes incl. rings with `jumpDodges` (`src/format/creatures.ts:91`), hit zones (E4: knees, the core), hazards for rain
piles (E4's `leaves`), adds by stage (E11b), blast knockback (E0g), the phase music layers (E15a). The cube rule (W0e)
validates the arena box. If the 4 × 8 rolling block needs a moving collider, it is a `track` mover (W6a) triggered by
the boss's strike, not a dynamic body.

## 3. Other shards in this slice

None.

## 4. Done when, hours, blockers

**Done when:** an L20 player beats the Titan in ~3–4 min, an L17 one finds it brutal; every tell is fair at 30 fps (a
portrait capture of each attack from sword range); retries respawn in the alcove with no reload; the memory with the
arena loaded is read on the Simulator (surface near tiles + one interior, numbers in the commit); the walk baseline is
0 stuck in the arena.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 4 h | 0 | 24 h (Opus: gate 4 h, arena 10 h, fight 10 h) | **28 h** |

**Blockers:** E12a, E12c, E12f, E10a, E11d (G3), E4, E11b.

## 5. Risks

- Round 5's arena is 15,394 m² of footprint with its own sky: the interior's draw count and the Titan's 7k tris plus
  instanced crates must fit beside the surface's near tiles under the 1.2 GB per-shard cap.

## 6. Questions for Jake

1. **Retries.** (a) respawn in the alcove with the 3 s short intro, no reload (round 5); (b) respawn at the Titan gate on
   the surface. **Recommended (a):** Elden Ring's stake at the fog; a surface respawn means a portal load per attempt.
