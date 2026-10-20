# Brine Pitcher complete-next: independent paired static review

2026-10-20. **Prefer complete-character-next over same-run v3 for continued static work. Neither is visually accepted.** Fresh weighted likeness: **3.2300/5 candidate**, **2.8500/5 baseline**. These scores are independent judgments from this pair, not continuations of earlier ratings. No target rounding or technical-test credit.

## Method and authority

Read repository AGENTS, current five-enemy loop, candidate README, capture provenance and raw manifest. Opened the original approved `brine-pitcher-hero.png` directly; it is authoritative. Also opened `pitcherExplorerCorrectedGen.png` and `corrections/pitcherWorldCorrectedGen-v2.png` as approximate supporting anatomy only. Their AI view labels do not establish exact matching camera geometry.

Opened each of the ten raw PNGs separately for **both** `tmp/pitcher-complete-next-20261020/final/` and `baseline/`: hero, front, left, right, back, top, elevated-front, elevated-left, elevated-right, elevated-back. This was direct image-tool inspection of 20 original captures, not review-board inference. Opened both original supplemental hero PNGs separately too. Reference sheets were viewed as sheets; they are not exact ground-truth hidden geometry.

## Fresh rubric scores

| Category | Weight | Complete-next | Same-run v3 |
| --- | --- | --- | --- |
| Silhouette / proportions | 35% | 3.40 | 2.95 |
| Mouth / expression | 30% | 3.05 | 2.65 |
| Defining details | 20% | 3.30 | 2.90 |
| Facet / style | 15% | 3.10 | 2.95 |
| Weighted total | 100% | **3.2300** | **2.8500** |

The candidate's thicker broad lids, forward-facing openings, fuller foliage clusters and curved foreground roots improve identity. The baseline's elevated detached umbrella lids and narrow stems are particularly unlike the approved living hood. Candidate roots now enclose visible stone masses, closer to the reference's rooted base.

The candidate remains visibly simplified: three nearly round bowl bodies on long exposed angular branches; a thin, regular ivory roll with attached triangular teeth rather than the reference's thick irregular fleshy rim and long integrated ivory lobes; broad flat hood plates with little surface subdivision; small sparse barnacles; spear-like leaves and a stripped-back rear trunk. Its central hood reads as a dark flat canopy in the hero, with very little of the approved green upper surface, and the supporting living hinge is crowded underneath. The reference is denser, more irregular, more layered and more convincingly organically joined. The baseline has similarly regular bowls and teeth, thinner disconnected-looking hood supports, sparse leaves and overly radial pointed roots.

## Per-view observations from the original pair

- **Hero:** Candidate mouths are substantially more open and the foreground root arches/rocks more convincing. Hood undersides dominate and the ivory rim is still a thin uniform ring. Candidate left hood tip clips the left border. Baseline has excessive lid-to-mouth air gaps and detached umbrella-like crowns.
- **Front:** Candidate red hood undersides dominate all three heads; openings remain shallow at this low angle. Baseline fronts are taller straight pots with very thin level lids and exposed support struts. Both are too diagrammatically three-branched.
- **Left:** Candidate leaning vessels and broad tilted lids improve depth, but hood thickness is a slab and a blunt upright wood end behind the central vessel is conspicuous. Baseline's suspended lid struts look mechanical and its trunk is narrow.
- **Right:** Candidate improves the organic head lean, but the lower lid overlaps the central vessel and near side-head mouth is weak. Baseline has an especially obvious angular zigzag lid support; both retain long simple exposed rear wood.
- **Back:** Candidate crown mass is closer, but large lime/teal polygons and protruding fan-vein tips are obvious. Rear wood is bare and stick-like relative to the reference. Baseline crowns look like small umbrellas on narrow posts.
- **Top:** Candidate lids blanket essentially all mouth openings and overlap one another; fan-vein protrusions remain visible. Baseline similarly hides most vessel interiors but uses smaller regular radial caps. Neither reproduces the reference's useful separation of hood, lip and mouth.
- **Elevated front:** Candidate's best mouth evidence: three broad dark apertures and stronger base arches. Low lids still crowd the opening and interior thorn/flesh articulation is missing. Baseline's hood poles, simpler leaves and starburst roots weaken likeness despite visible mouths.
- **Elevated left:** Candidate broad crowns mask much of the central and side opening; rear wood end and crown spikes remain prominent. Baseline mouth interiors are more exposed here, but the thin cap/strut construction remains wrong.
- **Elevated right:** Candidate retains some dark opening but caps overlap and dominate. Candidate base has improved depth and rocks. Baseline shows clearer cavities but very sparse rear foliage and a thin wood spine.
- **Elevated back:** Candidate central hood is clipped at the top; lid surfaces hide mouths and expose fan-vein tips. Baseline stays framed with larger visible cavities, but again its detached canopy construction is less like the target.
- **Supplemental hero pair:** Both use scale 5.5 and otherwise the same hero camera/light setup. Candidate silhouette is entirely visible; the left-tip crop is a framing issue, not missing geometry. Supplemental views do not cure the lid shape, opening, surface detail or organic-integration deficits, and do not replace the original scoring protocol. No supplemental elevated-back capture was supplied.

## Verification and limits

Exact requested source SHA-256 `34c80f467604fd6ae91c75f9b65d1e12d63de0045ff64596a076f63b27887e8a` and GLB `465657cbdf055d1f1da097a4e4f9e910897942750d5f21cddc89e4f96c46e2c3` verified. All 64 raw manifest entries pass byte-count/hash checks, including the 22 inspected current/baseline images and retained failed intermediate. Final artifact files and raw final export match. Baseline native source is byte-identical to retained v3. Source render blocks are exactly equal across candidate and v3: 600×720, 24 Cycles samples, no denoising, Standard transform, three unchanged lights, orthographic scale 5, target (0,0,2), eight-unit orbit. Supplemental wrapper changes scale to 5.5 identically for both and restricts capture to hero. Metadata and script consistency support provenance; I did not independently rerender.

Executed only the read-only parity portion of the existing audit, confirming exact float32 native/GLB positions, colors, rigid skin assignments and oriented triangles. This is not a new full audit or visual pass. Saved source audit reports the broader topology/bind tests; those were read rather than rerun. The render script exports and renders the same source object collection with no model rewrite between export and capture. This establishes source evidence, not runtime-decoder visual equivalence.

The original failed closed-hood pass is retained under historical `candidate/` and `failed-closed-hood/`; it was not scored as current. Native bind minimum independently measured at **−0.0841098427772522 m** (−84.1098427772522 mm). No physical/contact acceptance, root lift or collider workaround follows. Existing negative runtime/corpse evidence remains unresolved. Fan-vein crown protrusions remain present. No gameplay, animation, combat readability, physical-phone performance or human-fun claim is made. No source, Git, Site, render, browser or Mac operation performed.

## Recommendation

Keep complete-next as the better static source study while preserving v3 and failures. Next consequential geometry pass should restore the approved hood's raised living fan and curved irregular green/red silhouette while preserving visible mouths across elevated angles, sculpt the rim/lobes into the vessel, and thicken/overlap the woody base and foliage. Remove crown vein protrusions through actual geometry correction. Do not promote to physical or gameplay acceptance on this review.
