# Conch fine surface pattern: source diagnosis

2026-10-19. Read-only code/evidence investigation; no build, render, shader, graph, lighting, geometry or production changes. No new quality score or acceptance claim.

## Finding and next decision

**Received shadow filtering is the strongest supported next isolation target, not an established root cause.** The actual arena's source configuration uses five-tap screen-space-noise-rotated PCF, and the native toon model applies a nonlinear shadow band to its result. That combination can turn spatially varying shadow samples into fine lit/dark stippling. There is a direct source path for this mechanism. Authored paint itself contains no corresponding noise operation, and preserving the original colour channel did not remove the pattern.

Recommend one diagnostic experiment only: **candidate native receiving shadows on versus off**, using the public Three Mesh.receiveShadow property, with casting unchanged. Do not tune tint, jitter, shadow bias, band thresholds or lights. This recommendation is not permission to execute; no experiment was run here.

## Evidence inspected and limits

Read the independent authored-colour review and capture results. Opened raw front baseline/native/source, left native/source, and diag-front native/source PNGs under `tmp/conch-color-view-qa/attempt1/`. Front and diag-front native have strong fine red/orange patterning within otherwise broad face/cavity planes; left native also shows fine dark/light variation on the exposed body. Source is cleaner in these areas, although it is not entirely pattern-free: subtle fine variation remains on some shell planes. This was targeted diagnostic inspection, not another nine-view blind scoring round.

The earlier independent 59/100 and retained historical 64.75/100 judgments remain separate. Neither was changed or averaged, and their difference is not evidence of measured regression. The failed colour experiment remains useful diagnostic evidence and rejected for appearance promotion.

The existing capture logs prove matched rendered light colour/intensity/transforms and common camera/root/simulation state. They do **not** record shadow.filterNode, shadow texture contents, resolved tier, AO pass state, shadow bias or a generated fragment shader. Source configuration below is stronger than guesswork, but it is not a recorded GPU-program inspection. Current bytes of ten principal source files named below match the prior reviewed-build pin: practiceLevel, emptyLook, skyRig, engineNodesHandler, planeBiasShadowFilter, cascadeLightNode, graph/compile, graph/presets, Game and AnimalFactory.

## Proven source data flow

### Paint, normals and material

- `art/driftwood-isle/approved-conch/selected-native-color/graph.json`: exact `aAuthoredColour × materialColour` enters surface colour; materialEmissive enters emissive; roughness 0.85; metalness 0; model toon; flatShading true. There is no graph stipple/noise/discard/alpha/normal-map operation.
- `src/engine/render/graph/compile.ts:959–1035`: model toon creates GraphLitMaterial with toonHooks; the hook borrows the actual ToonLook uniforms. The colour expression becomes colorNode, flatShading stays true. The class reports as MeshStandardNodeMaterial; that type name alone does not imply the ordinary physical lighting model.
- `src/engine/entities/AnimalFactory.ts:378–383,602–618`: faceting is a separate geometry operation; per-animal material tint remains; native mesh casts and receives shadows. `lowpoly.ts:30–50` recomputes non-indexed normals and applies centroid-hashed legacy colour jitter. The candidate bypasses that legacy colour input; it does not change geometry or normals.
- Three's `node_modules/three/src/nodes/accessors/Normal.js:43–61` chooses a derivative face normal from positionView when flat shading is active. Consequently, merely observing historical vertex-normal changes is not proof those stored normals are the direct source of the visible face lighting. Shadow normal-offset handling is another path and was not isolated.
- The source comparison retains ordinary MeshStandardMaterial materials, many DoubleSide, while native is one compiled graph material. Matched lights do not make these material/shadow-side/normal responses equivalent. Source appearance is not a faithful normal-only control.

### Arena light and shadows

