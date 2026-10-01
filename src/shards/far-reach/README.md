# Sky Reach (`far-reach`)

Shard 6 (E364, concept **B**, Jake's pick 2026-10-01): grass islands adrift on a sea of cloud at golden hour. Rope
bridges join some islands; glowing **hover bridges** join others, and carry you only while you ride the hoverboard.
On foot you fall straight through them into the clouds. The windmill isle's bridge has fallen: raising it is the
quest. A drift ray (a flying manta) hunts from the sky. Your weapon is a war fan. Mockup:
`art/far-reach/round-1-proposals/B-sky-reach.jpg`. Built from `src/shards/_template/`, `docs/SHARDS.md` and
`docs/ENGINE.md` only, with zero engine edits.

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `experimental`, 6 |
| `style`, `kitLook` | `toon`, `toon` (the look is its own `LookStrategy`, below) |
| `uses` | `spawns`, `quests`, `hover`, `explore` |
| `ground` | `buildTerrain` over five round islands (`layout.ts` `skyLandscape`); the void between them drops to −40 m under the cloud sea (y 6); `bounds.floor` 2 respawns a fall |
| `loadout` | the war fan (held) and the kit hoverboard |
| `species` | the kit boar (a `cliff` variant, two on Fern rock) and `skyManta` (the drift ray) |
| `bag` | MAP · GEAR · NOTES |
| `tiers` | no god rays, no AO; no shard knobs |
| `assets` | none: primitive / procedural geometry, SVG cards, kit sounds |
| saves | one shard key, `far-reach.bridge` (the bridge is up and its reward paid) |

## The islands and bridges

| Island | Reached by |
|---|---|
| Landing isle (spawn) | — |
| Fern rock (east) | rope bridge from the landing isle |
| Windmill isle (north) | the fallen bridge, once the winch raises it (the quest) |
| Ray roost (west) | **hover bridge only**, from the landing isle |
| Lantern rock (south-east) | **hover bridge only**, from Fern rock |

- **Rope bridge:** wooden planks, rope rails and posts; a deck collider plus two rail colliders, always on.
- **Hover bridge:** gapped glowing glass tiles, gold edge bars and a floating crystal on a stone post at each corner,
  no ropes, and a HUD pin "HOVER BRIDGE · BOARD ONLY" at its start. Its deck collider is a registry piece whose
  `active()` is "the player is on the hoverboard", so the hover spring rides it and feet fall through it. The glass
  brightens while you ride and dims to a ghost on foot.
- **Fallen bridge:** a rope bridge hanging off the landing isle's north rim. The winch beside it swings it up over 4 s;
  its colliders turn on when it is up.

## Its custom code, and why

| File | What |
|---|---|
| `plugin.ts` | the three hooks; the GUST targets; the bridge raise, hover-glow and edge systems; spawns the ray and the boars |
| `weapons/WarFan.ts` | rung 3 (custom, `extends Weapon` from `blocks.viewmodel` + `blocks.melee`): SWING is a 4 m slash; GUST throws every foe in a 10 m, ±35° cone back (damage 6 + a push the plugin integrates). Anything pushed over the void falls into the clouds and dies |
| `species/manta.ts` | the drift ray: a `SpeciesRow`, a custom-rig `SpeciesLook` (body · head · wings · tail, skinned, wing flap and bank) and `MantaBrain` (`circle → dive → rise`). The dive is a `StrikeSpec` lane run by a `StrikeRunner`: a 1.1 s telegraph (it pulls up, wings beating), a straight dive down to the player's chest, then it rises back to 36 m, out of reach. A GUST in its dive breaks it off |
| `world/build.ts` | the island undersides, rope / hover / fallen bridges, the winch, the windmill |
| `look/render.ts` | an `extend` look: a gradient sky dome with a low gold sun, a procedural cloud sea to the horizon, warm linear fog, and a terrain painter that draws only the island tops (flat-shaded, vertex-coloured) |
| `world/climate.ts` | a `DayCycle` held at golden hour (17.4 h; a day lasts a week) |
| `quest/install.ts` | the one-step quest, its 10-coin reward and its save |
| `audio/cues.ts` | the fan's cues on kit sword voices |

## Budgets

The template's: phone 30 fps (9.6 ms CPU), desktop 60 fps (4.8 ms). No `ceilings`: a new shard has none. See
`budgets.ts`. Draws are small: the planks and tiles are instanced (no multi-draw).

## Look

Procedural and faceted, in the mockup's palette (deep blue zenith, peach horizon, pink-gold clouds, teal fan). The
mockup is painterly-realistic; the shipped look is still to be picked on a look board.

## Tests

- `test/shards/far-reach/contract.test.ts`: boots every stage and unloads clean; hover bridges collide only while
  hovering; the roost and lantern rock are reachable only by hover bridges over a void; the winch raises the bridge and
  pays the quest once; GUST throws only the foes in its cone.

## Open asks

- E364: the build itself, its API gaps and its leftovers (`docs/tasks/asks/E364.md`).
