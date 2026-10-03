# Round 3, seat A — Sky Reach

Lens: game art director. Read the frozen ledger, brief, scores, COUNCIL.md, all three round-1 seats and both earlier
`round-2-far-reach` seats. Reviewed the five round-3 comparison sheets, all five original mockups at full resolution,
the five matching game frames, four hero views, both aerials, and the orbit clip sampled at two-second intervals.
Evidence: `progress/far-reach/20261002-2333-b69c79d1/`; source checks use captured commit
`b69c79d16772c61ea6722b9eb109155074413e59`, not subsequent builder edits. Its committed cameras hash to
`eedf0c64bb1131d6087ef1dede155584640ecebc`, matching `meta.json`.

The game depicts the same place, but its finish is visibly rougher. The remaining differences are apparent immediately,
not differences one has to search for. These scores judge the supplied pictures, without credit for effort or progress.
Regions below are fractions of each portrait frame, excluding the sheet's title: x left to right, y top to bottom.

## Scores

| Mockup → game view | Score | Biggest difference 1 | Biggest difference 2 | Biggest difference 3 |
|---|---:|---|---|---|
| `round-11-review/mockup-A-spawn-look.jpg` → `mock-A-spawn-look` | 6.0 | **Sky and light, y 0.08–0.48:** the target's broad, low island cluster hangs directly above the mill, with long roots and golden backlight. The game has two separate high islands, clear pastel sky behind the mill, and evenly readable pale stone and bright pines. The cluster's placement and dramatic light hierarchy remain different. | **Bridge and destination, x 0.15–0.85, y 0.46–0.65:** the axis and wrapped posts are recognizable, but the game deck has thick, repeated triangular edges and weak grain; ropes dip in deep curves without the target's supporting stakes/ties. The wide destination cliff, straight root strips and house behind the mill crowd the target's open cloud gaps. | **Foreground and weapon, y 0.64–0.86:** the target has a varied, dark golden meadow with lichen rocks and daisy clusters. The game shows blunt tufts, conspicuous flat ground and regularly scattered flower dots. Its fan is a broad horizontal spread higher in the picture, with the grip behind GUST; the target's fan sits farther right and lower, with the gloved hand clearly readable. |
| `round-18-council-mockups/mockup-B-quest-start-painterly.jpg` → `mock-B-quest-start` | 6.0 | **Upper half and mill, y 0.10–0.52:** the target has open, substantial gold-edged cumulus and a darker timber mill on a narrow spur. Two high islands dominate the game's sky; its larger pale tower, blue cap, house and cyan ramp make a different silhouette and backdrop. | **Keeper and stand, x 0.08–0.44, y 0.43–0.61:** the textured keeper is recognizable, but the red scarf, stiff raised arm and simpler face/cloth read differently from the target's rust scarf, open waving palm and layered worn clothing. The game's square-bar lectern scarcely presents its book; the target's carved pedestal, readable open pages and hanging lantern form a substantial prop beside him. | **Meadow and fan, y 0.60–0.86:** rocks and varied flower/grass patches in warm side light become a bright field of pointed blades and short tufts. The game's horizontal fan takes more of the central foreground, and its glove remains obscured by the action controls. |
| `round-18-council-mockups/mockup-C-hands-fan-painterly.jpg` → `mock-C-hands-fan` | 5.0 | **Principal subject, x 0.25–1, y 0.49–0.82:** the target fan rises diagonally across the frame from a clearly articulated gloved grip, with worn cloth, metal fittings, a bracer and folded sleeve. The game's idle fan is a low horizontal semicircle clipped at right; its flat brown ribs/guards and small dark grip behind GUST do not reproduce that silhouette or finish. | **Bridge head and foreground, x 0–0.65, y 0.48–0.85:** the target post is at the left margin and the bridge recedes into the centre beneath a diagonal stone span. The game post stands inside the left third; the near deck crosses the frame almost sideways, the stone span is absent, and a large smooth moss cap replaces the target's grassy, rock-strewn verge. | **Sky and mill, y 0.15–0.56:** the target has large warm cumulus banks, a low distant island at right and a dark weathered mill. The game has a lavender open sky, high crisp islands, a white tower and a sun disc to its right. |
| `round-11-review/mockup-D-crown-arena.jpg` → `mock-D-crown-arena` | 5.5* | **Roc, x 0.05–0.95, y 0.20–0.43:** the target's great eagle banks across almost the whole width, with layered flight feathers and talons forward. The game bird is much smaller, frontal and symmetrical beneath the bar; its feet and body contribute little silhouette. Clearing the bar is achieved, but the subject's scale and gesture are still wrong. | **Storm and horizon, y 0–0.58:** the game now has a dark storm, but its pale eye sits below the bar, with a bright central sun directly under the bird. The target has its dark coiling eye above the bar, branching lightning and a low sun at left; floating islands and cloud depth are visible between the stones, rather than mostly warm haze. | **Arena and foreground, y 0.48–0.86:** the target's rough lichen stones, readable carved dais and lush rocky meadow become slim slab silhouettes, bright white glyphs, a thin distant dais and pale bare patches between repeated tufts. The large idle fan covers the right foreground where the target only has a small cloth edge. |
| `round-1-proposals/B-sky-reach.jpg` → `mock-proposal-B` | 5.0 | **Camera and depth, whole frame:** the target stands on a grassy knoll, looking down a centred receding bridge to a smaller isolated mill isle. The game is at the rim beside the bridge: the near deck enters from the left, a huge destination cliff occupies the middle, and almost all the near grassy knoll is out of frame. Visible cloud below the bridge does not make this the target's composition. | **Sky, islands and life, y 0.15–0.64:** the target has a low sun left of the mill, isolated islands at several depths and a conspicuous ray beside the mill. The game's sun is high at right, a house/cliff stack sits behind the tower, overhead land is cropped at the top, and the ray is absent from the matching frame. | **Close finish and weapon, y 0.40–0.86:** the deck's repeating wedge edges and smooth thin ropes are much simpler than the target's weathered boards, stakes and tied rails. The target's textured grassy verge and tilted fan with a clear hand become open cloud and the same horizontal fan/obscured grip used in the other views. |

