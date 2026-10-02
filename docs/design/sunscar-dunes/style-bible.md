# Signal Dunes — style bible: "Last Light"

Jake (2026-10-01, via the lead): shard 5 picks its own art style, derived from its mockup, inside his earlier rule
(realistic dusk; no glass, crystals, mirrors or magic glow). This is that style. The LOOK-LOOP targets for H1–H4 are
painted to it. Source frames: `art/sunscar-dunes/round-2-dunes/C-dusk-signal-fire.jpg` (Jake's pick) and the round-9
targets `art/sunscar-dunes/round-9-review/A–D`.

**One line:** a photograph taken ten minutes after sunset in a sand sea. One low warm light rakes across big smooth
sand forms; everything it misses is lit by a cool sky. The sky is a tall afterglow band under a slate-violet dome.

## Light (the shading model)

| Part | Rule | Where |
|---|---|---|
| Key | a warm sun 10° up, 100° off the spawn view, behind-left of the player (never in the player's face). Colour `(1, 0.64, 0.4)` | `look/render.ts` KEY, `manifest.sky.sun` (az 80°, el 10°) |
| Fill | a cool sky hemisphere `#6c78b0` over a warm sand bounce `#7a4a2c`: shade reads blue-violet, never black | `manifest.sky.hemi*` |
| Dune shadow | baked into the ground per vertex (a march toward the key): a crest shadows the trough behind it at any distance; the shadow takes only the key, the sky fill stays | `look/render.ts` terrain painter (`sunVis`) |
| Rim | a silhouette keeps a thin orange edge on the key side | creatures and props (open) |
| Afterglow | art-directed apart from the key: the band sits behind the tower (−Z) | `look/sky.ts` SUN_GLOW |

The strongest edge in any frame is the crest line between a lit slip face and its shaded windward side.

## Palette (sRGB, the mockup's)

| Region | Colour | Notes |
|---|---|---|
| Lit sand | `#c47a42` → `#e09a58` at the crest | saturated burnt orange, never yellow, never pink |
| Shaded sand | `#4a3a48` → `#5b4f6a` | cool violet-brown |
| Trough / hollow | `#33283a` | the darkest ground; still has colour |
| Afterglow band | `#ff8a3a` at the glow, `#b8604a` away from it | 2–3× taller than a thin line |
| Mid sky | `#7a5a6a` → `#4d4560` | dusty mauve into greyed violet |
| Zenith | `#26263f` | slate indigo, a few stars |
| Far dune rows | violet layers `#5b4a68`, lighter with distance | aerial perspective, never pink fog |

## Forms and edges

- **Dunes:** crescent dunes 6–12 m tall, 64 m apart, crests bowed and wandering, never parallel stripes. A gentle
  windward face and a 28–32° slip face that turns toward the key. Crests are sharp (a knife edge), troughs soft.
- **Scale:** the spawn stands on a crest; the first frame looks down a slip face over the dune rows to the tower.
- **Props:** weathered wood, rope, canvas, iron, sandstone. Edges worn round; nothing pristine.

## Materials

- **Sand:** albedo by height (pale fine crests, darker coarse troughs), wind ripples (~0.55 m) as light and shadow in
  the normal across the wind, a fine grain near the camera. Ripples fade by 24 m so they never alias.
- **Wood / leather:** warm brown with a readable grain; leather reads brown under the cool fill, never black.
- **No emissive except fire.** Nothing glows on its own except flame and its embers.

## Sky

A tall band, thin under-lit cloud streaks over the band side (pink-orange bellies, slate tops), a greyed violet upper
sky and the first stars. No sun disc, no halo (the sun has set), no planet.

## FX

- **Fire:** layered flame, embers blown downwind, a smoke column into the sky, a warm light pool on the sand. A lit
  waymark reads at 60 m; the signal fire is the brightest thing in the level.
- **Sand storm:** blown-sand streak sheets crossing the view, a ground-hugging drift, the band dimmed, gusts that
  pulse. It reads as a storm in a still frame.

## Banned

Glass, crystals, mirrors, glowing runes or magic glow; neon; a sun disc; pink fog; black silhouettes; pure-white sand;
toon outlines or flat cel shading; parallel washboard stripes.
