# Approved reference gap audit

2026-10-19 23:19 UTC. Source: Site82, `7494b6440bec378dd34d178ce4b5635d336203ab`.
Read-only artifact audit; no publishing, runtime build, generation or live-browser claim.

## Result

Availability is complete: nine existing heroes, eighteen existing sheets and 162 valid individual panel windows. `gallery.js` places each full sheet outside Details and its nine panel windows inside Details. Panel paths, dimensions and normalized bounds pass. These are 162 accessible crops of eighteen sheets, not 162 independent generated files. Exact display hashes are in `pins.json`.

Canonical visual correctness remains open. Every selected context is explicitly `usable_with_caveats`; none has a measured-camera or rigid-anatomy pass. This is not evidence that eighteen fresh regenerations are necessary. Preserve the successful replacements and correct bounded contradictions first. Original approved heroes remain authoritative; unseen anatomy is approximate.

## Ranked remaining work by identity and context

All sheet paths below are relative to the Site's `dist/assets/approved-nine/`.

1. **Brine Puffer** — `pufferExplorerGen.webp`, `pufferWorldGen.webp`. Explorer 04/09 show a broad rear-facing disk tail; World 04/09 show an edge-on vertical blade. Direct pixel comparison confirms the contradiction. Decide consistent orientation from the authoritative hero, then repair the conflicting rear panels without changing the hero. Both contexts also vary spike distribution and fin geometry; sides remain oblique. Do not use either rear interpretation as recovered geometry.
2. **Bloomthroat Iguana** — `iguanaExplorerGen.webp`: 04 tail curls screen-right while 09 curls screen-left at nominally the same rear bearing. Direct pixels confirm this outstanding rigid-pose contradiction. `iguanaWorldGen.webp`: previous exhaustive audit records 06 as pronounced three-quarter rather than centered elevated-front; tail/scale/throat detail drifts. Explorer and World top panels use opposite head azimuths; this is a convention mismatch, not by itself invalid overhead coverage. Prioritize Explorer rear consistency, then centered World 06 if canonical framing is required.
3. **Conch Duelist** — `conchExplorerGen.webp`, `conchWorldGen.webp` are selected corrected v3. Opposing side headings are now repaired in 02/03/07/08, but asymmetric shield/blade shape, attachment and visibility do not remain rigid across them. Explorer 05 is improved top-shell coverage but still steep; front/high-front views retain obliquity. World 05 is substantially top-down. First fix weapon-side continuity, then exact profile/front/top framing. Do not repeat the superseded claim that the lower headings remain reversed.
4. **Brine Pitcher Matriarch** — `pitcherExplorerCorrectedGen.webp`: 02/03 remain side-oblique; 07/08 do not rigidly match corrected sides; foliage and pitcher occlusion change. `pitcherWorldGen.webp` now contains corrected v2: 03/07 improve differentiation but remain oblique with changing branch/head/root arrangement. Keep both corrected sheets; target consistent three-head construction and opposite side occlusion rather than generating another unrelated plant.
5. **Pearlglass Medusa** — `medusaExplorerGen.webp`: cap tilt and ribbon count/attachment/curvature vary; left/right cannot be established reliably from this weakly asymmetric organism. `medusaWorldCorrectedGen.webp` now contains style-corrected v2: actual pixels show faceted coast in all nine panels, so the former studio-context and photoreal scenery failures are resolved. 05 splays ribbons radially rather than maintaining the hanging pose; 06 still exposes much underside, and 07/08 rely strongly on cap tilt. Preserve the corrected scenery; stabilize pose/attachments and a declared directional landmark.
6. **Tide-Root Colossus** — `colossusExplorerGen.webp`, `colossusWorldGen.webp` are corrected v3. Actual pixels show left/right headings repaired and canopy-dominant overhead coverage. Explorer sides remain oblique; World 03 is rear-side rather than strict profile. Foliage/antler/arm details shift. World labels still assert strict profile, true vertical and 39 degrees; neither pixels nor provenance prove those measurements. Correct the overprecise wording or produce measured evidence; do not cite labels as verification.
7. **Keelmaw** — `keelmawExplorerCorrectedGen.webp`: actual pixels confirm Explorer stage and corrected 07/08 headings; 06 is conspicuously three-quarter, and tail/rope/jaw vary. `keelmawWorldGen.webp`: previous audit finds recognizable nine-direction coverage but changing tail curl/jaw/armor. Center Explorer 06 and reconcile tail/rope anatomy if upgrading beyond approximate concepts. The old missing-Explorer-context failure is obsolete.
8. **Splinter Mantis** — `mantisExplorerGen.webp`: wing/limb count and pose drift, especially rear/top; previous exhaustive audit remains applicable. `mantisWorldGen.webp` is corrected v2: direct pixels confirm 07 left, 08 right and improved dorsal 05. Leaf count, spread and limb attachment still change, and generic beach replaces original forest habitat. No missing World context; exact original-habitat fidelity remains a separate art-direction choice. Stabilize appendage construction before claiming rigid turnaround.
9. **Bellback** — `bellbackExplorerGen.webp` is corrected v2: actual 04/09 now show rear scaffold/crossed rope without a frontal bell opening, resolving the major contradiction with `bellbackWorldGen.webp`. Explorer 06 remains three-quarter; both contexts vary timber, horn and rope placement. Preserve repaired backs. Remaining work is construction continuity and exact-camera refinement, not another rear-concept reset.

## Targeted inspection and provenance

Direct current-display pixel inspection: both Puffer sheets; Iguana Explorer; both Conch sheets; both Colossus sheets; Bellback Explorer; Mantis World; Pitcher World; Medusa World; Keelmaw Explorer. Other contexts reuse the existing exhaustive nine-panel review, reconciled against current manifest entries rather than pretending to re-review unchanged pixels.

Evidence:
- `docs/reviews/approved-nine-context-audit/visual-review.md`: original exhaustive review and initial Pitcher/Medusa/Keelmaw corrections.
- `art/driftwood-isle/concepts/approved-nine-2026-10-19/corrections/visual-review.md`: selected Conch/Colossus v3, Mantis/Bellback v2.
- Site `source-evidence/approved-nine-qa/six-corrections-provenance.json`: exact six replacement display pins; current hashes match.
- Site `source-evidence/approved-nine-qa/final-world-20261019-1742/provenance.json`: Pitcher World v2 and Medusa World style v2; current hashes match.
- Site `dist/assets/approved-nine/manifest.json`, `gallery.js`, `view.html`: availability, presentation, and explicit crop/intended-camera caveats.

The page and sheets say AI mockup/reference, not game capture. If the owner requires the literal burned-in text “TARGET MOCKUP”, existing sheets generally say “AI mockup”; that precise wording change remains separate from image availability. No current-model screenshot can replace these target references.
