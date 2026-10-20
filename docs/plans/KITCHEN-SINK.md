# Plan: KITCHEN-SINK — Template 3, the feature showcase shard

**State:** `open`, parked (2026-10-20): nothing is built until Jake says so. It runs **after SHARD-PLATFORM and before
SHARD-PLATFORM-NEXT** (G525). Not built by the SHARD-PLATFORM lanes.

Jake, 2026-10-20 (E490): *"All the mockups look great … that's a lot of content to build. I think we need a full plan
for template 3 … template 3 is not in scope for the short platform plan … Template 3 is great. We're going to park it.
I think I might ask the builder to implement it, but not right now … we're going to do the template 3 plan before we
do short platform next."* Also: *"That's a really cool kitchen sink template"*; *"template 2 being the blender template
and template 3 being the kitchen sink template is a good way of going about it."*

Mini plan page: [Template 3 Showcase](https://claude.ai/artifact/PSu7FrfxSYEA5gdZfpeWbe). Mockups:
`art/blender-template/round-5-content/` (13 frames, look C). Decisions: G522–G525 in
[shard-platform/decisions.md](shard-platform/decisions.md).

## What it is

- **Template 3, the kitchen sink:** a dev-map test map (look C, G523: Source dev-map orange and grey, stencilled size
  labels, light grey 1 m grid floors, bright light) where each zone stress-tests one engine feature, tied together by one
  quest chain ending in a boss. Fun to play, simple to look at.
- **0 % custom TypeScript from day one** (G524): shared hosts, rows and AssemblyScript only. A feature that can't be built
  that way is a finding: a host-bar row with Template 3 as one of its two real users, never shard TS.
- **Blender and generators wherever each fits**; one 500 m cell; it takes the inner 3 × 3's open plot of the 5 × 5 grid
  (G522).
- **Templates 1 and 2 stay clean starters** for authors to copy: Template 1 procedural, Template 2 the Blender template.

## Zones

| Zone | Engine features | Shared host | Gap to check |
|---|---|---|---|
| 01 Hub | Quests, dialogue, journal, vendor | Quest steps, chapter director; loot economy rows | — |
| 02 Weapon range | Sword, spear, bow, crossbow, hit numbers | G475 held weapons; G516 bow/crossbow approvals; practice targets | — |
| 03 Creature pen | Wildlife, taming, mounts | Population rows; G478 taming and riding | — |
| 04 Riding course | Riding, rings, lap timer | G478 practice courses | — |
| 05 Movers park | Lifts, spinners, rails, conveyors, jump pads | Native movers, motion segments, jump pads | Conveyor |
| 06 Grapple tower | Grapple, zipline, checkpoints | G478 grapple traversal and course | Zipline |
| 07 Stealth yard | Detection, patrols, vision cones | G478 stealth controller | — |
| 08 Elite gauntlet | Waves, named elites | Spawn director, G473 elite programs | — |
| 09 Boss arena | Phases, telegraphs, hazards | G474 boss host, arena rows, AS boss script | — |
| 10 Weather and night | Storm, day/night, light emitters | Weather host rows, day clock, eased fields | — |
| 11 Physics and hover | Physics props, hoverboard tricks | Engine physics pieces; hoverboard host | See-saw, trick scoring |
| 12 Portal vault | Walk-in portal, interior, pressure plates | G478 walk-in portal rides; interaction rows | Pressure plates |

## The quest chain: "The Foreman's Yard"

1. Clock in at the hub; the Foreman sends you to the SUPPLY vendor (quests, dialogue, shop).
2. Qualify on the weapon range with two weapon types (held weapons).
3. Tame the dev-bot horse and beat the riding course's par time (taming, riding, practice).
4. Reach the cistern roof through the movers park, then grapple to the tower top (movers, grapple, zipline).
5. Steal the keycard unseen in the stealth yard (stealth).
6. Open the Training Vault portal and solve its pressure-plate room (portal rides, interiors, interactions).
7. Light the four beacons in the evening storm (weather, day/night, light).
8. Survive five waves and Foreman Unit 7 in the amphitheatre (spawn director, elites).
9. Beat the Crate Titan; the reward is the hoverboard upgrade for the physics park (boss host, loot).

## Rows

| Row | What | Effort (est.) | Status |
|---|---|---|---|
| **K0** | Name, slug and boss name confirmed with Jake (proposal: "Kitchen Sink Template", `kitchen-sink`, the Crate Titan) | — | needs pick |
| **K1** | Skeleton: new shard from `src/shards/_template/`; the 500 m cell, roads, hub and the quest spine; dev-map materials; grid slot in the 5 × 5 | 2 days | open |
| **K2** | Zones batch 1: weapon range, creature pen, riding course, movers park | 2 days | open |
| **K3** | Zones batch 2: grapple tower, stealth yard, weather and night, physics and hover | 2 days | open |
| **K4** | Zones batch 3: elite gauntlet, boss arena (the Crate Titan), portal vault, the hub vendor | 2–3 days | open |
| **K5** | Missing hosts found by K2–K4, each through the host bar with Template 3 as a real user | as found | open |
| **K6** | Chain polish, rewards, side activities (lap records, trick scores, target scores) | 1–2 days | open |
| **K7** | Grid-ready (memory, one-frame looks, baked tiles, entries, edge profile, HUD accent) and seamless travel to its neighbours | 1 day | open |
| **K8** | Jake plays it on the phone; his notes are the verdict | — | open |

About 10–12 lane-days (estimate): one Opus lane for the look plus one Codex lane for rows and AS.

## Done when

All 12 zones and the 9-step chain play end to end on the phone tier; 0 custom TS lines on the ruler with every gap a host
row; grid-ready on all six checks within the memory limit; it travels seamlessly in the 5 × 5; Jake has played it.
