# E8d: the trophy wall (one row; Driftwood's plaques and Pine's trophy mounts onto it)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **LE9** (one trophy wall row:
frames, model, perk line, silhouettes; Driftwood's plaques and Pine's wall become rows), **LW8**'s wall half, **M9.1**
(Driftwood's `custom/collections`, its plaque displays) and the Pine `custom/trophyMounts` exit of HA7's custom-section
list.

## 1. The showcase piece

The **trophy wall** on the town's gate plaza: 12 frames (6 elites, the Vault Warden, the Foreman, the Titan, 2 secret
caches, a spare), each a silhouette until earned; a hung trophy's perk is always on (Driftwood's rule), shown as one
line under the frame (*Big Pallet's Tines: +5 % damage to crate robots*). Band slices fill it as their elites land.

## 2. Engine / game / host work, just in time

Research:

- **Two walls, two shapes.** Driftwood: `custom/collections` → `out/driftwood-isle/sections/collections/displays.json`
  drawn by `src/game/client/models/collectionWall.ts` (236 lines; `test/collections-display.test.ts`,
  `test/collection-game-ports.test.ts`). Pine: `custom/trophyMounts` from `generators/trophyMounts.ts` and
  `trophyWall.ts`. Both appear in the custom sections list (`lint/custom-sections.json`; migration map §7: "Live
  `custom/` sections in scope: DW collections … PH … trophyMounts").
- Trophies are owned ids (W2a's `kind: 'trophy'` rows); perks are effect rows (E0i).

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| `world/trophyWall` section | `{ id, at, yaw, model, frames: [{ owned, label, perk?: <effect id>, silhouette }] }` | format (new section) + game `collectionWall.ts` generalised (drawn from rows, no Driftwood names) |
| perks | a hung trophy grants its effect row (E0i's host) | data |
| delete | Driftwood's `custom/collections`, Pine's `custom/trophyMounts`, their generators' custom outputs | shards |

Host bar: two users at once (Driftwood, Pine) plus the showcase: 6/6. Guards: the custom-section freeze (two entries
gone), `shard-names`. Tests: the two collection tests above, new `trophy-wall-rows.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Driftwood | plaque displays (`custom/collections`), 3 trophies with perks | trophy wall rows | goldens of the plaque wall (Opus); the perk still applies (`test/owned-setup.test.ts`) | low: owned ids unchanged |
| Pine | trophy mounts in the lodge | trophy wall rows (its mount models as the frame model) | goldens of the lodge wall; Bag snapshot | low |

## 4. Done when, hours, blockers

**Done when:** the showcase wall shows 12 silhouettes and fills with earned trophies; Driftwood's and Pine's walls look
the same from rows; two custom sections are gone.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h (Codex; Opus for the generic frame look) | 8 h | 4 h (the wall model, 12 frames) | **20 h** |

**Blockers:** W2a (owned trophies), E0i (perk effects), E8b (the first trophy). Independent of E8c.

## 5. Risks

- Driftwood's plaques may carry layout fields that are really art direction; any that are become `look` fields on the
  row, never a Driftwood branch.

## 6. Questions for Jake

None: approved cleanup; the wall's look follows the round-11 remaster's plaza frames.
