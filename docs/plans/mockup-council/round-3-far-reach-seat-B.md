# Round 3, seat B, Sky Reach (Claude, lens: evidence, region by region)

Surface: `art/mockup-council/round-3/README.md`, the five sheets `art/mockup-council/round-3/far-reach-*.jpg`, the full-res
frames in `progress/far-reach/20261002-2333-b69c79d1/` (780×1688: every `mock-*`, the four hero views, both aerials, a
strip of `clip.mp4` at 0.5 fps), round 2's `progress/far-reach/20261002-2249-1b278da3/` for before/after, and the five
ledger mockups at full resolution. Method: each mockup scaled to 780×1688, then the same region cut from mockup, round 3
and round 2 and set side by side (sky and isles, the subject band, the foreground and viewmodel, plus full-res zooms of
proposal B's deck and C's foreground). Mean colours were measured on the same patches. Source checks are at the capture's
commit `b69c79d16` (`cameras.json`, `layout.ts`, `weapons/WarFan.ts`, `plugin.ts` `stage`, `species/stormRoc.ts`).
Regions are fractions of the frame (x left→right, y top→bottom). Per-dimension marks: composition and subject (Comp),
forms and silhouettes (Form), materials and detail (Mat), light and colour (Light), density and depth (Depth), hands /
weapon / HUD (Hands).

## Measured colour (R,G,B means; mockup / round 3 / round 2)

| Patch | Mockup | Round 3 | Round 2 | Reading |
|---|---|---|---|---|
| A ground x 0.03–0.38, y 0.68–0.82 | 80,67,39 | 103,91,16 | 113,102,18 | darker, but blue still 16 against 39: saturated yellow-green, not olive-gold |
| B ground (same patch) | 88,74,46 | 95,85,16 | 113,104,21 | the same: closer in value, wrong in hue |
| D ground (same patch) | 86,71,42 | 109,95,26 | 132,120,65 | the bare pale soil of round 2 mostly covered; still saturated |
| D sky, top band y 0.03–0.15 | 69,69,79 | 65,60,75 | 89,79,88 | **the darker storm lands**: now within a few points of the mockup |
| D sky, y 0.15–0.30 | 127,101,99 | 126,103,110 | 139,111,103 | matches |
| C sky x 0.18–0.82, y 0.17–0.33 | 202,163,141 | 170,153,150 | 162,145,133 | still lavender-grey where the mockup is warm gold |
| proposal B sky (same patch) | 206,191,182 | 170,143,110 | 187,154,119 | more saturated orange than the mockup's pale open sky |
| A under the bridge x 0.25–0.75, y 0.53–0.60 | 147,99,74 | 105,84,62 | 118,92,65 | the mockup's lit cliff and cloud vs the game's darker grey-green wall |
| proposal B lower left x 0–0.6, y 0.62–0.82 | 92,82,54 (grass knoll) | 188,159,145 (cloud sea) | 108,98,12 | the new camera has no ground under the lower half |

## Scores

