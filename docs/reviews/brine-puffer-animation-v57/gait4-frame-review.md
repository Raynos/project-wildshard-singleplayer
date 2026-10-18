# Gait4 independent recorded-frame review

2026-10-18. Source `501c9c6`, rig1 weighted mesh `7d27737d`. **Do not promote yet: a visible stop-to-neutral foot pop needs correction.**

## Findings

- Alternating forward/back forefoot movement is more legible than motion3's small fin tilt. It remains a short shuffling/paddling gait in this frontal view; convincing world-space planted contact is not demonstrated.
- **Stop defect:** source F562, overlay20.005, to F564, overlay20.080, changes staggered feet abruptly into a near-symmetric stance while the head stays nearly fixed. The screen-right toe tips shift roughly15pixels upward; the opposite foot moves downward. This is a visible pose reset, not a numeric-only concern. Telemetry confirms speed0.156 at20.0048,0.151 at20.0398, then0 at20.080 as stage1 begins. Blend the outgoing limb pose into the attack stance instead of multiplying the gait offset immediately to zero.
- The subsequent attack and alert keep the visible face/pouch/front roots connected. No obvious front appendage detachment is seen. This does not certify hidden attachment surfaces.
- Resume returns to alternating movement, with a rapid initial foot change as speed rises. Telemetry shows stage0 at33.7993, motion begins33.9015 at0.3, and reaches0.7 by33.9992. The brief acceleration supports a transition-blend check on restart as well as stop. Do not treat the foot movement as proven ground planting.
- Tail stays obscured. The attempted strafes yielded only about1.8degrees of relative view change because the AI faces the player. No side, tail, meaningful turn or terrain acceptance follows; those are missing evidence, not passed tests.
- At close approach outer toes can meet/cross the frame sides, and the weapon overlays the central lower body. The dark diagnostic floor lacks enough contact cues for a definitive sliding-distance, penetration or planted-foot measurement.

## Exact inspection scope

Every encoded frame in three inclusive zero-based ranges was manually inspected: walk F300–425 (126frames,12.00–17.00video seconds); stop/attack/alert F550–690 (141frames,22.00–27.60); resume F890–1020 (131frames,35.60–40.80). **398 selected frames total**, using every cell of six numbered sheets per range. Native-size stop frames F562 and F564 were additionally inspected. This is not a whole-video review. Strafe/turn portions were not manually frame-reviewed because they did not provide the requested side view; no turn verdict is assigned.

The selected walk lead-in includes the appearance-mode transition/warmup. Do not use that portion for smoothness comparisons. Runtime telemetry identifies two clean speed0.7 cycles with phase wraps at overlay11.5294→12.0826→12.6515, within the inspected walk segment. Earlier overlay10.386–10.887 includes a stall/catchup. Overlay timestamps and video PTS differ; the overlay is the phase-alignment reference.

The stop attack runs overlay20.080–22.2703 and alert through24.5689. Resume stage change is33.7993. These authoritative state labels are complementary to the actual images, not substitutes for them.

Capture reports1402samples and about23.79Hz overall, but that mean conceals early catchup steps and occasional repeated/held frames. Video encoding is25fps. No smoothness claim is inferred from the mean or frame hashes. Post/shadows-off diagnostic appearance and1×390×844 cloud rendering do not establish final appearance or phone performance.

## Recommendation and evidence

Retain gait4 as an unaccepted candidate. Fix stop/start continuity first, then review actual recorded transitions again. Preserve the improved alternating stroke while blending its amplitude/pose across movement-state boundaries. A displacement-aware local planting solution remains separate; calibrated speed/phase is not that solution.

Numeric2.874mm clearance and zero root error do not override the visible pop or certify terrain/turn contact. No model likeness score changes and no animation score are assigned.

- `gait4-walk-frame-map.json`, `gait4-stop-frame-map.json`, `gait4-resume-frame-map.json`: all selected source IDs and decoded RGB hashes.
- `gait4-stop-pop.jpg`: native-size cropped F562/F564 comparison,65,511bytes. Only cropping, labels and JPEG encoding are applied.
- Original capture: `page@3a29c149a91f7faa4d89bd353b9e47e3.webm`; preserved unchanged by the runtime capture owner.
