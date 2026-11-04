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

## Decisions (Jake, 2026-11-03: the 38 UI changes, one by one)

All 38 in-engine before/after pairs (`art/showcase-template/round-12-ui/`, the "Kitchen Sink v2 UI Changes" page) are
decided: **33 approved, 5 cut**. Each item, its frame and Jake's words: [UI-PICKS.md](UI-PICKS.md). The rules they set
(slice decisions D49–D61 in [slices/DECISIONS.md](slices/DECISIONS.md)):

1. **Nothing permanent and busy.** No banner or chip stays on screen for a moment that has passed. Wave starts, storm
   hour and each beacon get one centred line that fades in ~2 s (UI-24, UI-22); no minimap beacons, no extra toasts.
2. **One chip under the minimap.** While an activity runs, its chip takes the quest chip's place and the quest chip
   comes back after: the course clock (UI-20), the Training Vault's TRAINING VAULT | ROOM 2/4 · 3 LEFT (UI-29 A), the
   hover park's trick score (UI-31).
3. **The fight row is four in a row**: GUARD · LOCK · DODGE · JUMP, GUARD in the slot the spear's THROW takes, only with
   the sword (UI-06). **No BOLTS disc**: tap the weapon chip and three ammo tiles slide out beside it (UI-35 C2); no
   ammo list in the bag.
4. **The bag has five tabs**: MAP · CHARACTER · FINDS · PACK · FEATS. Gear folds into CHARACTER (CHARACTER / GEAR
   sub-tabs, opens on CHARACTER; UI-10); the map tab holds MAP / QUESTS sub-tabs (opens on MAP) with the quest list,
   one quest's details, a locked quest and the tracked quest's card (UI-14).
5. **Dialogue never offers a dead button**: a level-gated quest says NEEDS LV n once by its name and ends on one OK
   (UI-13). Leaving a mini dungeon is walking through its real exit portal; the SHRINE COMPLETE card has one CONTINUE
   (UI-30).
6. **Toasts are one short line at a time** ("FOUND · GOLD 1×1 · 5 / 20"); details live in FINDS / FEATS (UI-18 A).
   Stealth is one eye + UNSEEN row top left, no toast (UI-23 B).
7. **In the world**: the quest-giver "!" sits just above the head (UI-12); boards with information (personal bests)
   are real signs, placed properly (UI-21). A first-time hint teaches a mechanic once (UI-11).
8. **Cut**: the map's level heat map (UI-27), the minimap band border (UI-28), a HUD Scrip chip and the per-kill
   "+3 Scrip · +1 Servo" toast (UI-38), the range's LOAN tags and toast (UI-37), the tour-step toast (UI-15).

Approved as shown: the XP bar (UI-01), level-up in a fight (UI-02) and its out-of-combat card (UI-03), nameplates
(UI-04), floating text (UI-05), the named-elite banner (UI-07), the boss bar's phases (UI-08), the death card's XP line
(UI-09), the kill-contract board (UI-16), the checkpoint card (UI-17), the shard-complete card (UI-19), the portal ENTER
prompt (UI-25), the boss title card with HOLD TO SKIP (UI-26), Tinker Rook's UPGRADES / BENCH (UI-32), the weapons shop
(UI-33), the 20-slot pack (UI-34) and the trophy perk card (UI-36). Every one still sends the E332 herdr notice when
it is built.

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
