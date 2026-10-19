# Brine Puffer arena lighting: independent diagnostic review

2026-10-19 UTC. **The reported lighting/color shift is visible. Recommend an arena-only neutral fill and lower key-to-fill contrast study before changing model albedo. No candidate fix is accepted by this baseline review.**

## Actually inspected

Three real-input normal-render stills (`real-start`, `real-right`, `real-left`); all13 paused camera-only orbit stills at0–360 degrees in30-degree increments; all18 matched normal/no-AO/no-received-shadow stills at0/60/120/180/240/300; all8 normal/no-rim stills at0/60/120/240. These are42 existing actual PNGs from `v57-lighting-orbit`, `v57-lighting-factors` and `v57-lighting-rim`. No video-frame review or phone-performance claim. Render size390×844,DPR1. Paused orbit and factor toggles are labelled diagnostics, not genuine gameplay camera inputs. The three initial stills use real Lock/strafe inputs.

## Findings

- Real-start has readable warm cream; real-right has a broad purple/brown face and severely darkened orange/teal; real-left returns to readable cream. The change is materially larger than a subtle rim highlight and explains the owner's complaint.
- Fixed-actor orbit exposes a coherent brightly lit side and an almost black/navy opposite side. Back/side frames180–300 lose teal plane separation and parts of the tail/feet silhouette against the dark arena. Front/three-quarter cream can remain readable while one cheek becomes purple-brown. This is excessive contrast for an inspection/combat preview even though directional shading itself is expected.
- All six no-AO comparisons brighten the belly underside and tight overlaps. They do not remove the large unlit hemisphere or broad hue shift. Removing AO wholesale sacrifices useful contact/form information without addressing the primary issue.
- No-received-shadow comparisons most clearly remove stippled dark fin patches around the300-degree view, also visible at oblique front/side angles. The broad dark side remains. Thus at least this speckling is associated with received-shadow rendering, rather than being proven AO noise. A separate bounded shadow-bias/filter study may be useful after the lighting balance is corrected; do not globally disable shadows as the main fix.
- All four rim pairs show only modest warm edge/glint changes. Removing rim does not recover the dark hemisphere and slightly weakens edge separation. Rim is not the main cause of the cream-to-purple/brown shift.

## Light versus view evidence

Captured light readout has a warm directional key at intensity2.7,color[1,.97,.9], sun direction[.3841,.7682,.5121], and a strongly blue hemisphere at intensity.9,color[.1981,.2789,.9047]. These are linear color readouts, not display RGB values. Worker receipts report invariant sun/direction and exact actor/bone transforms during the paused orbit;0/360 enemy ROI is pixel-identical. Actual Lock/strafe rotates the actor toward the player, changing its normals relative to the fixed-world key. Camera-only orbit instead reveals different illuminated surfaces, with smaller view-dependent rim/post effects. The evidence does not support a randomly moving light or a changing texture/albedo. It does not isolate every post-processing contribution.

Worker creature-mask measurements are consistent with visual assessment: no-AO mean luminance lift5.23–15.27/255, no-received-shadow.02–4.20, no-rim decrease1.02–1.79. These are supplied numeric diagnostics, not independent perceptual scores.

## Bounded next study and acceptance checks

Keep the change inside the practice arena lighting configuration. Desaturate the blue fill toward neutral and increase dark-side fill relative to the key; compensate key/exposure only enough to avoid washing out the existing bright side. Preserve fixed-world directional cues, flat facet normals, model albedo, mouth/eye recesses and useful contact AO. Avoid a camera-following light that hides the issue, a global material/rim change, or a brighter albedo that blows out the lit view.

Compare the same six frozen views plus real Lock/strafe yaw extremes before accepting: cream should remain recognizably cream on the unlit cheek; pupil/brow/mouth expression should remain readable; teal planes and tail outline should separate from the floor; lit facets must retain distinct values rather than becoming uniformly flat; feet should retain contact shading. Then inspect received-shadow stippling separately. No exact setting is accepted until the candidate's actual images are reviewed. No static-likeness score or animation rating changes here.

Source orbit receipt SHA256 `4032a932194e9f8cff60a6aa2bda12474876620f9a1f9e02425dfa66db1eb684`. Original diagnostic captures remain unchanged. No source edits or publication were performed by this review.
