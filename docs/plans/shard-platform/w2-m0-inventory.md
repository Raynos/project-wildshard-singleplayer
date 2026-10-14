# W2 milestone 0: Pine + Driftwood

Read-only source baseline `68e72579516106c8307cb72e1ec1b91d3b7f649e`; clean generated export. No W2 shard code or assets changed.

`shardLines(root, true)` supplies canonical G291/G294 contributions; `componentInventory` tags each contribution once. These are the existing W1 semantic rules, applied without editing them. **Unrecognised owners fall back to C9; C9 is not a measured boot-only workload, and C3 = 0 does not mean effects are absent.**

| Shard | Custom lines | Frozen TS denominator | Custom share | Unknown owner units |
|---|---:|---:|---:|---:|
| pine-hollow | 22,996 | 21,220 | 108.4% | 147 |
| driftwood-isle | 18,015 | 17,167 | 104.9% | 84 |

The numerator includes raw GLSL and one-user platform declarations; the denominator is frozen shard TS, so shares can exceed 100%. The 80/20 ceilings are Pine **4,244** and Driftwood **3,433** custom lines. AS is reported separately, not in this ratio.

## Component tags

| Component | Pine | Driftwood |
|---|---:|---:|
| C1 Static world | 4,683 | 6,329 |
| C2 Looks | 3,472 | 3,806 |
| C3 Effects | 0 | 0 |
| C4 Creatures | 1,657 | 1,983 |
| C5 NPCs and quests | 1,824 | 1,007 |
| C6 Items and combat | 2,627 | 483 |
| C7 Movers | 42 | 171 |
| C8 Audio | 888 | 1,219 |
| C9 Boot glue / unmatched fallback | 7,803 | 3,017 |
| **Total** | **22,996** | **18,015** |

## Biggest files per component

Numbers are that file’s contribution to the component, not its total length. Shard paths are relative to the named shard; `@` means repository `src/`.

| Component | Pine: largest two | Driftwood: largest two |
|---|---|---|
| C1 | `world/landmarks.ts` (234); `world/crags.ts` (156) | `models/shipwreck.ts` (636); `models/shrine.ts` (385) |
| C2 | `runtime/looks/keyedSky.ts` (445); `runtime/looks/riggedHulls.ts` (313) | `runtime/looks/streamedCover.ts` (399); `runtime/looks/instancedTiles.ts` (221) |
| C3 | none tagged | none tagged |
| C4 | `@game/systems/species/elk.ts` (249); `runtime/species/limbRig.ts` (232) | `runtime/looks/gullFlock.ts` (348); `species/sailor.ts` (191) |
| C5 | `quest/index.ts` (507); `runtime/quest.ts` (294) | `runtime/quest.ts` (279); `quest/adventure.ts` (194) |
| C6 | `runtime/items/boltCrossbow.ts` (536); `runtime/items/leverFirearm.ts` (455) | `weapons/IronSword.ts` (135); `weapons/swordView.ts` (99) |
| C7 | `runtime/entries.ts` (42) | `@game/plugin/mover.ts` (74); `runtime/entries.ts` (51) |
| C8 | `runtime/audio/ambience.ts` (226); `runtime/audio/sfx.ts` (199) | `runtime/audio/ambienceMix.ts` (351); `runtime/audio/sfx.ts` (162) |
| C9 | `life/index.ts` (666); `@game/systems/npc/npcRig.ts` (488) | `runtime/keeper.ts` (374); `loot/keepsakes.ts` (154) |

## Unknown-owner spans

The [complete unknown-owner list](w2-m0-unknown-spans.json) contains **all 147 Pine and 84 Driftwood units**, with exact TS ranges or named G294 declarations, sizes and their current tags. This is 95 and 49 distinct files respectively. Units can already contain known semantic subspans while lacking an explicit file owner.

| Unknown family (file/declaration units) | Pine | Driftwood |
|---|---:|---:|
| combat | 15 | 3 |
| compendium | 1 | 0 |
| compendium.ts | 1 | 0 |
| debug | 1 | 0 |
| dev | 1 | 0 |
| fpArms.ts | 0 | 1 |
| life | 5 | 0 |
| loadout | 6 | 1 |
| loot | 0 | 7 |
| npc | 0 | 3 |
| onboarding | 0 | 1 |
| one-user platform declarations | 72 | 47 |
| runtime | 44 | 19 |
| strings.ts | 1 | 1 |
| tiers.ts | 0 | 1 |

Ownership decisions needed before allocating the apparent C9 backlog:

| Mixed / unmatched owner | Proposed component boundary |
|---|---|
| Pine `life/index.ts` (730 total; 666 tagged C9) | C3 ambient non-shootable life; C6 harvest/knife beat; C8 voices. Its file header explicitly separates those systems. |
| Pine `combat/eliteScripts.ts` (325; 314 C9) | C4 encounter/body/action host, with C6 strike/contact and C3 tell ports kept separate. |
| Pine `@game/systems/npc/npcRig.ts` (488 C9) | C2 baked model/leg rig and C5 NPC pose bindings. |
| Driftwood `runtime/keeper.ts` (440; 374 C9) | C4 actual animal/body roster and brains, with C6 coconut contacts and C2 pose adapters. This is not an NPC keeper. |
| Driftwood `loot/keepsakes.ts` (154 C9) | C6 item/reward rules; C5 discovery/quest presentation. |
| Pine `runtime/looks/rainFx.ts`; Driftwood `runtime/looks/gullFlock.ts` | C3 read-only weather/ambient updates; C2 shaders/rig look. Mechanical tags currently scatter them through C1/C2/C4. |

## Proposed W2 lane split

One component owner works **both shards**; no separate per-shard implementations. Suggested assignments reuse the W1 owners’ existing APIs and the parked Pine authoring work.

| Lane | Components across Pine + Driftwood | First deletion target |
|---|---|---|
| sp-x4 | C1 static world | Pine undergrowth/remaining author closures; Driftwood shipwreck/shrine and static world through scene → bake → tiles. |
| sp-x1 | C6 items/combat | Pine crossbow/lever native controllers; Driftwood sword/loadout/keepsake composition. |
| sp-x6 | C4 creatures + C5 NPC/quests | Pine elite/native population and quest bindings; Driftwood keeper/population and adventure/finale bindings. |
| sp-x8 | C7 movers + C9 boot | Driftwood zipline/entry/mover tail and both declared boot/resource recipes; do not absorb unclassified life/combat into C9. |
| sp-x5 | C8 audio, then reserved C1 support | Both ambience/SFX/score owners onto shared declared routing; support author-only resource cuts after C8 closes. |
| Opus looks lead + one worker | C2 looks + C3 visual effects | Pine keyed sky/rain/rig looks; Driftwood streamed cover/tiles/gull visuals, coordinated with Codex on read-only channel engineering. |

Start with the ownership decisions above and independent C8/C1 deletions. Reserve mixed `runtime/index.ts`, `main.ts`, keeper and life hunks before edits. Preserve each shard’s style and living headless behavior; W2 implementation waits for the W1 90/10 line. No timing, parity or code port is part of this milestone.
