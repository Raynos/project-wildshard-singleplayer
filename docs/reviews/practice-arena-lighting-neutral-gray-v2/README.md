# Arena neutral-gray v2 runtime study

Bounded lighting candidate, pending motion review and separate mounted-route QA. Independent inspection of all eighteen matched phone-policy stills and three real-strafe stills prefers gray v2 to warm v1: cream is less yellow/olive and dark teal remains more legible than the old profile. Real-right still has a dark-tan half-face and stippled fin. This is not an overall lighting, model or animation acceptance.

## Exact source and product

Source checkpoint: 56b8cc15ddf871f0f2451f346b9ed234e0e0453b. Clean engine baseline remains c4339d90a93ccc289540e3a72c1e9cbf221d98fb; authored-recoil source is a617d3d718e34437104d28842f97d2d713772479. The product is V70 gait5, authored-pose root flinch, neutral-gray-v2 lighting and optional contact-v1 AO. Native geometry, vertex palette, exact admission tuple and gait wrapper are unchanged and pinned in preview.json.

Profile SHA256: b0871ebc6bb4b1584cc3b970861dd9d577dd1d6f03c59b752f4d937571c29101. Product sourceHash: 80e39ff9f9af3b1e0bcaf3565e9282aa042a33af32298850c6085be7396cf895. App inventory: 137 files, 9,148,333 bytes; inventory SHA256 ad7f27374600070e9dfc1223c17c6fa53fc039bb7ebe4fb4609ec3070ce08b69. Build terminated 0. Separate regeneration proves all 50 files of both the omitted-profile product and original v1 product remain byte-identical to their frozen baselines.

V2 uses neutral sky #e5e5e5 and ground #a5a5a5, hemisphere intensity 1.15 and equal-channel linear toon lift [0.10, 0.10, 0.10]. V1 had sky #e5e5dd, ground #b2a58e and lift [0.10, 0.09, 0.07]. Both retain rim [0.65, 0.475, 0.3]. Fixed-world key intensity 2.7, its direction/color, native palette, facet normals and shadow normalBias 0.05 are unchanged. The separate 0.06 trial was rejected for negligible benefit. Contact AO radius 0.4 m/intensity 1 applies only when the renderer already has AO; this phone-policy run has none.

## Actual normal run

Capture ran 2026-10-19 00:54:28.917 to 00:57:45.068 UTC and terminated 0. Actual Start, W approach, Lock, right and left strafe precede the labelled paused controls. Actor state and poses were never clamped. The six angles each compare old-profile, neutral-v1 and candidate (gray v2), holding every actor/bone/camera transform and fixed-world key exactly equal. These are parameter controls in the same app, not different native models or separate historical app recordings.

Cloud Chromium uses an iPhone user agent on Linux, device DPR 3, renderer DPR 2, 780x1688 drawing buffer at 390x844 CSS pixels, one shadow cascade and three enabled passes without AO. Native screenshots are 1170x2532. This verifies pass policy and preserved 2x rendering, not physical iPhone/Safari performance. There are 612 unique rendered-frame samples spanning overlay t=0.0006 to 189.9458; encoded video frames include holds and are not fresh rendered samples.

Authoritative overlay windows: right strafe starts 8.117 s, left strafe 29.320 s, Pause 44.479 s. Matched controls occupy 45.308–157.125 s. Real combat resumes after 157.157 s; enemy HP changes to 33 at 166.899 s, 21 at 168.628 s, 5 at 170.415 s and 0/dead at 172.561 s. The run collects two local practice coins. Final real Retry restores player 100/enemy 45 alive by 184.286 s. The receipt preserves actual input and sample clocks, flash, flinch and death state. The known corpse floor issue remains unresolved; this is not a new all-phase world-clearance audit.

There are no page or HTTP errors. localStorage, sessionStorage, IndexedDB, CacheStorage, service workers and cookies are all empty. Coverage is app-root only. Mounted /puffer-engine/ coverage is a separate pending receipt.

## Measurements and evidence

All paused bone-world transforms are exact; measured world sun and CSM direction ranges are zero. Raw-PNG native-projected masks use the pinned Float32 weighted mesh, all captured bone matrices and exact camera, with a two-CSS-pixel silhouette erosion. Relative to old-profile, mean creature luminance increases 7.35–16.61/255; relative to warm v1, only 0.14–0.94/255. No masked pixel has all channels at least 250. These descriptive measurements do not establish visual acceptance.

All 23 ordinary review images are full-size WebP quality 90 conversions with original PNG and final image hashes in screenshot-receipt.json. Numerical analysis uses original PNGs. The images are retained as review evidence for the native Site; this closure's repository checkpoint is text-only because the weekly binary budget is nearly full. No binary encoding or archive substitutes are used. Raw video and full telemetry remain preserved and hash-pinned. The portable capture script differs from its executed source only by replacing the local Chromium executable path with CHROMIUM_EXECUTABLE; run it through the browser lane. The analyzer accepts the clean capture root as its argument.
