# Bloomthroat Iguana: independent first complete source review

2026-10-19. Candidate: frozen `v3 + fit_core.py`, DI-N10. Scope: source likeness only. **2.245/5 exact weighted total; not likeness acceptance, not 4/5, not gameplay admission.** This is a recognizable first complete reconstruction with substantial form and detail work remaining.

## Blind scoring

Scores were fixed and reported before reading the builder README, construction commentary or prior opinions. The unchanged rubric evaluates the complete character against the approved hero, with the two AI nine-angle sheets supporting approximate unseen anatomy only.

| Category | Weight | Score /5 | Contribution |
| --- | ---: | ---: | ---: |
| Silhouette | 35% | 2.3 | 0.805 |
| Face | 30% | 2.0 | 0.600 |
| Details | 20% | 2.1 | 0.420 |
| Facet/style | 15% | 2.8 | 0.420 |
| **Total** | **100%** | **2.245** | **2.245** |

No rounding to an acceptance threshold. This is an independent current-candidate score, not a calibrated numerical improvement over an earlier version that was not scored here.

## Judgment and meaningful corrections needed

- **Silhouette:** The four-legged gold body, curled teal/gold tail and hanging pink throat establish the identity. The tall oval neck is visibly a separate pillar behind a small blunt head, rather than the hero's continuous rising chest and broad reptilian head. Front legs read like straight segmented supports; the target has broad, muscular planted forequarters. Rebuild neck, shoulder and skull transitions together, with the silhouette checked from both sides and the front. Broaden the terminal tail into the hero's leaf-like paddle while retaining its curled arc. The current tip is a narrow blunt tube.
- **Face:** Amber eyes, nostrils and mouth are present. Eyes are small and peripheral beneath knob-like brows; front view reads as a blunt smiling toy rather than the hero's alert iguana. The muzzle/lower jaw look like stacked pieces with a deep dark seam. Integrate the cheek and eye socket into the skull, enlarge the readable amber eye and sculpt the angular brow/muzzle relationship; keep the gold face rather than compensating with more teal decoration.
- **Details:** The throat's pink identity is strong, but its shallow, regular accordion pleats and dark purple undersides differ sharply from the broad overlapping coral/pink petal masses in the hero. Build broader irregular petal volumes with staggered ends and a warmer coral range. Cheeks are a rectangular grid of similarly sized beads rather than overlapping varied plates; shoulder and wrist teal coverage is much smaller than the target. The sparse tiny dorsal triangles do not reproduce the chunky alternating gold/teal crest, and several appear to float above the back in true side views. Anchor and reshape the crest against the body surface, not merely increase its count. Feet are readable, but their thin gold fingers and tiny dark tips lack the target's stout dark claws.
- **Facet/style:** Flat polygonal shading and the main gold/teal/pink palette belong to the intended direction. Large regular body facets, uniformly repeated cheek beads and triangular color confetti on the tail are too procedural-looking relative to the hero's purposeful plane changes. Shape planes around anatomical volumes and use larger coherent color regions. Render grain and the much smaller subject footprint reduce fine-detail certainty; they do not explain away the broad shape mismatches.

## Ten individual original captures inspected

Each raw PNG in the source render set was opened individually through the image viewer at original detail (600 × 720), not judged only from the paired board. No crop, redraw or rerender was used. The approved hero and the original world and Explorer sheets were also opened at their original 1536 × 1024 image size. The board was inspected afterward for provenance and matching.

