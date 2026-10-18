# Proposed low-cost motion diagnostic capture

Executed separately; see no-post-diagnostic-result.md. The original plan below remains as provenance. Measured host buffer was1×, not the assumed2×phone setting. Public visual settings and frozen artifacts stayed unchanged.

## Supported actual-engine route

`Game.composer` and `Game.renderer` are public runtime handles. The installed
postprocessing composer skips passes with `enabled=false`; its scene pass supports
`renderToScreen`. A capture-only browser action can save all original pass states,
keep the existing WorldRenderPass, disable subsequent AO/effect/AA passes, and set
the scene pass to render to screen. `renderer.shadowMap.enabled=false` disables
shadow rendering. Reloading the isolated page restores original settings.

This keeps the real scene, toon materials, geometry, skinning, AI, physics, inputs
and simulation settings. It is not a replacement renderer. It omits AgX/grade,
bloom, vignette, AA and shadows, so neither colors nor shading can be compared
against target art. Label every recorded frame: **MOTION DIAGNOSTIC — post/shadows
disabled; not visual review**. No unlit fake renderer, frame interpolation, speed
adjustment or production render-scale change is proposed.

## Bounded test after lane handoff

1. Boot the exact motion2 artifact in the same cloud Chromium/SwiftShader host.
   Capture actual renderer pixel ratio, canvas/drawing-buffer dimensions, composer
   pass names/states, shadow enablement and current camera before changing anything.
2. Record a baseline full attack/alert cycle at measured standoff with the same real
   LOOK drag, light authoritative actor/clock telemetry and rAF timestamps.
3. Apply only the capture-only pass/shadow settings above. Assert pixel ratio,
   drawing-buffer dimensions, native mesh hash and simulation settings unchanged.
   Record the settings switch on video; allow shader warm-up before measurement.
4. Record another complete attack/alert cycle and compare rAF interval distribution
   and wall seconds per authored2.1sim-second strike. Repeated video frames remain
   honestly present. If timing still slows, report that result and stop rather than
   lowering2×render scale or manufacturing smoothness.
5. If improved, use the diagnostic view for complete idle/gait/hit/death motion
   inspection, alongside normal-look footage for appearance. Keep the two evidence
   scopes explicit. Root chooses any subsequent artifact/publication changes.

Risks: disabling post may alter exposure/contrast and readability; rendering the
world pass directly may expose viewmodel depth behavior needing verification.
This is a reversible local test plan, not a claim that the reduced pass chain has
already booted or improved performance.
