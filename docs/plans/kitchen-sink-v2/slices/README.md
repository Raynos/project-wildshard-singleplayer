# Kitchen Sink v2: the build as vertical slices

**Jake, 2026-11-03** (replaces the two waves): *"I think what's far more important is to not have the plan go so
waterfall, but to have the plan go in vertical play slices. Start on the west half, the non-combat half … break it down
into as many small chunks as possible … For each one of the things that requires new engine work … that new engine
work has to be front loaded within that phase … And once that new engine content is implemented, then you implement
that part of the showcase … rather than spending weeks implementing new engine features without using them, you do
these mini vertical slices end to end, where you implement the engine blocking work just in time before implementing
that part of the shard. And the actual shard is going to go in two massive chunks: the west side, then the east side …
anything that touches the engine and the game potentially impacts all the other shards. So within that vertical slice,
it needs to go and fix all the other shards if it touches a refactor that crosses all the shards."*

## The slice rule

Every slice runs the same four steps, end to end, before the next slice depends on it:

1. **Engine / game / host work first, just in time**: only what this slice's piece of the shard needs. It passes the
   host bar (docs/HOST-BAR.md): data-only APIs, per-shard logic as AssemblyScript, no shard branches in the engine.
2. **Every other shard that uses what was touched moves onto it in the same slice** (Driftwood, Pine Hollow, Nalati,
   Nine Dragon, Sky Reach, Signal Dunes, the templates): their custom section / named JSON / shard-named code deleted,
   each proved unchanged (focused tests + a look in the game). Approved cleanup from other plans rides along.
3. **The showcase piece**, data and AssemblyScript only (0 % custom TS), in the polished look (ruling 19ab), behind
   Developer.
4. **Playable and checked**: the slice's piece is walkable in the showcase on a served build; the slice's done-when is
   met; then it lands and pushes.

## Order

Two halves, west then east. Inside each half, small slices in order; a slice may start when the slices it names as
blockers are done. Slice ids: **W0…** west, **E0…** east. One file per slice in this folder.

| Slice | Piece of the shard | Engine / game / host work pulled in just in time (from the old Wave 1 rows) |
|---|---|---|
| W0 | Skeleton: the cell, seam wall, roads, ground, town shell, grid slot | template start; the ruler made honest (HA0/HA1/HA5); the shard cube rule (19ad, W15 part) |
| W1 | Town, six NPCs, dialogue, the quest board with grey / yellow "!" | quests + vendor + currency on one author path; breadcrumb guide (W20) |
| W2 | Shops: Tinker Rook (UPGRADES, BENCH), the weapons shop, the pack | economy host (LE rows; Driftwood / Pine / Nalati economies normalised) |
| W3 | Weapon range: sword, spear, bow, crossbow + ammo, lever rifle; dummies, targets, PB board | held weapons as weapon-family rows with ammo and parry; firearms out of the plugin (N2/N5); personal bests |
| W4 | Physics yard: plates → gate, crates, see-saws, ball run | interactables section; physics props; hinged body (W14 part) |
| W5 | Hover park: kickers, halfpipe, rails, bowl, trick score | board moved to game; trick scoring (W14 part) |
| W6 | Movers run: six stations | movers out of the plugin; conveyor and jump pad |
| W7 | Grapple course + 99 m zip | grapple approvals (W10); course timer |
| W8 | Climb yard: ladders, scramble wall, rope bridges | scramble climb mode; rope-deck generalised (W18) |
| W9 | The Rock, squeeze cave, vistas, caches, Gold 1×1s, FINDS | generic interior (W15); finds / perks / trophies rows (W16) |
| W10 | Riding course + paddock + loaner horse | given-mount row, no taming |
| W11 | West world: day / night, weather, west audio | weather kinds renamed (W13); audio states; ambience zones |
| W12 | West finish: Jake's west phone pass | memory / grid-ready for the west |
| E0 | Levels and combat core, the HUD pieces | LV rows (level, attributes, hit / miss / damage, XP), HC rows, enemy cap; other shards untouched (19z) |
| E1 | Band 1: Crate Mites, packs, respawn, XP, parts, contracts | robot Blender pipeline; spawn / leash; loot drops; contract board |
| E2… | Bands 2–6, night and rare variants | per-band AI; variants |
| E… | Elites, stealth yard + storm hour + beacons, the Training Vault, the gauntlet, the Crate Titan (portal + hidden arena), quest tiers, the shard-complete card, east audio, balance, Jake's phone pass | elite host; shrine host + interior; wave director out of the plugin; one boss path + cutscene timeline; completion validator |

The research agents split these further where a slice is too big; the final list is in [INDEX.md](INDEX.md).

## How slices run (Jake, 2026-11-03)

- **Jake plays at the end of the west half and at the end of the east half.** Slices land on their own checks (focused
  tests, captures) behind Developer; the live Developer build always has the latest.
- **A slice that touches a shared host normalises the whole host family** and moves every shard that uses it onto it,
  custom code deleted: no half-migrations.
- **Parity proof:** the migrated shard's focused tests always; its 24-camera goldens when the change can move pixels
  (world, models, render); one in-game look otherwise.
- **Parallel after W0–W2:** skeleton, town and shops in order; then the toy slices in parallel lanes (5 Opus + 5 Codex),
  one lane per slice; two slices that touch the same host run one after the other.
