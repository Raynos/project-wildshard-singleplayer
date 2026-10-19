# Independent review: Conch fixed-rest tent diagnostic

2026-10-19. Scope: the retained attempt2 actual control/tent captures, not a shipping review.

## Verdict

**The bounded diagnostic succeeds visually: the new PCF control reproduces the prior conspicuous fine within-plane stippling, and the tent alternative substantially removes that stippling while retaining operative received shadows.** This is a conclusion about the complete filter replacement on this fixed one-map rig. It is not proof that random rotation alone caused the defect, nor proof that every residual high-frequency pixel is shadow noise.

All 18 raw 402×874 full-canvas PNGs were opened and inspected individually, without substituting contact sheets, crops, generated images or only a preferred angle. Old actual received-shadow `front-on`, `front-off`, `left-on` and `diag-right-on` full canvases were also opened. Old ON and new control show the same qualitative fine stippling on the face/cavity, pale shell-side plane and dark leg/body regions. Old and new hosts do not have exact elapsed-clock parity: background lines visibly differ in the front reference. That difference is preserved and does not support exact old-host pixel equality.

## Nine-view observations

- **Front:** control has dense flecks inside the shell opening and across the red face. Tent resolves these into continuous planes; the deep shell cavity, under-head darkness and shaded limbs remain.
- **Left:** control has fine stippling on the large pale shell-side plane and dangling leg. Tent makes both markedly cleaner while retaining the broad dark shell underside and body separation.
- **Right:** control leg/shoulder planes are strongly patterned. Tent removes the dense pattern; the limb under the shell remains dark. Shell silhouette and large facets stay fixed.
- **Back:** control's exposed torso and upper legs are densely stippled. Tent cleans those surfaces; broad dark body regions under the shell remain, with the same shell facets and outline.
- **Top:** the visible red body strip near the shell rim is patterned in control and cleaner in tent. The dark rim/overlap region remains. This view has less exposed body than the frontal views.
- **Diagonal front:** the control face/cavity and pale shell-side patch have conspicuous fine noise. Tent removes the dense pattern, retaining the shell overhang's dark interior and the face's geometric shading.
- **Diagonal left:** control's pale shell-side and exposed leg have fine stippling; tent smooths those within-plane regions without flattening the large faceted bands or the shaded gap behind the shell.
- **Diagonal right:** control's large exposed leg is visibly stippled; tent is clean and still shaded. Broad shell facet boundaries persist.
- **Diagonal back:** control's exposed limb/body strip below the shell is densely stippled. Tent reduces that to continuous dark planes; the underside remains dark.

These are appearance observations at captured rest, not animation, gameplay/readability, likeness or physical-phone scores. Dark pixels alone cannot prove shadows; the retained cast/receive flags and operative comparison-sampling shader evidence below provide that corroboration. The old OFF front is visibly brighter on face/feet; tent is not simply the old bypass appearance.

## Independent verification

`verify.mjs` was run successfully from the repository root. It performs no build, browser action or input write. Its retained output is `verification.json`.

- Capture report: completed=true, errors=[], acceptance=false; nine pairs and exactly 18 PNGs. Each pair's full recorded semantic state is deeply equal, independently of its equality flag. Each standalone observation equals its embedded report record.
- PNG file names, bytes, SHA-256 and actual IHDR dimensions verified. Every pair differs. Changed-pixel counts, in the view order above: 2682, 3789, 1931, 3248, 2080, 3597, 3132, 2382, 2679. These counts measure file differences, not stipple reduction or quality.
- Both setup payloads match exactly. Their pristine pre-prepare observations match: zero renderer programs/calls/frames, no graph receivers, no preexisting filter, zero game frame/time. Control's prepared `importedFilterIdentity=false` is expected because its filter remains undefined until ordinary light updating; it is not a failure. Tent's prepared identity is true.
- All recorded views have zero actual engine/game/simulation elapsed time and frames, fixedSteps and alpha; captureFps=30. Both use the same common explicit frozen-rest control. Roots/bones/camera, lights, CSM map/matrices/bias, material flags, visible receiver set, composer/background and settings are included in the matching state.
- Every selected native draw record references one linked fragment for mesh 0. Each file hash matches. Control fragment `d33d0e8dec0ebfbe999b744dae0a00fe3406b226ad61de1556ec00c733e85ac0` contains Vogel/noise constants 2.399963 and 52.9829189. Tent fragment `eb045572229a27f670bc6649be12f4093c6033888385b45d204db43642f8c387` contains the 2704/144 tent normalizations and lacks those Vogel/noise constants. Both contain shadow comparison samplers and receiver-plane derivatives.
- Inspected `observe.mjs` reads the selected draw's actual CURRENT_PROGRAM and attached fragment through public WebGL APIs inside onAfterRender. It requires linked status, every selected mesh, unchanged castShadow/receiveShadow=true, persistent imported filter identity, four rest renders and equality of the last two image payloads and semantic states. The saved repeatByteIdentical flags are true for all 18; the repeated payloads themselves were not separately saved, so independent offline verification relies on that inspected capture implementation and telemetry, not a fresh browser reproduction.
- Read-only `verifyHost()` recomputed the full current pin closure and output inventory successfully: prepared/native source gate, diagnostic source, both review documents, installed dependencies/links, Node executable, Chrome bundle, lane shim, native product and immutable old host. Pin identity is `a9b6ed01b3119a5eb35008bc8934696d5e91a3962cf7073a90deb6a2c02c1a0d`; generated host identity is `ed2227f7a355aa5a4d5b237e054b8a378d6c7de9d8ab4e8c4ad2577e4b0f9db2`, with 145 inventoried files. Both match report before/after identities. This is a source-and-byte pin, not a new Git commit claim.

## Scope and preserved history

At radius 2 this tent uses sixteen comparison taps versus five in the biased Vogel control. Sample pattern, footprint, weighting and receiver-plane tap calculation change together. The evidence supports this complete alternative; it does not isolate noise rotation, bias, toon amplification or a single arithmetic term. Classic receivers are not evidence of a global filter conversion.

The source/build review documents deliberately retain their pre-execution status and pinned bytes. This report supplies the later result without editing them. Attempt1's TypeScript virtual-ID build failure and its retained pin/log/source evidence are unchanged; attempt2 is the separate repaired build. Original reference host, receipts, raw captures, shader files and report were not edited. The original report's pending qualitative review field also remains unchanged; this independent report resolves that review externally.

**Disposition: diagnostic finding only.** No shipping approval, appearance promotion, new model-likeness score, gameplay/readability score, animation acceptance, ground-contact-shadow acceptance, browser rerun or phone performance inference. Existing independent 59/100 and historical 64.75/100 assessments remain unchanged. No builds, browsers, Mac actions, Git writes, Site work or child agents were used for this review.
