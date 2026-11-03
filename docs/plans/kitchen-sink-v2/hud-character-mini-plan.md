# Mini plan: HUD for levels and the Character screen

Parent: [KITCHEN-SINK.md](../KITCHEN-SINK.md). Ordered by Jake 2026-11-02 (E523). The shared HUD is coordinated over
herdr (AGENTS.md E332): before a HUD row lands, `herdr agent list` and a notice to the HUD owners; after, the SHA.
Levels rows LVH1–LVH5 live in [levels-combat-mini-plan.md](levels-combat-mini-plan.md); this plan is their design.

## Decisions (Jake, 2026-11-02)

1. **XP bar along the bottom, above the controls, with an "LV n" chip at its left** (mockups S1, S2 in
   `art/showcase-template/round-4-v2-layout/`). Shown in levelled shards; hidden where levels are hidden (every shard
   but the kitchen sink today).
2. **Enemy nameplates within ~25 m**: "Lv 7 Plumb Drone", an HP bar, coloured by level gap (grey, green, yellow,
   orange, red, skull, like WoW). Hidden in level-1 shards (today's behaviour stays).
3. **No potion / heal button.** No mid-fight heals; regen is out of combat only.
4. Attributes grow automatically, so the Character screen is read-only: no point spending.
5. Quest givers show a grey or yellow "!" (quests mini plan).

## Pieces

| Piece | Where | Notes |
|---|---|---|
| XP bar + LV chip | bottom, above MOVE/LOOK | thin; fills on kills; flashes on level-up |
| Level-up moment | centre toast | "LEVEL UP 7", the attribute gains listed, a sting; full heal |
| MISS / GLANCE / CRIT numbers | floating over the target | miss = "MISS", glance grey, crit large; also over you when enemies miss |
| Nameplates | over enemies within 25 m | level, name, HP, con colour; rare variants get a rarity tint; elites a banner (exists) |
| Character tab | pause ▸ Bag ▸ CHARACTER | level, XP to next, the 8 attributes with what each does, derived stats (HP, damage, armour, crit, miss) |
| Grey/yellow "!" | over quest givers | world marker + minimap |
| Death XP loss | the death card | "−25 % XP of this level" line on the existing "Killed by…" card |

All of it is data-driven from the levels rows; none of it shows when a shard's level range is 1 to 1.

## Rows

| Row | What | h |
|---|---|---|
| HC1 | XP bar + LV chip (hidden by default) | 3 |
| HC2 | Level-up: in-combat chip ("LEVEL 7 · +11 VIT") + ring + sting; the tick-up card only out of combat (levels-combat §15) | 4 |
| HC3 | Floating numbers: white hit, yellow crit + shake, grey glance, DEFLECT / DODGE / PARRY words, red on you; ≤ 6 on screen | 3 |
| HC4 | Nameplates with con colours, 25 m, rarity tint, stagger bar under HP, status tint (burn/shock) | 5 |
| HC5 | Character tab (read-only): 7 attributes with par, ▲▼ aptitudes, derived numbers (§15) | 5 |
| HC6 | Quest-giver grey/yellow "!" markers | 2 |
| HC7 | Death card XP-loss line | 1 |

Each shows only on a shard that opts into levels (the showcase; other shards have no levels, ruling 19z) and goes
through the E332 herdr notice. Mockups to check against: round-11 remaster S1, S2, E1–E6, W3, S6.
