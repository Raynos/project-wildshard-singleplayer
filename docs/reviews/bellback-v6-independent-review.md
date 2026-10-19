# Bellback V6 independent likeness review

Reviewed 2026-10-19 against the approved original, without using previous model scores.

## Verdict

**3.5625/5 weighted likeness. Strictly greater than 3.5: yes, narrowly.**
This is a static visual milestone only. The face remains a material mismatch;
passing this threshold does not mean that the model is quality-complete or that
its animation, combat, runtime integration, performance or fun has been proven.

## Evidence inspected

- Approved target: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp`, both depicted character views.
- Matched hero: `tmp/bellback-v6-review/hero.png`.
- Actual canonical images in `tmp/bellback-v6-nine-review/`: `01-front.png`,
  `02-left.png`, `03-right.png`, `04-back.png`, `05-top.png`,
  `06-diag-front.png`, `07-diag-left.png`, `08-diag-right.png`,
  `09-diag-back.png`. Each image was inspected individually, not only a board.
- `capture-nine.json` and `capture-hero.json`: matching source SHA-256
  `952a8ddca0991a5aaaf1044d3a0498626567d6805881b77e43450c65f1e90a1d`.
  All nine image hashes and the hero image hash were independently checked against
  their receipts. The coordinator reported canonical capture terminal exit 0.

No new render was run for this review. Hidden-angle geometry is assessed for
coherence with the original's visible forms; the concept does not establish an
exact canonical rear or top design.

## Component scores

| Component | Weight | Score / 5 | Weighted contribution |
| --- | ---: | ---: | ---: |
| Silhouette | 35% | 3.75 | 1.3125 |
| Face | 30% | 3.0 | 0.9 |
| Defining details | 20% | 3.75 | 0.75 |
| Facets / style | 15% | 4.0 | 0.6 |
| **Total** | **100%** | | **3.5625** |

The displayed total is the unrounded arithmetic result, not a precision claim
about subjective judgement. No score from another enemy or earlier version was
averaged into it. Structural checks did not earn visual-score credit.

## What holds up

- The hero and front immediately communicate the target's defining combination:
  an oversized sea-green bell, timber wreck carrier, amber hostile eyes, pale
  teeth and heavy gray stone feet. These are integrated into a complete creature.
- The bell has a readable flared rim, dark interior, suspended clapper and gold
  bands. It remains a volumetric bell from both sides and elevated views.
- The four-legged stance supports the high carrier. Timber posts, lashings and
  arch continue coherently around the back rather than disappearing outside the
  presentation angle. Top and rear diagonals preserve the same assembly.
- Large angular planes, warm orange/brown timber, muted turquoise and stone-gray
  feet fit the approved low-poly material language. Geometry remains legible
  without relying on the illustrated beach or interface surrounding the concept.

## Likeness defects

1. **Face is the largest deduction.** In the hero/front/elevated front, the head
   reads as a wide, shallow shield or animal mask. The original has a more
   projecting, layered wooden snout with an uneven, broken-board brow and jaw.
   The candidate's two pale forehead spikes are conspicuous additions. Its thick
   continuous cream lower-mouth frame and paired tusk-like teeth simplify the
   original's irregular jagged bite. The eyes communicate hostility, but their
   surrounding planes and mouth do not reproduce the original facial character.
2. **Carrier is too regular.** Both side views expose a tidy rail-and-post cage
   around a relatively simple barrel-like torso. The original has a denser,
   splintered wreck mass with more overlapping angled timbers and binding runs.
   The back's flat polygonal barrel end and long upright plank reinforce the
   constructed-pack appearance. Exact unseen rear details are not required, but
   this regularity weakens the visible target's wreck-built character.
3. **Bell and body balance differ.** The candidate bell leans noticeably forward
   in profile and has a broad rounded crown; the concept reads as a taller,
   straighter-sided hanging bell. The model's open side spaces and cleaner leg
   blocks are less compact and interlocked than the target's crouched guardian.
4. **Surface style is good but simplified.** The original's varied timber planes,
   irregular lashings and richer patina are reduced to cleaner repeated bands,
   ropes and broad solid wood surfaces. This is a fidelity loss, not a request
   for high-frequency texture or extra triangles for their own sake.

## Interpretation and next priority

The weighted result clears the owner's current visual threshold narrowly because
the whole silhouette and signature bell/carrier details are recognizably close,
even though the face is only moderately faithful. Retain the defects with the
score; do not present it as an exact replica or a completed playable enemy.

If further visual work is authorized, address the projecting wooden snout,
broken-board facial layering and individual irregular teeth before adding minor
decoration. Preserve the readable bell, stance and low-poly palette. Animation,
hit/death, loot/retry, persistence and performance need their own actual evidence.
