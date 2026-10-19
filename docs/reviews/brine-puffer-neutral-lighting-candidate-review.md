# V70 neutral arena lighting candidate: independent still review

2026-10-19 UTC. **Support this as a bounded incremental arena-lighting improvement. The color/readability problem is reduced, not fully resolved.** No new static or animation score; no publication performed by this reviewer.

## Evidence inspected

All18 desktop matched stills at0/60/120/180/240/300 degrees, each with old-profile, neutral-fill-only and full candidate; desktop real-start/right/left. All12 phone-policy matched old-profile/candidate stills at the same six angles; phone-policy real-start/right/left. Total36 actual PNGs. No frame-by-frame video inspection or motion-quality claim in this review.

Desktop evidence set: `v70-neutral-studio-v1-desktop`, capture SHA256 `8b7ecea9a306556974ff5b25f1852f31b39ee714b164c497a0a14624d46a4352`. Phone-policy set: `v70-neutral-studio-v1-phone`, capture SHA256 `90f921bc9adfaf7491b479ac0df9b2f6d0357c43f84a3b430b2f5c9d3758cd5c`. Each set has a frozen-stills manifest. Product source hash `42dfa4fffc90e251320c760e83a4e11b2d887e4b792edffb3204550cd2514fd7`, checkpoint `06ce127f51cd8663bca67166b62b6e35d9f1c184`.

Desktop uses four normal passes including AO, three shadow cascades. Phone-policy evidence is cloud Chromium on Linux with iPhone UA, deviceDPR3 but actual rendererDPR2/780×1688, one shadow cascade, three normal passes and no AO. It exercises the policy and buffer size, not real iPhone/Safari performance, thermal behavior or owner-device appearance.

## Direct visual result

The neutral-fill-only desktop comparisons remove the broad purple/brown cheek cast and change nearly navy-black rear mantle into recognizably dark teal, especially180/240/300 degrees. Tail interior planes and spike colors become more readable. Full candidate further lifts pouch/fin underside darkening relative to neutral-fill-only, most evident at front60 degrees and side0/120. Major facet value changes, mouth cavity and pupils remain distinct. The bright side does not show an obvious new broad white washout in the inspected stills.

Phone-policy comparisons show the same hue/readability gain despite AO being absent. This supports the fill/profile change as a real component rather than attributing the improvement solely to AO. The real Lock/strafe stills retain brighter cream when facing the key and dark ochre/olive cream at the yaw extreme. That remaining luminance/color swing is substantial, although less objectionable than the earlier purple/navy result. The back core remains quite dark.

Received-shadow stippling remains conspicuous on fin surfaces, especially phone-policy120 degrees and real-right. These stills therefore do not close the speckle issue. They also do not establish accurate contact: dark floor, perspective and existing motion/contact limits remain. The previous corpse penetration finding is unaffected.

## Scope of recommendation

Keep the change bounded to the arena and preserve the old profile for comparison. Accept the candidate only as an incremental lighting/readability improvement, not a finished look or static-likeness gain. A subsequent separately controlled shadow-bias/filter test should target the stippled fin patches while keeping useful floor/contact shadows. Avoid brightening model albedo to compensate, removing all contact shading, or applying a global camera-following light.

The combined neutral-fill label is not treated as proof of which individual uniform causes each pixel change. A separate hemisphere-only/toon-lift-only isolation is in progress and should resolve causal attribution; no result from that unfinished set is claimed here. All baseline42-still diagnostic evidence and prior review remain unchanged.
