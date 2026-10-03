# Round 4, seat B, Sky Reach (Claude, lens: evidence, region by region)

Surface: `art/mockup-council/round-4/README.md` (with its lead ruling: mockup C's stone span is not built and is not
marked down), the five sheets `art/mockup-council/round-4/far-reach-*.jpg`, the full-res frames in
`progress/far-reach/20261003-0009-fb93141c/` (780×1688: every `mock-*`, `h4-crown`, `aerial-spawn`, `clip.mp4` as a
0.5 fps strip), round 3's `progress/far-reach/20261002-2333-b69c79d1/` for before/after, and the five ledger mockups at
full resolution. Method: each mockup scaled to 780×1688; the same region cut from mockup, round 4 and round 3 and set
side by side (sky and isles, the subject band, the foreground and viewmodel, plus 2× zooms of proposal B's knoll, C's
lower right and D's dais). On each patch: the mean RGB, luminance p10 / p50 / p90 (the lit-to-shade spread) and mean
chroma (max−min). Source checks at the captured commit `fb93141c` (`cameras.json`, `layout.ts`, `world/knoll.ts`,
`world/build.ts`, `world/crown.ts`, `world/skyIsles.ts`, `world/dressing.ts`, `weapons/WarFan.ts`, `plugin.ts` `stage`,
`species/stormRoc.ts`, `scripts/shard-progress.mjs`, `src/engine/debug/probe.ts` `pose`). Regions are fractions of the
game frame (x left→right, y top→bottom, HUD included). Marks per dimension: composition and subject (Comp), forms and
silhouettes (Form), materials and detail (Mat), light and colour (Light), density and depth (Depth), hands / weapon /
HUD (Hands).

## Measured (mockup / round 4 / round 3)

| Patch | Mockup | Round 4 | Round 3 | Reading |
|---|---|---|---|---|
| A ground x 0.03–0.38, y 0.68–0.82: mean; chroma | 80,67,39; 42 | 99,85,25; 74 | 103,91,16; 87 | the blue rises (16 → 25) but is still 14 under; chroma still 1.8× the mockup's |
| B ground (same patch) | 88,74,46; 42 | 87,75,30; 57 | 95,85,16; 79 | the value now matches; still yellow-green, blue 30 vs 46 |
| D ground (same patch) | 86,71,42; 44 | 103,88,39; 63 | 109,95,26; 82 | the closest hue; brighter by ~17 |
| D mid-ground x 0.05–0.5, y 0.6–0.67: L p10/p50/p90 | 54/95/174 | 55/114/141 | 61/120/142 | **contrast:** the mockup's backlit grass tips reach L 174, the game's stop at 141; spread 120 vs 85 |
| A sky, whole top x 0–1, y 0.1–0.42: mean; chroma | 200,160,133; 69 | 177,154,136; 46 | 185,158,136; 52 | the game's sky is greyer, a little cooler than round 3 |
| C sky (same patch) | 199,163,138; 61 | 162,147,144; 38 | 166,148,142; 42 | still lavender-grey, the furthest sky from its mockup |
| proposal B sky left x 0–0.35, y 0.15–0.45 | 222,197,172 | 158,132,93 | 169,142,103 | the mockup's pale bright air vs a darker saturated orange; spread 75 vs 151 |
| A under the bridge x 0.25–0.75, y 0.53–0.60 | 147,99,74 | 114,89,64 | 105,84,62 | a little lighter (the textured keel shows under the band), still a wall where the mockup is lit air |
| D sun zone x 0.3–0.75, y 0.4–0.5 | 235,194,148; chroma 87 | 211,181,146; 65 | 208,178,143; 65 | unchanged: the halo is paler and less gold than the mockup's sunset |

## Scores

| Mockup | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **7.0** | 8 / 7 / 6 / 6 / 7 / 7 | 1. **Sky and backlight (x 0–1, y 0.08–0.45):** the overhead isles are lowered (verified: `skyIsles.ts` o1 98 → 72 m, o2 108 → 80 m, a new o3), so three textured isles now hang just over the mill (y 0.2–0.32), the mockup's cluster, and none is cut by the top edge. But the mockup's sun burns at the mill's left (x 0.33, y 0.47) in a gold glow that floods the lower sky and turns the pines and mill into silhouettes; the game's is a soft glow behind the hub, the sky above is blue-lavender (chroma 46 vs 69), and the pines right of the mill are lit saturated green (mean 139,115,71 vs 160,124,103). The house behind the mill is still there (x 0.15–0.35, y 0.3–0.42). 2. **Under and along the bridge (x 0.2–0.8, y 0.5–0.64):** the mockup's deck crosses open, lit air; the game's crosses a wall: the 3.2 m code band (sage, brown root strips) with the textured keel's grey rock showing under it (114,89,64 vs 147,99,74). The deck reads as planks now but its ends are cut facets and the near end a thick slab. 3. **Foreground (y 0.64–0.86):** the mockup's warm gold sward with three lichen boulders at the lower left; the game's dark upright tufts over a flat yellow-olive paint with the white flowers now in loose clusters (better), no rocks, and the lantern at the left post the mockup lacks. The fan is leaned, the gloved hand and tassel right of GUST: close to the mockup's grip at the lower right. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **6.5** | 6 / 6 / 6 / 7 / 6 / 7 | 1. **Sky over the mill (x 0.3–1, y 0.25–0.45):** the mockup has open gold cumulus over a small timber mill. The lowered isles (made for A) now hang as a cluster of four right over the mill and the keeper (x 0.03–0.9, y 0.27–0.42), lower and more central than round 3's: this view moved away from its mockup by the same change that moved A toward its own. 2. **Keeper and stand (x 0.05–0.42, y 0.43–0.62):** the scarf and sash are rust-brown now (verified, `quest/keeper.ts`); the wave and the 9 m chip match. He still stands at the rim with the cloud sea and the windmill isle's rim behind him where the mockup has a grassy rock ridge, and the stand is still the square-bar post with a red-brown board and the lantern on the ground, not the carved lectern with an open book and a hung lantern. 3. **The mill and the meadow (x 0.4–1, y 0.3–0.86):** the large white stone tower, the house and the cyan waterfall pane against the mockup's small dark post-mill on a spur; the meadow is taller and now value-matched (87,75,30 vs 88,74,46), but it is a field of tall pale blades with no rocks, where the mockup has low gold grass, daisies and rocks at the lower left. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **5.0** | 4 / 5 / 5 / 4 / 5 / 7 | 1. **The ground is gone (x 0–0.6, y 0.6–0.86):** the mockup's lower-left third is lit meadow sloping to the bridge, with a rock. In round 4 nothing above the HUD is ground: the near post is large in the centre-left (x 0.28–0.45, y 0.66–0.95) and seen from above, the deck crosses from the left edge, cloud sea under it, and the windmill isle's pale tapered keel fills the lower right behind the fan (x 0.55–0.8, y 0.73–0.88). Cause: the new KNOLL lifted this camera 1.14 m (finding X1). Removing the faceted boulder (verified, `dressing.ts`) took away round 3's crudest surface, but nothing of the mockup's foreground replaced it. 2. **Sky and middle (x 0–1, y 0.05–0.6):** the mockup's warm cumulus banks, one far isle and a big dark-timber mill on a spur filling the middle; the game's lavender-grey sky (chroma 38 vs 61), five textured isles across y 0.33–0.5, a small white mill right of centre with the sun disc beside it. 3. **The fan (x 0.45–1, y 0.55–0.8):** the subject improved most: the leaf now leans to the upper left from a pivot at the lower right, the fingerless glove, bracer and red tassel in view right of GUST (claim verified). It is still about two-thirds of the mockup's size (leaf ~0.42 of the frame's width vs ~0.62) and flat: brown sticks and guards, no riveted metal plates, diamond end caps or worn leaf edge. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-stalk`) | **6.0** | 6 / 6 / 5 / 6 / 5 / 6 | 1. **The Roc and the sun (x 0.1–0.7, y 0.3–0.48):** the Roc is bigger: wingspan x 0.10–0.69 (0.59 of the frame; round 3 0.46; the mockup ~0.96), still a symmetric frontal glide in a gull V, no bank, no talons forward. The sun (x 0.53, y 0.44) sits just below-right of its body in a wide pale halo; "off the sun's line" is partly true, but the mockup's sun is small and low at the left horizon (x 0.25, y 0.48). 2. **The arena (y 0.5–0.7):** the stones now carry carved two-and-a-half-turn spirals (verified, `crown.ts`), the mockup's runes in spirit, but they glow pale cyan where the mockup's are cut. The dais's compass got more contrast in code (verified), yet at this view the dais is a thin far ellipse (x 0.17–0.65, y 0.58–0.61) and the rose does not read; the mockup's dais lies near and large between the camera and the stones (y 0.6–0.66). Between the stones: warm haze, no cloud sea, isles or pines. 3. **The meadow (y 0.6–0.86):** taller and fuller near the camera (verified), but the mid-ground is still dark tufts over flat pale paint, and its lit tips stop at L 141 where the mockup's reach 174 (spread 85 vs 120): no backlit gold. No rocks. The fan covers the lower right quarter, where the mockup shows only a cloth edge. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **5.5** | 5 / 6 / 4 / 4 / 6 / 6 | 1. **The knoll view (x 0–0.75, y 0.68–0.86):** the camera stands on the new KNOLL (verified real: hull collider, walkable), so the lower left has ground again. But what fills it is a faceted grey-green boulder with blotchy tiled moss (x 0–0.33, y 0.74–0.85), three plain brown box rim posts and a green box (x 0.27–0.6, y 0.76–0.82), and a few tall blades: the crudest surfaces in any Sky Reach frame this round. The mockup's lip is a dense lit grass ridge with daisies and a rock. 2. **The bridge and the windmill isle (x 0–1, y 0.2–0.73):** the bridge now runs from the lower left toward the centre (round 3: across, from the left edge), but at a 1.4 m rise it still enters from the frame's edge at eye height, not falling away down the centre as from the mockup's high ridge. The windmill isle's keel now tapers into textured rock and stalactites (verified, a real gain toward the mockup's isles), yet the isle still fills the frame's width with the mill, the house, the cyan pane and five even pines, where the mockup's is a small far spur. 3. **Sky and life (x 0–1, y 0.05–0.45):** the mockup's pale bright air (222,197,172 at the left) with the sun low left of the mill and the sky-manta with its glowing trail beside it; the game's darker orange sky (158,132,93), the sun high right of the mill, no manta. |

**Seat score, Sky Reach: (7.0 + 6.5 + 5.0 + 6.0 + 5.5) / 5 = 6.0** (round 3, this seat: 5.7).

## The builder's claims, checked against the frames

| Claim | Verdict | Evidence |
|---|---|---|
| Meadow graded olive-gold (spawn ~99, 83, 33–40) | **partly** | Same patch: A 99,85,25, B 87,75,30, D 103,88,39. The red and green match the claim, the blue reaches the claimed 33–40 only at the crown; chroma 57–74 vs the mockups' 42–44. |
| Twice the flower drifts, taller tufted grass | **verified** | A x 0.1–0.4, y 0.7–0.8: white flowers in loose clusters; B and D: tall blades to 0.74 m. |
| Fuller crown meadow | **partly** | D near field full; mid-ground (x 0.05–0.5, y 0.6–0.67) still tufts over pale paint. |
| Windmill isle tapers into textured rock and roots, cloud sea round it | **verified from below, not at eye level** | Proposal B and C: a tapered keel with stalactites; aerial-spawn and the clip agree. From the spawn (A) the 3.2 m code band still makes a wall under the deck. |
| Overhead isles lowered round the low sun behind the mill | **verified** | `skyIsles.ts` o1/o2/o3; A y 0.2–0.32. Side effect: B's open sky is lost (above). |
| Fan's real idle hold leaned to the upper left, hand, wrist and tassel clear of GUST | **verified** | `WarFan.ts:14` `HOLD` (roll 0.8, scale 0.4) plus the breath term is the whole idle pose; the identical placement in all five views. The hand overlaps GUST's right rim by a few pixels in A and D only. |
| The near C boulder removed | **verified** | `dressing.ts`: the (4.5, −12.2) stone is gone. |
| Spiral-carved crown stones, a readable dais compass | **spirals verified; compass not readable** at mock-D or h4-crown (the dais is a far ellipse). |
| The Roc wing-to-wing off the sun's line | **partly** | Wing-to-wing 0.59 of the frame; the sun still sits just under its body. |
| The keeper's scarf brown | **verified** | B x 0.1–0.15, y 0.45–0.55. |

## Re-aims, staging and no-shortcut check (ledger 5)

- **The README's camera list is complete for `cameras.json`** (only `mock-proposal-B` changed: blob `eedf0c64` → `5288d3cd`,
  matching `meta.json`). It is not complete for the views: see X1.
- **X1 (should-fix): the knoll moved mock-C's camera 1.14 m up, unlisted, and away from its mockup.** `mock-C` stands at
  (3.2, −11.0), 1.8 m from KNOLL's centre (5, −11; base 4). `probe.ts` `pose` calls `land()`, which drops the player onto
  the floor found from 2.5 m above, so the player stands on the knoll's hull at `knollHeight` = 1.14 m. The frame shows it:
  the near post's top is seen from above at y 0.67 (round 3: y ≈ 0.55, from below), and no ground shows above the HUD.
  Nobody re-aimed it to dodge anything, but the view changed without being named, and the change goes against mockup C's
  meadow foreground. Fix: list effective pose changes in the README (record each `mock-*`'s landed position and y in
  `meta.json` and diff those), and put mock-C back at meadow height: move it off the knoll, or fold the knoll's footprint
  so it ends short of (3.2, −11).
- **The knoll is real walkable ground** (`world/build.ts:126–128`: `ctx.piece` with a `hull` collider over its rings,
  surface grass; 37° at its foot under the 40° climb; the meadow shader raises the blades over it). A player would stand
  there: it is the only rise at the bridge head, right beside the landing (its foot ends at x = 1, the bridge runs on x = 0). No breach. It was built for this view, which the
  ledger allows for real geometry toward the mockup's camera.
- **X2 (should-fix, verification): the Roc's staged point moved, and the README says staging is unchanged.** At round 3
  it was placed 27 m past the dais; `a1ec9cd9f` moved it to (DAIS.x − 3, DAIS.z − 18) (`plugin.ts:234`). That is
  18.2 m from the dais, 5.2 m outside the 13 m circle (`layout.ts:111` `ROC.r`) that phase 0 flies before every stalk,
  and a stalk then flies toward the player, never outward. So the point lies on a real stalk line but 5 m behind where
  that line starts. It does not flatter the frame (a real stalk at the circle's edge is 36 m from the camera instead of
  42 m, so the Roc would be ~14 % bigger), but it is not shown to be reachable. Fix: stage at the circle's far edge on the
  same line (13 m from the dais), which is both reachable and closer to the mockup's wingspan, and name staging changes in
  the round README.
- **The fan is the idle hold a player sees** (above); no `fan-gust` stage in `meta.json`. **No painted stand-in** for a
  reachable place: the knoll, the keels and the isles are meshes; the storm and the cloud sea are sky. **No narrowing:**
  h4-crown shows a real stoop, the aerial and the clip strip show the archipelago unchanged apart from the tapered keels
  and the lowered isles; 0 page errors; phone tier, touch HUD, VITALS hidden at full health and LOCK with a target (E319
  baseline).

## Findings, ranked by score gained

1. **Backlit gold light, everywhere** (A, B, C, proposal B, D; whole frame). The largest gap left is light, not layout:
   the skies are greyer than their mockups (A chroma 46 vs 69, C 38 vs 61), the near ground has no backlit highlights
   (D mid-ground p90 141 vs 174), the pines and mill are front-lit (A pines 139,115,71 vs 160,124,103). Fix: warmer,
   brighter low sky toward the sun (C's lavender upper sky to gold; proposal B's left sky toward its pale bright air);
   shade the camera-facing sides of pines, mill and posts and put a gold rim on their edges; give grass tips a strong
   translucent backlight toward the sun so the meadow gets the mockups' bright tips over dark bases. Keep one sun.
2. **The meadow's finish and hue** (A, B, D, proposal B; y 0.6–0.86). Pull the grass chroma down toward 42–44 (blue up
   to ~40 at A and B, as the crown already is); fill the flat paint between tufts in D's mid-ground; put rough lichen
   rocks where the mockups have them (A: three at the lower left; B: lower left; D: to the bottom edge).