**Sky Reach seat score: (6.0 + 6.0 + 5.0 + 5.5 + 5.0) / 5 = 5.5.**

*D's number is a visual diagnosis, provisional pending the stalk reachability check below. The mean is not valid
no-shortcut pass evidence until that check is resolved. It is below 8 regardless.*

## README claims and re-aims

| Claim / change | Verification |
|---|---|
| Sagging rope bridges, thin hemp hand ropes, painted deck wood | **Sag and thin ropes verified; finish only partial.** `layout.ts` supplies `ropeSag`; `world/shapes.ts` lays real deck segments along it and builds curved tube rails. `deckWood()` supplies procedural grain and wear, rather than a painted texture map. In A/C/proposal B, the repeated wedge edges and largely uniform board faces still dominate; the rails lack a clear twisted-hemp surface read beside the textured post coils. |
| Textured hero sky isles | **Verified.** `world/skyIsleHd.ts` uses textured instanced meshes; A/B/C show strata, moss and hanging roots. The playable mill isle retains its older broad cliff and strip roots. Better decorative surfaces do not resolve their high placement or the playable island's silhouette. |
| Low sun behind the mill, less fill, more rim | **Implementation verified, target result partial.** `PANO_SUN` is 1.11° heading / 8.64° elevation, `SUN_DIR` derives from it, and `look/light.ts` has reduced bounce and a stronger rim term. A hides the sun near the mill hub; C and proposal B expose it to the right. The pale mill front, pines, ground and posts remain much more evenly lit than the targets' shaded faces and bright gold edges. |
| Olive-gold tufted meadow | **Tufts verified; target colour/finish partial.** The frames contain olive/yellow grass, but blunt repeated tufts and exposed flat ground remain conspicuous. The targets have finer intertwined blades, darker warm bases, flower patches and rocks. D still has large pale gaps. |
| Grass around boulders | **Partial.** Grass skirts the moss-capped foreground rock in C and surrounds rocks in the aerial. The scored A/B/D pictures still lack the targets' foreground rock-and-flower composition; C's large cap reads as a smooth slab. |
| Real idle fan lower right, open face-on, glove visible | **Real idle and face-on leaf verified; glove visibility not achieved.** `WarFan.ts` updates the ordinary `HOLD` with breathing and tassel motion; the stage freeze is removed. The leaf is readable, but the grip is largely behind GUST, with the bracer/sleeve against the right edge. C does not have its target's forward diagonal presentation. |
| Darker storm | **Verified as a dark mass.** D's upper sky is now slate-violet, with a legible spiral. Its bright eye sits too low and the central sun still competes with the bird. |
| Cumulus bank around the crown | **Built and partly visible.** `look/render.ts:44–50` places a bank below the crown deck. D shows lit puffs behind the stones, but not the target's layered cloud sea, distant isles and open depth. |
| B re-aim to 9 m | **Verified:** the frame's tracker reads KEEPER 9 M. It keeps keeper/stand left and mill beyond; no weak region is hidden by this correction. |
| C re-aim near the right post, deck in view | **Deck visibility verified; matching viewpoint remains incomplete.** The large post is now clear, but too far inside the frame, and the near deck runs sideways instead of receding behind the fan. This exposes its weak edges rather than concealing them. |
| Proposal B gets its own rim camera | **Distinct camera verified; matching knoll viewpoint not achieved.** It exposes the drop and the destination keel, but removes the target's substantial grassy foreground. Correct the actual knoll/approach composition; do not accept open cloud as a substitute for that foreground. |
| D pulled back to south rim, Roc clear of bar | **Framing verified, match partial.** All five stones fit and the bird is clear of the bar. The dais is smaller/flatter in projection than the target, and the bird is much too distant. Reachability of the new bird placement is unverified below. |