| Mockup | Score | Comp / Form / Mat / Light / Depth / Hands | The three biggest differences (region) |
|---|---|---|---|
| `round-11-review/mockup-A-spawn-look` (mock-A-spawn-look) | **6.5** | 7 / 7 / 6 / 6 / 6 / 7 | 1. **The air under and past the bridge (x 0.2–0.8, y 0.5–0.62):** the mockup's bridge crosses open air with the cloud sea and the far isle's lit keel under it; the game's crosses in front of the windmill isle's near cliff, a dark grey-green wall with root strips (measured 105,84,62 against 147,99,74). The hand ropes now sag as thin hemp lines (claim verified), but the deck is still read as one solid slab: chunky planks with cut facet ends and a dark beam under them, with no gaps. 2. **Isles and backlight (x 0–1, y 0.08–0.45):** the isles are now textured (strata rock, turf, trailing roots, falls: verified) and the sun sits behind the mill's cap (verified). But the isles still hang at the top edge (y 0.08–0.25) and the right edge, where the mockup's cluster hangs low over and behind the mill (y 0.27–0.40). Behind the mill the game still has a house and a stacked cliff (x 0.15–0.45, y 0.33–0.45); the mockup has only sky and the isle cluster, so its mill and pines read as silhouettes, the game's as lit objects. 3. **Foreground (y 0.64–0.86):** the mockup's darker gold backlit grass with three lichen boulders at the lower left and daisy clusters; the game's tufted but saturated yellow-green sward (measured above), single scattered white dots, no rocks, and a glowing lantern at the left post that the mockup lacks. The fan now sits lower right, open, the glove and tooled bracer at its base (verified); it is a little higher and further right than the mockup's, the hand half under GUST. |
| `round-18-council-mockups/mockup-B-quest-start-painterly` (mock-B-quest-start) | **6.5** | 7 / 6 / 6 / 6 / 6 / 7 | 1. **Sky (y 0.05–0.45):** the mockup is open cumulus with the sun off the right edge and no isles. The game hangs two textured isles across the top third (x 0.3–0.95, y 0.1–0.25), a cliff isle at the left edge (y 0.33–0.4), and the sun behind the mill. 2. **Behind the keeper (x 0–0.3, y 0.45–0.6):** the 9 m re-aim lands (the chip reads "KEEPER 9 M"; the keeper is now 0.16 of the frame high against the mockup's 0.20), and he now raises his arm. But he stands at the isle's rim with the flat lavender cloud sea behind him; the mockup's keeper stands in the meadow with a rocky grass ridge behind. His scarf is still bright red (the mockup's is rust-tan). 3. **The stand and the middle (x 0.3–0.8, y 0.42–0.6):** the mockup's low carved lectern with a legible open book and a lantern hung from it, and a small dark-timber mill on a narrow spur; the game's tall square-bar stand with a red-brown board, a lantern on the ground, and a large white stone mill with a house and a cliff beside it. The meadow has no rocks (the mockup has several in the lower left). |
| `round-18-council-mockups/mockup-C-hands-fan-painterly` (mock-C-hands-fan) | **5.0** | 5 / 5 / 4 / 5 / 5 / 5 | 1. **The foreground (x 0.1–1, y 0.72–0.86):** a large low-poly boulder fills the lower sixth: flat facets, a tiled moss texture with visible repeating round blotches, a hard straight ridge. Nothing in the mockup matches it (its foreground is lit grass sloping down to the bridge, rocks only at the bottom left). This is the crudest surface in any Sky Reach frame this round. 2. **The bridge and the stone span (x 0–0.5, y 0.45–0.7):** the near post is now big (x 0.25–0.4, y 0.5–0.75; the mockup's is x 0.06–0.2, y 0.47–0.63), but the deck is seen side-on, running off to the left, where the mockup's recedes from the post toward the mill under a weathered stone span crossing x 0.05–0.9, y 0.45–0.55. The span is still not built (open since round 1). At the left a cloud sea with two vertical white fall-streaks stands where the mockup has more meadow. 3. **Fan and sky (x 0.45–1, y 0.1–0.75):** the fan is in the real idle hold (the `fan-gust` freeze is gone: correct by the ledger), so it is the same small open fan at the right, not the mockup's large diagonal sweep across the centre with the hand clear above GUST; here the hand is almost all under GUST. The sky is lavender-grey (170,153,150 against 202,163,141) with two isles at y 0.15–0.3 and a white sun disc right of the mill, where the mockup has warm gold cumulus, one far isle and no visible sun. |
| `round-11-review/mockup-D-crown-arena` (mock-D-crown-arena, staged `roc-stalk`) | **5.5** | 6 / 5 / 4 / 6 / 4 / 6 | 1. **The Roc (x 0.27–0.72, y 0.38–0.46):** it now flies under the bar (verified). But its wingspan is about 0.45 of the frame, against the mockup's ~0.95, and it glides level and frontal, wings in a shallow V, where the mockup's banks across the upper middle with its head turned, talons thrown forward and every barred primary spread. 2. **Sun and horizon (x 0.2–0.8, y 0.38–0.55):** the storm is now dark at the top (measured: matches the mockup within a few points) with a centred spiral and branching bolts. Under it, the sun sits dead centre right behind the Roc with a wide pale bloom (x 0.3–0.65); the mockup's is small and low at the left (x 0.25, y 0.48). Between and behind the stones the game is a flat warm haze with cumulus only at the frame edges; the mockup has a cloud sea, five floating isles and pines there (the "cumulus bank" claim: partly). 3. **The arena (y 0.5–0.86):** the mockup's large near dais with a carved compass rose (x 0.18–0.88, y 0.6–0.66), rough lichen stones with carved spiral runes, rocks, daisies and lush grass to the bottom edge. The game's dais is a plain, thin far ellipse (x 0.15–0.55, y 0.6) among the stones; the stones are smooth streaked slabs with glowing white glyph decals; the ground is sparse upright blades with pale bare patches (x 0.1–0.6, y 0.62–0.7) and no rocks. The bunting matches. |
| `round-1-proposals/B-sky-reach` (mock-proposal-B) | **5.0** | 4 / 5 / 5 / 5 / 5 / 6 | 1. **Camera (whole frame):** the new camera finally shows the drop: a rope bridge over open cloud sea to an isle with a deep rock keel. But the mockup stands on a grassy knoll (lower left third grass, measured 92,82,54) and looks *down the bridge's axis*, a long narrow bridge falling away to a small, far isle. The game stands at the rim right of the bridge and looks *across* it: a short, wide deck runs in from the left edge (x 0–0.55, y 0.45–0.6) to a near isle that fills the centre (x 0.1–1, y 0.25–0.62), and the lower half (y 0.55–0.86) is cloud with no ground. 2. **Sky and life (y 0.05–0.45):** the mockup's pale open sky with isolated isles at many depths, waterfalls, and the sky-manta with its glowing trail beside the mill; the game's one isle cut by the top-left corner, a large near mill with a house, a white sun right of it, no manta, the sky more saturated orange (170,143,110 against 206,191,182). 3. **Bridge and keel finish (x 0–0.8, y 0.45–0.65):** the mockup's narrow slatted deck with gaps, posts and rope lines; the game's planks are thick blocks with faceted ends over a solid dark beam, no gaps. The keel is a smooth grey rock with evenly spaced vertical green strips hanging from the rim, and a pale-green translucent quad sits on it at the crosshair (x 0.46–0.65, y 0.49–0.52). The fan sits lower right with the glove (the mockup's is lower centre-right in a bare hand with wind curls). |

