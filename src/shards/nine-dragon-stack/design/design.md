# Nine Dragon Stack · design.md (the light front)

<!-- WORLDCLAW-SHARD §2c, D85–D87, row L2 (ask E406): Nine Dragon's design written from the live shard in T1's formats
(scripts/worldclaw/spec.ts). The prose is the shard as it is; the ```json worldclaw block and spec.json are its machine
twins (scope "slice": an existing shard's fragment). The full shard's intent stays in docs/plans/NINE-DRAGON-STACK.md. -->

## Vision (Jake, E169)
A vertical city stacked 500 m high: Chongqing meets Kowloon Walled City. Nine street strata, the nine dragons; you wake on
the sixth, Lantern Square, +125 m, halfway up the sky (NINE-DRAGON-STACK §1).

## The pitch, as built so far
A prototype fragment of shard 4: Lantern Square, its night market, the Yamen Well's rim, its galleries and crossings, and
the stair-street. **Look:** Jiehua Neon (界画霓虹, Jake's pick; `look/`). **Weapon:** the Neon Jian on the kit sword.
**Verbs:** walk, the stair-streets, the Well's crossings, and the Fei Zhua grapple (a playable zip across the Well; the
fuller hook-and-swing is F2). **Roster:** none yet (the gate's combat check uses a practice dummy). **Boss:** none yet
(planned: the Well Dragon). **Quest:** none yet (planned: Nine Red Envelopes).

## Places (as live: `places.ts`, each a Set)
| id | Place | Role | Beat |
|---|---|---|---|
| lantern-square | Lantern Square | spawn | you wake here, +125 m, halfway up the sky: the paifang, the banyan, the mahjong tables, the shrine |
| night-market | The night market | hub | the noodle stall and the hawker stall: steam, lanterns, the crowd |
| stair-street | The stair-street | traversal | three flights climbing east out of the square to the stair gate (+146 m) |
| well-rim | The Well rim | landmark | the balustrade over the Yamen Well: 375 m of lit galleries falling into silk mist |
| well-galleries | The Well's galleries | vista | the galleries projecting into the shaft, floor after floor down to the fragment's cut |
| crossings | The Well's crossings | traversal | bridges and catwalks across the Well at a dozen heights, receding north into the mist |

Coordinates in `spec.json` come from `layout.ts` and `world/well-plan.ts` (x east, z south, y altitude; Lantern Square's
datum is +125 m). The galleries' height is the middle of the built gallery floors (+59 … +125 m); the crossings' is
the median of the 11 crossings' decks.

## The routes, as live (typed legs)
- **square-to-street**: walk from the spawn through the paifang and north up the street.
- **stair-street**: walk to the square's east edge, then the stair (three flights, +21 m).
- **to-the-rim**: walk to the Well's balustrade.
The Well's crossings are reached through the galleries; the grapple's zip across the Well is a verb, not yet a route
(its slots come when F2's hook registry lands). The walk test runs 7 legs, 0 stuck (NINE-DRAGON-STACK §6.1).

## The session slice, as it stands
spawn → the night market → the Well rim → the stair-street → the crossings: a short walk with the jian and one grapple
zip. No quest, no creatures, no boss yet.

## What is not in the fragment
The other eight strata, the cube's four gates at Old Street (datum 0), the lifts, the laundry-line zip, the umbrella glide,
the cable cars, the monorail, the nets, the creatures, the elites, the Well Dragon, the Nine Red Envelopes, the typhoon:
all in NINE-DRAGON-STACK, none built.

## §run
mode: existing · stage: light front · waiting on: Jake's pass (the pillars, the next slices) · next: the first slice as a
checkpoint (§2b, row L3). Paused for this front (D86): the fragment's open rows E281 round 3, the F3 trailer review, F8,
F9's physical retest, F10, and E380's re-plan, which this front feeds.

## Verdict log
- E169: the shard and its plan; Jiehua Neon (Jake's pick).
- (Jake's light-front pass goes here: the pillars and the next slices.)

## The checkpoints
(none yet)

```json worldclaw
{
 "slug": "nine-dragon-stack",
 "scope": "slice",
 "places": [
  {
   "id": "lantern-square",
   "role": "spawn",
   "name": "Lantern Square",
   "beat": "you wake here, +125 m, halfway up the sky: the paifang, the banyan, the mahjong tables, the shrine"
  },
  {
   "id": "night-market",
   "role": "hub",
   "name": "The night market",
   "beat": "the noodle stall and the hawker stall: steam, lanterns, the crowd"
  },
  {
   "id": "stair-street",
   "role": "traversal",
   "name": "The stair-street",
   "beat": "three flights climbing east out of the square to the stair gate (+146 m)"
  },
  {
   "id": "well-rim",
   "role": "landmark",
   "name": "The Well rim",
   "beat": "the balustrade over the Yamen Well: 375 m of lit galleries falling into silk mist"
  },
  {
   "id": "well-galleries",
   "role": "vista",
   "name": "The Well's galleries",
   "beat": "the galleries projecting into the shaft, floor after floor down to the fragment's cut"
  },
  {
   "id": "crossings",
   "role": "traversal",
   "name": "The Well's crossings",
   "beat": "bridges and catwalks across the Well at a dozen heights, receding north into the mist"
  }
 ],
 "happenings": [],
 "npcs": [],
 "enemyZones": [],
 "elites": [],
 "boss": null,
 "quest": [],
 "routes": [
  {
   "id": "square-to-street",
   "legs": [
    "walk"
   ]
  },
  {
   "id": "stair-street",
   "legs": [
    "walk",
    "stair"
   ]
  },
  {
   "id": "to-the-rim",
   "legs": [
    "walk"
   ]
  }
 ],
 "gates": [],
 "slice": [
  "lantern-square",
  "night-market",
  "well-rim",
  "stair-street",
  "crossings"
 ],
 "run": {
  "mode": "existing",
  "stage": "light front"
 }
}
```