## Ledger §5: no-shortcut audit

- **Phone and HUD:** the captured recorder specifies 390×844 @3, phone tier and touch; the 780×1688 JPEGs are resized
  exports. Scored frames retain the baseline HUD. Full-health VITALS hiding and current fan/lock icons are established
  baseline behaviour, not grounds to manufacture the older mockup HUD. No HUD restyling or hidden viewmodel was found
  in the scored shots. HUD/viewmodel hiding in the aerial/orbit context captures is separate.
- **Playable geometry:** bridges, posts, mill, keeper, boulders, stones and dais are meshes. Decorative isles are
  textured 3D instances. Sky/cloud paintings and storm billows are distant atmosphere; no new painted substitute for
  a walkable foreground object was found.
- **C's frozen GUST:** resolved. Its camera has no `stage`, `meta.json` lists no fan stage, and the captured source
  removes `stageHold`. The clean idle leaf is now a held play state, so omission of GUST effects is legitimate.
- **Quest at crown:** completing notes, roost, vanes and winch raises the bridge; the boss is separate. Therefore
  QUEST COMPLETE with a live Roc is reachable. `quest-crown` invokes the completion helper and `finishRaise`, and the
  stage is recorded. As the earlier seat noted, the helper sets the roost flag without retiring the roost enemies;
  that remains incomplete whole-world staging outside these scored views, not a newly observed improvement cheat.
- **New D placement needs proof (R3-A-X1, must-fix verification):** README calls the point 27 m beyond the dais
  part of the ordinary stalk line. At the captured commit, `plugin.ts:234` teleports the bird to `DAIS.z - 27`, while
  `layout.ts` defines its circle at the dais with radius 13. `species/stormRoc.ts:69–80` steers circle/rest toward that
  orbit, then stalk toward the player. Extending that line beyond the orbit is not evidence that normal stalking
  visits the new point. The helper also silently returns when not fighting/in phase 0 (`:48`), and the recorder's
  success means only that `stage()` exists: metadata has no post-settle brain/position assertion. `calm: false`
  resolves the earlier cancellation defect, but does not resolve this new location claim. **Fix:** capture an
  ordinary phase-one approach from the circle/perch without teleporting the Roc, and record its live state, phase,
  fighting flag and position at the shot. Alternatively provide an unmodified-play trace reaching this exact
  placement. Until then D is provisional; I have not established that every possible player-induced displacement
  could never put it there, nor certified the staged placement as reachable.
- **Camera provenance:** the README names B/C/proposal/D re-aims, and the committed camera blob matches metadata.
  The remaining C/proposal discrepancies are failures to reproduce the target composition; I found no demonstrated
  camera change hiding a weak bridge surface. Keep these discrepancies open rather than calling the re-aims complete.
