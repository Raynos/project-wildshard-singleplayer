# Sky Reach (`far-reach`)

Floating grass islands over a sea of cloud at golden hour (Jake's pick **B · Sky Reach**, E364). Rope bridges carry
you on foot; the glowing hover bridges carry only a hoverboard rider, so on foot you fall straight through. Built from
`docs/SHARDS.md`, the template and `docs/ENGINE.md` alone (E357 Z3 round 4).

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `experimental`, 60 |
| `style`, `kitLook` | `skyReach` (its own label), `toon` |
| `ground` | `structures: true`: four islands and their bridges are registry pieces (`world/build.ts`); no terrain |
| `world`, `bounds` | `killY` 6 m (creature death plane); a soft-respawn floor 12 m for a player who falls |
| `horizon`, `boundary` | no ridge rings, the engine's cloud sea; no drawn edge |
| `uses` | `hover`, `quests`, `coins`, `loot` |
| `loadout` | the war fan (held) and the kit hoverboard |
| `species` | `driftRay` (a flyer, `flight.above: 'world'`) |
| `audio` | `ambience: 'none'`, a silent score, kit sword cues; no `preload` (asset-free) |
| `assets` | none: code-built models, an inline SVG card, no KTX2, no asset globs |
| saves | one shard key, `far-reach.rewarded` |

## Its custom code, and why

| File | What |
|---|---|
| `layout.ts` | every coordinate: the islands, the three spans, the winch, the rays' homes; `HOVER_GAP` keeps a hover deck clear of every rim |
| `world/shapes.ts` | flat-shaded vertex-coloured islands (12-gon grass top, violet keel), instanced pines, plank bridges, the windmill, the winch |
| `world/build.ts` | the pieces: island tops (six box strips cover the 12-gon), the rope bridge (deck + rails), the hover bridge (`active` only while `app.player.mode === 'board'`), the fallen bridge (`active` once raised), the windmill, the winch interactable |
| `weapons/WarFan.ts` | the war fan (rung 3, `extends Weapon`): SWING arc slash and the held / HEAVY slash through `blocks.melee`; GUST (touch `verb.1`, key G) gives every creature in a 9 m cone `animal.impulse` away and a 4-point hit |
| `species/driftRay.ts` | the drift ray: species + custom rig (body, head, wings, tail) + `DriftRayBrain` (circle → stalk → hang → dive → rise) with a `sphere` dive strike |
| `quest/install.ts` | *The fallen bridge*: raise it with the winch, cross to the windmill; 10 coins once |
| `look/render.ts` | `extend` look: the clean engine chain, a violet → rose → gold dome with a sun glow, a warm raking key, rose distance fog |
| `plugin.ts` | the hooks, the fan's input context (SWING relabel on `r0`, GUST verb), the winch, the hover-deck glow, the gust ring, the rays |

## Budgets

The template's inputs (phone 30 fps / 9.6 ms, desktop 60 fps / 4.8 ms); `ceilings` are the recorded ones in
`budgetCeilings.ts`.

## Look

Low-poly and flat-shaded: lavender-to-gold sky, sage grass, violet rock keels, dusk-purple pines, a cyan glass hover
bridge. Matches `art/far-reach/round-4-rebuild/board-3aac2db1.jpg` (Jake: the look stands).

## Open asks

- E364: the shard (this rebuild, Z3 round 4); own SFX and a wind bed are a later polish ask.
