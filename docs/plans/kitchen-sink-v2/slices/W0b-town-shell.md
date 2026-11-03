# W0b: the town shell (walls, six gates, plaza, Main Street, houses, obelisk, stable)

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the town part of the old
**K1**. Layout: `art/showcase-template/round-4-blockout/README.md` §"The town: 120 × 120 m", `layout.js`.

## 1. The showcase piece

| Item | Rows (data + Blender script) |
|---|---|
| Town wall | 120 × 120 m, walkable wall-walk only where the zip house and gatehouse roofs need it |
| Six gates | East (combat, the only way in), Stable, Movers, West, Park, Range; each with its name board; the East Gate is a gatehouse (vista ★6 on its roof, W9b) |
| Gate plaza | 40 × 40: quest-board stand, contracts-board stand, trophy-wall frame (12 empty frames), feats plaque, three stalls, lamp posts (light emitters) |
| Obelisk | 22 m at the head of Main Street (Gold ●9 on its crown, W9b) |
| Main Street | 72 m; fronts for Tinker Rook and the weapons shop (keepers in W1a, stock in W2b), three TO LET fronts, the zip house (roof finish pad for W7b) |
| Stable | inside the Stable Gate (horse in W10a) |
| Houses | 35 houses, 2–4 storeys, a cross lane and two back alleys; colliders for every wall and door frame |

The board, wall and frames are props now; their behaviour arrives with W1b (quests), E1 (contracts) and E-slices
(trophies).

## 2. Engine / game / host work, just in time

None. Static props, colliders and light emitters are existing rows (`world/props`, `world/collision`,
`light.emitters` client-plan kind). Instancing only (no facade multi-draw, E271/E272;
`scripts/test-facade-instancing.mjs` stays green): the 35 houses are a handful of house parts instanced.

## 3. Other shards in this slice

None.

## 4. Done when, hours, blockers

**Done when:** in Developer you walk from the arrival point through the plaza and Main Street, out of each of the six
gates; eye-height portrait captures of the plaza (`05`) and Main Street (`06`) match the round-4 frames' composition in
the polished look; walk baseline 0 stuck; draw calls for the town in one portrait view recorded in the commit.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 0 | 0 | 18 h (Opus: Blender town kit, instancing, captures) | **18 h** |

**Blockers:** W0a.

## 5. Risks

- 35 houses × 2–4 storeys is the biggest static mesh set in the west; instancing and LODs are the plan, measured in W12.
- Interiors of the shops are not in scope (fronts and counters only) unless Jake asks.

## 6. Questions for Jake

1. **Shop interiors.** (a) counters on the street front only; (b) walk-in shop rooms. **Recommended (a):** the shop is a
   panel (W2b); rooms cost draw calls and give nothing to do.
2. **TO LET fronts.** (a) boarded fronts with signs; (b) dressed as closed shops for future content. **Recommended (b):**
   reads as a living street and leaves room for later shops.
