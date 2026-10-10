# Driftwood Isle (`driftwood-isle`)

A small low-poly island in a bright ocean, in the spirit of Wind Waker: a pier, a moored sailboat, a hut on the
plateau, a ring shrine in the jungle and a wreck in the cove. The player hunts island boar with a wooden sword. It is
the first card on the title deck and the default shard.

## What it declares

| Field | Value |
|---|---|
| `status`, `order`, `next` | `live`, 1, `nalati-grasslands` |
| `style`, `kitLook` | `toon`, `toon` |
| `uses` | `dayCycle` |
| `ground` | a terrain from `buildTerrain`, the sea as a `swellBody('sea', …)` water row, `paths: 'plugin'` |
| `loadout` | the wooden sword and the hoverboard at the start; the iron sword is a pickup on the wreck's deck |
| `fight` | every hit capped at 20 except the Drowned Captain's; two attackers at once; buffer 120 ms, coyote 100 ms |
| `loot`, `bodyShadow` | coins on kills (doubloons); the castaway's body shadow |
| `tiers` | phone: depth slices, no god rays offscreen or at all, FXAA |
| `assetGlobs` | its Blender, CC0, first-person and hero model folders (and their KTX2 mirrors) |
| `ktx2` | `ktx2.generated.ts` |

## Its custom code, and why

Everything here is used by Driftwood alone, so it stays in the shard (the rule of two).

| Folder | What | Why custom |
|---|---|---|
| `world/` | the island: ocean, pier, boat, hut, lookout, shrine, wreck, palms, bushes, boulders, cove, rope bridge, zipline, waterfall, gulls; the island rock kit | its own low-poly modules; no other shard builds an island |
| `species/` | reef crab, coconut monkey, drowned sailor, the Drowned Captain, each a `CreatureBrain`; the toon palettes (`toonPaints.ts`) | the island's own creatures |
| `combat/` | the Drowned Captain (`extends BossBrain`) and the island's strikes | its one boss |
| `creatures/` | the enemy tables and installer | the island's spawns |
| `quest/` | the castaway spine: Wendell, the three shards, the altar, the finale, the trader stall, feats | its own adventure |
| `npc/` | the Castaway and the Trader, with their pivoted models and idle motion | their poses don't fit the kit NPC rig (B39) |
| `loot/` | keepsakes, perks, finds, the shop | its own loot rules (E314) |
| `look/` | the toon look: light model, colour-ramp fog, stylized sky and day keys, ground colour, terrain painter | the toon style is Driftwood's |
| `audio/` | island ambience, score, SFX, the shrine hum, surface steps | its own sound |
| `weapons/`, `loadout/` | the iron sword row and the wood / iron sword loadout | the kit `Sword` with Driftwood's profiles and arms |
| `onboarding/` | the first minutes | the first shard a player meets |

Layout debt (grandfathered in `lint/shard-layout.json`): `fpArms.ts`, `tiers.ts` (the island's tier knobs, B44),
`loot/`, `onboarding/`.

## Budgets

The captain's hat, sea-glass chime, sailcloth cape and boat's three meshes are lossless offline GLBs. Their original builders live in `generators/`;
`boot/fixedGeometry.ts` loads their geometry before placement, while the model controllers keep the original toon
materials, wind and collectible slots. Rebuild with
`node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/driftwood-isle/generators/bake-driftwood-fixed-models.mjs`.
Add `--check` to compare the committed GLBs and slot rows without writing; `scripts/bake-check.mjs` runs this check.

Phone 30 fps (9.6 ms CPU), desktop 60 fps (4.8 ms). Cold play on 4G within 30 s. F2 ceilings for the poses `pier`,
`beach`, `wreck` in `budgetCeilings.ts`.

## Look

Faceted low-poly toon, no textures: flat-shaded vertex colours, a two-band toon ramp with coloured shadows and a rim,
a stylized gradient sky with faceted clouds, a colour-ramp fog, the learned LUT, a painted horizon. `look/render.ts` is
an `extend` look on the clean chain. Driftwood stays low-poly: never photoreal.

## Open asks

- E351: polish leftovers for Jake's eye (the sea glass chime, the E314 / E334 look review).
- E166: contact-hardening shadows, needs a pick.
- D38: the day / night clock leftovers (the drowned sailor at night).
- E358: convert the remaining non-facade `BatchedMesh` uses (after GAME-NORMALIZATION).

The ask files in `docs/tasks/asks/` are the truth; this list is a pointer.