3. **Proposal B's foreground** (x 0–0.75, y 0.68–0.86). Replace the faceted tiled-moss boulder and the brown/green box
   posts in this line with dense meadow over the knoll's lip (the mockup's), and make the knoll tall enough that the
   bridge falls away below the eye on its axis, or move it onto the bridge's axis behind the head (the mockup looks
   straight down the bridge from a ridge).
4. **Mock-C's camera and ground** (X1; x 0–0.6, y 0.6–0.86). Back to meadow height so the lit slope and a rough rock fill
   the lower left and the deck recedes from the post, as the mockup shows. Warm C's sky (finding 1).
5. **The fan's finish** (all five; C most). At the leaned hold, scale it up toward the mockup's size in C (the leaf
   ~0.6 of the frame's width) only if it stays clear of the discs; riveted metal guard plates with diamond end caps, a
   worn leaf edge, the tassel longer.
6. **The crown** (D; y 0.3–0.7). Stage the Roc at its circle's edge (X2) for a bigger bird; the sun off its body toward
   the low left with a tighter gold disc; carved, unlit runes instead of the pale glow; the cloud sea and isles between
   the stones; a nearer view of the dais so the rose reads (or a broader dais).
7. **B's sky and set dressing** (B; x 0–1, y 0.25–0.62). Keep A's lowered cluster but out of B's line of sight (it sits
   behind the keeper in B), so B gets the open cumulus; the carved lectern with an open book and a hung lantern.
8. **The view under the spawn bridge** (A; x 0.2–0.8, y 0.5–0.64). The 3.2 m code band still reads as a wall at eye
   level; thin it under the bridge's line, or narrow the windmill isle's near face, so the cloud sea shows under the deck.

SCORE sky-reach: 6.0