- **No narrowing / budgets / shipped identity:** hero views, aerials and the sampled orbit expose the wider route;
  no visual regression elsewhere is evident from this surface, and metadata reports zero page errors. They do not
  exercise the complete quest or combat. This capture has no measured frame-time distribution, total loading/Explorer
  memory or served production build identity. The session's GPU-ceiling commit is narrower evidence than those
  limits. Attach the existing gate/normal-play results and served-build identity before treating this as fully
  verified pass evidence; the 30 fps HUD and 30 fps encoding alone do not establish performance. No excess budget or
  gameplay regression is asserted here.

## Findings ranked by visual return

These continue the earlier open art gaps; no change to the frozen targets is proposed. R3-A-X1 above is the separate
staging verification requirement.

| Rank / ID | Severity | Mockup and region | Concrete fix |
|---|---|---|---|
| 1 / R3-A-SR1 | should-fix | All; light across sky, mill, pines and meadow | Match the targets' value hierarchy in the actual shared look: lower sun relative to the target horizon, shaded camera-facing surfaces, warm edge light and stronger depth separation. Keep the panorama sun and key direction aligned. Reduce the wash from bounce/shade-floor terms where it flattens the mill and plants. Recompose A's decorative island cluster lower behind the mill while leaving B/C's cloud sky open; do not solve this with per-shot visibility. |
| 2 / R3-A-SR2 | should-fix | A/B/C/proposal B bridge approach; A/B/C foreground, D lower half | Finish the dominant close geometry: remove repeated deck wedges, give boards readable grain, end wear, gaps and fastenings, and connect textured hemp rails to real stakes/ties. Replace broad strip-root/cliff transitions with irregular rock lips and hanging roots. Make finer clustered grass/flowers grow around rough lichen rocks as the targets show; remove conspicuous flat caps and bare pale patches without erasing the walkable route. |
| 3 / R3-A-SR3 | should-fix | All lower right; especially C x 0.25–1, y 0.49–0.82 | Repose the playable fan so the gloved grip clears GUST and the whole silhouette reads. C needs a diagonal forward spread, exposed wrist/bracer and long visible tassel. Use a real held charge/inspect pose with an actual input, or capture an existing real action with its effects; never restore a frozen effect-free GUST. Give guards metallic edge/stud detail, ribs lacquer highlights, cloth wear/creases and sleeve folds. |
| 4 / R3-A-SR4 | should-fix | D bird and storm, y 0–0.48 | Capture the Roc nearer during its genuine approach so it spans the target's upper middle beneath the bar. Give the flight pose a bank, articulated hanging talons and separated feather tips. Raise/reframe the storm's dark eye above the bar and preserve the low sun at left through the shared sky geometry/lighting. Keep lightning as a real timed effect. Verify R3-A-X1 before accepting the new frame. |
| 5 / R3-A-SR5 | should-fix | Proposal B whole frame; C x 0–0.65, y 0.45–0.75 | Restore the real grassy knoll before proposal B's entrance, with the bridge receding on its axis to a smaller isolated mill spur and open cloud chasm. Its present cliff-side view is not that camera. For C, put the near post at the left margin and the deck receding into the centre; build the target's diagonal weathered stone span as geometry with collision. Document any further correction before capture. |
| 6 / R3-A-SR6 | should-fix | B keeper/lectern, x 0.08–0.44, y 0.43–0.61; mill in A/B/C | Finish the carved lectern and readable open pages, hang the lantern from it, and give the keeper a relaxed open-palm wave, rust-tan scarf and stronger cloth/leather layering. Weather the mill's pale stone and timber into the target's darker material relationships; reduce the house/cliff stack's intrusion into its silhouette through real layout changes. |
| 7 / R3-A-SR7 | should-fix | D dais, stones and beyond, y 0.48–0.70 | Make the existing compass rose and joints legible on a broader visible dais top; roughen its rim and add the target's lichen/cracks. Give standing stones irregular mass and subdued carved glyphs instead of bright markings on narrow slabs. Open the view between them to the real cloud bank and distant islands, with pines and rocky meadow framing the arena. Do not hide the fan solely for this shot. |
| 8 / R3-A-SR8 | should-fix | Proposal B beside the mill, middle right | The ray exists in the broader capture but is absent from this target view. Align its ordinary flight route and capture timing so a player sees its large gliding silhouette beside the mill at the target depth. Preserve its ordinary motion and any accompanying effects; no pasted silhouette or capture-only placement. |

SCORE sky-reach: 5.5
