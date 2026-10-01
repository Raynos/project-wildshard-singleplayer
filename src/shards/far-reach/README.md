# Sky Reach (`far-reach`)

Floating grass-topped islands above a sea of cloud at golden hour (E364, Jake's pick **B · Sky Reach**). Rope bridges
walk; the glowing **hover bridges carry only a hoverboard rider** (Jake's rule: on foot you fall through). The war fan
SWINGs and GUSTs; a drift ray circles, dives along a lane at you and glides back out of reach. One quest: raise the
fallen bridge to the windmill island. Built from `docs/SHARDS.md`, `src/shards/_template/` and `docs/ENGINE.md` (E357 Z3,
round 3 clean-room rebuild).

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `experimental`, 6 |
| `style`, `kitLook` | `skyReach` (its own label), `toon` |
| `uses` | `quests`, `hover`, `explore`, `coins`, `loot`, `feats` |
| `ground` | `structures: true`: four islands, bridges and props are registry pieces. The `terrain` field is never drawn or collided; it answers placement with the island tops (y 30) and the void |
| `world` | `killY: 10` (creatures below die `out-of-world`); `bounds.floor` 14 soft-respawns a falling player |
| `horizon`, `boundary` | no ridge rings, the engine's cloud sea; no drawn edge |
| `loadout` | the war fan (held) and the kit hoverboard |
| `species` | `driftRay` (flying, `above: 'world'`) |
| `audio` | `ambience: 'none'`, silent score `far.silent`, kit blade voices for the fan's cues |
| `assets` | none: inline SVG card, everything else built in code |
| saves | `far-reach.rewarded` (shard scope) and the quest flags (`far.bridge`, `far.windmill`) |

## Its custom code, and why

| File | What |
|---|---|
| `layout.ts` | every coordinate: islands, bridges (`bridgeEnds` puts a hover deck `HOVER_GAP` clear of each rim), winch, mill, ray orbit |
| `world/islands.ts` | one faceted vertex-colour island mesh (grass top, lip, rock cone) and its walkable hull collider |
| `world/build.ts` | the pieces: islands, rope bridge (deck + rail colliders), hover bridges (`active: () => app.player?.mode === 'board'`), the fallen bridge (`active` once raised), instanced pines and rocks, the windmill, the winch |
| `look/render.ts`, `world/climate.ts` | the `LookStrategy`: a golden-hour gradient dome with a low sun as the backdrop's `clouds`, a fixed key light, rose linear fog via `patchShader`, an empty terrain painter |
| `weapons/WarFan.ts`, `fanModel.ts`, `rows.ts` | rung 3 (`extends Weapon`): SWING via `blocks.melee`, held = heavy; GUST (`far.gust`, verb 1 / G) gives every body in a 50° cone an `impulse` |
| `species/driftRay.ts` | the species (`flight`), a custom rig (`body`, `head`, wings, tail) and `DriftRayBrain`: circle → telegraph hover → `sphere` dive along a `lead` lane → rise |
| `quest/install.ts` | "The fallen bridge": raise it, cross to the windmill; 10 coins once |
| `plugin.ts` | the hooks; the winch lift, the hover-deck glow, the gust ring, the ray's spawn and respawn |

## Budgets

`budgets.ts` keeps the template's inputs and the generated `ceilings` (`budgetCeilings.ts`, measured data, not edited).

## Look

Low-poly, flat-shaded vertex colour (Driftwood-like facets, its own palette): lavender zenith, rose band, peach
horizon, olive grass tops over plum rock, a pale cloud sea. Matches the round-3 board Jake kept
(`art/far-reach/round-3-rebuild/board-b3d04ba7.jpg`); round 4 is `art/far-reach/round-4-rebuild/`.

## Open asks

- E364: Jake's board picks and polish (own SFX and a wind bed; waterfalls off the rims).
