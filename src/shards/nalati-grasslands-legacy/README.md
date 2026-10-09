# Nalati Grasslands (`nalati-grasslands`)

A high Tian Shan steppe, painted: the braided Kunes river, the nomad camp, the golden bowl of the Sky Grassland and
Snow Lotus Valley in the snow ring. The player tames a steppe horse, hunts from the saddle and breaks two bosses, the
Golden King in his kurgan and the Storm Titan. Third card on the title deck.

## What it declares

| Field | Value |
|---|---|
| `status`, `order` | `earlyAccess`, 3 |
| `style`, `kitLook` | `painterly`, `painterly` |
| `uses` | `dayCycle`, `weather`, `bosses`, `elites`, `spawns`, `quests`, `swim`, `hover`, `explore`, `practice`, `loot`, `feats` |
| `ground` | a terrain from `buildTerrain`, the river as a `basinBody('river', …)` water row, `paths: 'plugin'` |
| `treeCount` | 1,400 spruce |
| `loadout` | bow (held), sabre, spear and the hoverboard; the AR-15 is a loan inside the practice room only |
| `fight` | buffer 120 ms, coyote 100 ms; telegraphed charges |
| `audio` | the steppe bed, its ambience and score; alert music only for hostile creatures |
| `bag` | MAP · GEAR · FINDS · FEATS; no pack; a "Skins" tab title |
| `tiers` | the composer's MSAA: phone 2, desktop 4 |
| `hud` | the minimap's day badge |
| `debugOptions` | the engine rows `clockSpeed`, `balbals`, `ghosts` |
| `assetGlobs`, `ktx2` | `public/assets/nalati/**` and its KTX2, music, SFX and title folders; `ktx2.generated.ts` |

## Its custom code, and why

| Folder / file | What | Why custom |
|---|---|---|
| `weapons/` | its kit: the bow profile, `Sabre`, `Spear`, the Naizagai, the Golden Bow grant; skins | one shard uses them; the bow family itself is kit |
| `ride/` | riding: mount, reins, taming, the horse-name prompt, ride input and HUD | the horse stays in Nalati (13 09#5): its only other user is Nalati's horse playground |
| `combat/` | the Golden King and the Storm Titan, five elites (Aqbars, Kokbori, Qyran, Qara Batyr, Argymaq), balbal warriors, ghost riders, night spawns | its own fights |
| `species/` | horse, sheep, sheepdog, wolf, kokbori, leopard, eagle, balbals, ghost riders, the Golden King | its own creatures |
| `creatures/` | herds, flocks, packs, marmot colonies, the sheep raid | its wildlife AI |
| `world/` | the nomad camp, the summer camp, the kurgan dungeon and field, the bowl, crags, eagle rock, bridge, balbals, smoke, weather and its FX | its world |
| `look/` | the painterly look: painted air and fog, the painted terrain, GPU grass, the panorama sky, zones and tints, its own composer | the painterly style is Nalati's |
| `playground/` | the horse course | it needs the horse |
| `audio/` | the Kazakh score, the steppe ambience, synth fallbacks | its own sound |

Layout debt (grandfathered): about 20 loose top-level files (`adventure.ts`, `bag.ts`, `campPeople*.ts`, `kokpar.ts`,
`quest.ts`, `runtime.ts`, `sound.ts`, `stealth.ts`, `stealth.css`, `weather.ts`, `wet.ts` …) and `ride/`. They move into
the canonical folders at the shard's milestone.

2026-10-01 (Jake, E357 J14 / P22): spear BRACE removed. On foot its touch row is THROW · LOCK (with a target) · DODGE · JUMP; desktop RMB tap throws, RMB hold does nothing, and Space jumps. Thrusts, javelins, the mounted lance and enemy charges keep their tuning. Dodge answers charges.

## Budgets

Phone 30 fps (9.6 ms CPU), desktop 60 fps (4.8 ms). Cold play on 4G within 35.5 s. F2 ceilings for the poses `camp`,
`bridge`, `plains` in `budgetCeilings.ts`; desktop keeps its F2 ceilings until X7 maps desktop GPUs.

## Look

Painterly, no textures: every mesh on the shared painterly material, soft cel bands with painted shadows and a rim, a
painted panorama sky with a day clock, a cloud sea, three zones each in its own colour (the green valley, the golden
bowl, the snow ring). `look/render.ts` is a `replace` look: the whole chain (render pass, bloom on desktop, one grade)
with the composer's MSAA from the tier knob.

## Open asks

- E353: leftovers from the Nalati-finish session (the MAP tab in a playground and others).
- E355: the E323 audit leftovers (the horse-name box and others).
- E301 / E264: the 1.8 GB loading cap and capture bugs.
- E106: the spruce stipple walks the whole map each paint.
- N11: an iPhone reading with Low Power Mode off.
- N13, N14: riding extras and look polish from the Nalati plan.
- E358: convert the non-facade `BatchedMesh` uses, after GAME-NORMALIZATION.

The ask files in `docs/tasks/asks/` are the truth; this list is a pointer.