1. `src/practiceBoot.ts:25–27` starts practiceLevel and configures optional AO. `src/practiceLevel.ts:13–27` uses `emptyLook(0.5)` and the authored hemisphere profile while retaining manifest sky/grade values.
2. `src/game/shardfile/emptyLook.ts:9–22` selects the clean engine chain, supplies an asset-free backdrop, and returns null LUT. It does not specify a shadow strategy or install toon world lighting.
3. `src/engine/world/skyRig.ts:143–173` creates the CSM light. A deterministic tent is selected only when explicitly requested by shadows.filter and the phone-split rig. This empty look requests neither. The other path installs receiver-plane-biased PCF. Initial bias is -0.00012; default normalBias 0.05 and radius 2. These are source defaults, not independently captured runtime values.
4. `src/engine/render/nodes/engineNodesHandler.ts:610–623` assigns planeBiasShadowFilter to shadow-casting lights without their own filter when that classic filter is installed.
5. `src/engine/render/nodes/planeBiasShadowFilter.ts:25–43`: `interleavedGradientNoise(screenCoordinate.xy) × 2π` rotates a five-sample Vogel disc per pixel. Sample depths get receiver-plane slope compensation, and the five depth-comparison results are averaged. This is a concrete fine-scale spatial noise source, not a paint variation.
6. `src/engine/render/nodes/cascadeLightNode.ts:43–85` exposes cascade base colour, shadowed colour and weight. `graph/compile.ts:229–250` recovers a received/base shadow ratio, passes it to the toon hook, and applies cascade weighting after the nonlinear hook.
7. `graph/presets.ts:609–660` applies `smoothstep(shadowEdge.x,shadowEdge.y,shadow)` to the received shadow and multiplies that by the face-light band. The admitted product's `sections/look/look.json` has shadowEdge [0.25,0.75], faceEdge [0.14,0.2], shadeGrade 0, lift [0.1,0.1,0.1], and the warm rim/terminator. A partial shadow changing between taps can therefore change brightness much more than its underlying albedo. The schema itself describes shadowEdge as soft to avoid a speckled dithered penumbra (`materialFamilies.ts:43`). This establishes plausibility, not occurrence at a specific pixel.

### Contrast and postprocessing

- Toon's direct term depends on a narrow face band and shadow band, rather than source material's continuous physical diffuse. With shadeGrade 0 the sun diffuse contribution in the shadow band falls to zero; ambient lift still contributes. The dark native tint further scales albedo. Toon omits environment diffuse and roughness .85 is above glossBelow .72, so direct sun specular is suppressed (`compile.ts:257–280,984`; `presets.ts:657–661`). These are supported causes of response differences and cavity/body contrast changes, not isolated estimates of their size.
- Cloud noise is world-space at scale 60 m, with a second octave at 2.3×. On this roughly 3.7 m actor it is a broad variation, a poor explanation for dense per-pixel stippling. Admitted caustics level is null, excluding that branch.
- `Game.ts:536–607` has AO conditionally before the colour chain. `tiers.ts:4–6` disables AO on phone; capture uses a fresh iPhone-emulated context without a tier override. Thus AO is absent on the expected source path; the old report does not independently log the resolved pass list. Do not claim runtime AO telemetry was checked.
- The selected clean chain excludes grain, chromatic aberration and volumetric haze. It retains tone mapping (AgX), grade/contrast, bloom, vignette, optional god rays and antialiasing; emptyLook's LUT is null. These can compress or redistribute contrast and soften small details. A grain explanation conflicts with the selected source chain. Same composer does not cancel nonlinear post effects when material radiance differs.

## One bounded next experiment

Use an isolated comparison adapter in the same actual host, preserving the admitted authored-colour candidate and all controls. For each existing view capture candidate A with each native SkinnedMesh.receiveShadow at its original value, candidate B with receiveShadow false, and restored candidate A. Keep castShadow true, source hidden, and all graph/material/geometry/bone/light/composer settings unchanged. Restore flags in finally. Use existing receive-shadow shader variants; no hand-written shader, engine patch, product graph alteration or lighting change.

API evidence: Three AnalyticLightNode.setup only builds received shadow when builder.object.receiveShadow is true (`node_modules/three/src/nodes/lighting/AnalyticLightNode.js:257–265`). EngineNodesHandler includes the object receive flag in its program-cache distinction (`engineNodesHandler.ts:393–414`). The cascade wrapper subsequently consumes that light result. Record actual flags and material identities and verify the B variant compiled/selected; a visually unchanged pair without those checks is inconclusive.

Capture runtime tier, full pass list, light castShadow/mapSize/bias/normalBias/radius/filter identity and material settings once as read-only telemetry. Preserve the existing immutable camera/geometry/light checks and synchronous REST sampling. Confirm A/restored-A stability so shadow-map updating or first-use compilation does not invalidate the comparison.

Decision rule: if dense within-plane pattern disappears while broad face facets remain, received shadows are necessary for that pattern in this scene; that still does not distinguish self-shadow acne, sampling noise, depth-coordinate convention, normal bias or toon amplification. If it persists unchanged under a verified bypass, received shadows are not sufficient to explain it; return to diagnosis rather than another parameter sweep. Brighter output alone is expected and is not a successful quality result. Disabling receiving shadows is a diagnostic ablation, not a proposed shipping look.

Only this review directory was written. No runtime test, build, render, Git, Site or Mac operation was performed.