**Seat score, Sky Reach: (6.5 + 6.5 + 5.0 + 5.5 + 5.0) / 5 = 5.7** (round 2, this seat: 5.1).

## The builder's claims, checked against the frames

| Claim | Verdict | Evidence |
|---|---|---|
| Rope bridges hang in a sag with thin hemp hand ropes | **verified** | A x 0.2–0.8, y 0.48–0.62: the hand ropes droop between posts as thin dark lines; proposal B's deck dips along its span. |
| Painted deck wood | **partly** | A, C, proposal B: a tone per plank and faint grain; but the plank ends are cut facets, the deck sits on a solid dark beam with no gaps (proposal B zoom, x 0–0.55, y 0.45–0.6), so it still reads as a thick block deck, not the mockups' worn slats. |
| Textured hero sky isles | **verified** | A, B, C top: sandy strata rock, turf over the rim, trailing roots and moss, falls. Their placement (top edge) is the problem now, not their finish. |
| A low sun just behind the mill, less fill, more rim | **partly** | A: the sun sits at the mill's cap (verified). The mill tower measures 142,114,86 against the mockup's 152,124,110, so it is not darker than the mockup; the house and the cliff behind the mill take the backlight, and the sward reads front-lit yellow. B also gets the sun behind the mill where its mockup has it off the right edge, and C gets a white disc its mockup lacks (one sun cannot match all three; noted, not a finding). |
| An olive-gold tufted meadow | **tufts verified, colour not** | Tufts read in A and B. Colour: darker than round 2 but blue 16 against the mockups' 39–46 (table above): still saturated yellow-green. |
| Grass round the boulders | **not checkable / not shown** | No boulder stands in A, B or proposal B (A's mockup has three at the lower left). The one boulder in a scored frame (C) is the crude faceted slab above. |
| The fan's real idle hold lower right, open face-on, the glove visible | **verified hold, glove partly** | `WarFan.ts:14` `HOLD` plus the breath term in `update` (`:148–149`) is all the idle pose does; the frame is that pose in all five views (identical placement), so it is what a player sees. The glove and the tooled bracer show right of GUST in A, B and proposal B; in C the hand is almost wholly under GUST. |
| A darker storm | **verified** | D top band 65,60,75 against the mockup's 69,69,79 (round 2: 89,79,88). |
| A cumulus bank round the crown | **partly** | D: cumulus at the frame edges (x 0–0.15 and 0.85–1, y 0.4–0.5); between the stones a flat warm haze, no cloud sea, no isles. |

## Re-aims and no-shortcut check (ledger 5)

- **`mock-B-quest-start` 9 m from the keeper: toward the mockup.** The tracker reads "KEEPER 9 M" as the mockup's does;
  the keeper's size is now 0.8× the mockup's.
- **`mock-C-hands-fan` ~5 m from the right post: toward the mockup** in the post's scale (now a little larger than the
  mockup's), and it shows the deck. It does not dodge a weak area: it puts the crudest surface in the shard (the faceted
  boulder) in the lower sixth. The deck is seen side-on, not receding as in the mockup (finding 3).
- **`mock-proposal-B`'s own camera: reachable and toward the mockup.** (4.0, −14.6) is 15.1 m from Sunrest's centre,
  inside the 12-gon's 16.4 m apothem (`layout.ts:21`, r 17), so the player stands on the deck at the rim; the capture
  recorded no fall (`meta.json` `pageErrors: []`). It shows the drop and the chasm for the first time, but looks across
  the bridge where the mockup looks down its axis from a knoll.
