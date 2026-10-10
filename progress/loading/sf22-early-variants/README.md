# SF22 early visible variants

The exact-source Simulator diagnostic on `7eb7bc08c` identified all 16
remaining route draw-time shader calls: 4 far-proxy, 2 volumetric-scattering,
8 layered dome/cloud/planet/ring, and 2 sword calls. This diagnostic uses
stacks and native program queries and carries **no cadence credit**.
Raw evidence: `/private/tmp/claude-501/sp-builders/sp-x5/sf22-approach-proof/attempt-7eb-safari-exact-owner.json`.

The separate volumetric march was compiled against the caller's canvas, then
drawn into its half-float target. Output colour space / tone mapping are
program-key inputs even for its raw shader. `warm()` now borrows the actual
march target, restoring the caller target on success or failure. No shader,
uniform, target format, frame clock or rendered pass changes. The focused
fixture checks the actual effect's owned target and both restoration paths.
Matched cadence / compilation remains open; no new performance pass claimed.


The layered sky now prepares its final attached materials against the actual
page lights / composer target before registering visible frame weight on
WebKit. The dome, clouds and planet retain their original geometry, material,
blend parameters, uniform identities and render order. Chromium retains its
existing preparation path. Ownership cleanup is registered before preparation:
retirement or failure releases the admitted sky instead of exposing it.
Focused fixtures cover ordering / retirement and the limited material
inventory against unchanged page lighting. A matched route is still needed
for performance credit; this scheduling slice adds no shader or look variant.