1. **Hero:** Complete tail and feet are in frame; correct general right-facing three-quarter presentation. Pillar neck, blunt skull, bead cheeks and accordion throat are readily visible. Foreground feet are weak relative to the target.
2. **Front:** Bilateral limbs, two eyes, nostrils and throat are visible. Broad stance is useful; central chest is small/dark, eyes drift to the outer edges and the mouth seam dominates. Tail curls on screen-right, unlike the generated front reference. That alone is not authoritative hidden-side failure.
3. **Left (observer azimuth −90°):** Head faces screen-right. Profile exposes the high segmented neck, suspended-looking central dorsal triangles, thin throat and tubular tail tip. Full silhouette remains in frame.
4. **Right (observer azimuth +90°):** Head faces screen-left. Confirms those profile problems on the other side; teal crest triangles are especially visible against the dark backdrop. Jaw and dewlap have real side thickness, but inadequate broad petal form.
5. **Back:** Rear legs and curled tail visible; tail masks some torso and feet naturally. Sparse narrow centerline crest and plain shoulder/neck back differ from the supporting sheet's broader layered ridge. No claim that obscured surfaces are absent.
6. **Top:** Four limbs and tail path visible; reveals a narrow ridge, large bare golden areas and very regular separate body masses. Head points down the image, whereas the world target points left and Explorer target right; no pixel alignment assumed.
7. **Elevated front:** Four feet discernible, with a much steeper look-down than the target hero-like elevated-front panels. Rounded skull, tiny peripheral eyes, small teal patches and short pleated bloom remain evident. Foreshortening is not scored as missing anatomy.
8. **Elevated left:** Head faces screen-right; separate neck/body assembly and thin feet conspicuous. Tail curl and underlying four-leg structure remain coherent.
9. **Elevated right:** Head faces screen-left; opposite-side cheeks, small wrist markings and oversized plain neck repeat the same issues. Tail is naturally foreshortened, not clipped.
10. **Elevated back:** Full curled tail, four-limb arrangement and back/head masses visible. Narrow dorsal line and weak transition between neck and torso persist. This is useful hidden-surface evidence, not proof of target-exact hidden anatomy.

## Direction, framing and source provenance

Camera source and records agree: hero azimuth −48°, elevation 12°; front/back 0°/180°, side views −90°/+90°; top elevation 89.9°; elevated set elevation 39°; orthographic scale 5.3. The camera offset is `(8 sin(az) cos(el), −8 cos(az) cos(el), 8 sin(el))` around the Blender target. Inspection confirms that raw left/right refer to observer azimuth, not the direction the animal faces on screen.

The comparison generator deliberately pairs raw `right` under target LEFT and raw `left` under target RIGHT, likewise for elevated sides. The viewed world board follows this mapping and discloses facing-direction matching. This is not evidence of mirrored geometry or incorrectly paired visible facing. Its nested source labels can still confuse a reader. Top in-plane orientation, elevated angle and subject scale are not matched; these sheets are qualitative comparisons, not calibrated projection overlays. The source subject occupies much less of its panel than the reference, so the individual full-resolution PNG inspection was essential.

`pin-verification.json` records fresh SHA256 checks: **all 70 files in checkpoint-final match**, all **10 raw captures match capture-provenance**, and the approved hero matches its reference pin. World/Explorer reference hashes are recorded too. Checkpoint SHA256: `d67e4cc30fa3399c311753d4cb00e9ba6c09cf4174facf4a40fd29ca1b54c71b`. Pins establish file identity and reproducible provenance records; this review did not independently rerender the producer.

After scoring, the builder's recorded correction history was read: v2 corrected hero direction/framing and attached tail scutes; v3 relocated the head pivot, preserving the visible v2 mesh; core fitting corrected undersized hit volumes. The final frame is visibly complete and the tail scutes follow the tail. These are meaningful source/framing/rig corrections, but not evidence that the remaining central back crest is attached or that likeness improved through the invisible pivot/core changes. V1, v2 and rejected core-fit metadata remain preserved; nothing was deleted or overwritten.

## Proof boundaries

The supplied actual-native focused log records 3/3 tests passing; weighted source evidence records 192 sampled poses. These support source decoder/skin/pose and core-volume constraints, not visual motion quality. The supplied topology/equivalence reports concern manifold components, winding, color/skin equivalence and source geometry; closed individual pieces do not prove a continuous anatomical surface.

**Animation quality, physical death/impulse/settling, combat, hit registration, complete gameplay cycles, respawn/reload, phone performance and fun remain untested in this review.** No physical corpse contact test is supplied. Still renders do not establish any of these. No runtime/site/model edits, builds, rerenders, browser actions or network writes were performed. Only this review folder was written.