- **`mock-D-crown-arena` pulled back to z −172.5: acceptable.** It brings the stones to the mockup's scale (0.09 of the
  frame high against 0.105), and the bare ground it adds is a weak area shown, not hidden. The cost is a far, thin dais:
  in the mockup the dais lies between the camera and the stones. That is a layout difference (finding 4), not a camera
  one.
- **`roc-stalk`: reachable.** `plugin.ts:234` calls `stageStalk` (`stormRoc.ts:47`), which returns unless the fight is
  on and in phase 0, then puts the Roc into its `stalk` state at its circle height, 27 m past the dais, facing the
  entrance: a point every first-phase stalk flies. `calm: false`, and the forced strike is one the storm throws every
  3.5–8 s. The glide pose is the stalk's real pose.
- **The `fan-gust` freeze is gone** (`meta.json` `staged` has only `h4-crown` and `mock-D-crown-arena`). Ruling applied.
- **Painted only at infinity: no breach.** The isles are meshes with keels; the storm and the cloud sea are sky. The
  pale-green quad on the windmill isle's keel in proposal B (x 0.46–0.65, y 0.49–0.52) is a visual flaw, not a stand-in.
- **No narrowing:** h1–h4 and both aerials match round 2 apart from the textured isles; the clip strip shows the whole
  archipelago unchanged. Phone tier, touch HUD, 0 page errors. VITALS hidden at full health and the LOCK disc with a
  target are the E319 baseline HUD, not a breach.

## Findings, ranked by score gained

1. **Open the air under the spawn bridge, and give the isles their mockup place** (A, proposal B, B; x 0.2–0.8,
   y 0.08–0.62). The two largest regions that still differ in A are both sky: the cliff wall under the bridge and the
   isles pinned to the top edge. Fix: drop the windmill isle's near cliff below the deck's sightline (or move the mill
   back onto the narrower spur mockups B and C show), so the cloud sea shows under the deck at eye level. Hang the
   textured isle cluster lower, over and behind the mill (A: y 0.27–0.40), which also clears B's and C's open-cumulus
   skies. Remove the house and the cliff stack directly behind the mill in A's line of sight, so the mill and pines are
   backlit silhouettes against the low sun.
2. **The meadow's hue, rocks and flowers** (A, B, D, proposal B; y 0.64–0.86). Darker this round, but the blue channel
   is still 16 against the mockups' 39–46. Fix: desaturate the grass toward olive-gold (raise blue, lower green), gold
   only on the sun-facing tips; cluster the daisies; place the lichen boulders where the mockups put them (A: three at the
   lower left; B: several in the lower left; D: rocks to the bottom edge). Cover D's pale bare patches
   (x 0.1–0.6, y 0.62–0.7) with the same sward.
3. **C's foreground and bridge** (C; x 0–1, y 0.45–0.86). Replace the faceted, tiled-moss boulder in front of the
   camera with lit sloping meadow (the mockup's), or move it out of this line. Build the weathered stone span across the
   bridge head (x 0.05–0.9, y 0.45–0.55), open since round 1, as real geometry. Then aim C so the deck recedes from the
   near post toward the mill, as the mockup shows, not side-on.
4. **The crown: Roc, sun and dais** (D; y 0.35–0.7). Stage the frame a moment later on the same real stalk so the Roc is
   nearer and larger (the mockup's spans ~0.95 of the frame; the game's 0.45), banking, talons forward. Move the sun off
   the frame centre toward the mockup's low left and take the wide bloom off it, so the Roc is not a dark shape on a
   white disc. Make the dais the near, large, carved disc of the mockup (compass rose, moss) between the camera's rim and
   the stones; rough the stones' silhouettes and carve the runes instead of glowing decals. Let the cloud sea and isles
   show between the stones.
5. **The deck's finish** (A, C, proposal B; the bridge). Thinner planks with gaps, open slats with sky through them,
   no solid beam under the whole deck, rounded worn plank ends instead of facet cuts. Remove or fade the pale-green quad
   on the windmill isle's keel (proposal B, x 0.46–0.65, y 0.49–0.52), and break up the evenly spaced vertical green
   strips under the rim into the mockup's irregular roots.
6. **Proposal B's camera** (whole frame). Stand on Sunrest's highest grass behind the bridge head and look down the
   bridge's axis (the mockup has grass in its lower left third and the bridge receding to a small far isle), not across
   it from the rim's side.
7. **B's keeper and stand** (B; x 0–0.6, y 0.42–0.68). Move the keeper a few metres inland so meadow, not the cloud sea,
   is behind him; the rust-tan scarf; a low carved lectern with an open book and the lantern hung from it.
8. **C's sky** (C; y 0.05–0.45). Still lavender-grey (170,153,150 against 202,163,141). Warm the sky in this direction
   toward the gold cumulus the mockup shows.

SCORE sky-reach: 5.7
