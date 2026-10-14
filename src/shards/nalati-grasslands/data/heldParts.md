# Held ranged presentation rows

These are authored programs in heldPlayback.json, not generated output.
All inputs are copied observations; channel bindings own only the private
weapon model transforms. The original weapon action clock remains authoritative.

Pine: crossbowParts slides and reveals the loaded bolt from reloadProgress
(the reveal threshold is 0.8); spring/string physics remain native.
leverParts reads open, hammer readiness and per-round reload phase: the lever
and bolt follow open, the hammer follows its current angle at 18/60 per second,
and the cartridge approaches the gate over 0–0.45 then pushes through 0.45–0.8.
The existing grip kernel reads the resulting cartridge position afterward.

Nalati: magazineParts drops the original magazine at 0.05–0.30 progress,
hides it through 0.60, and returns it over 0.60–0.85. The rack follows a sine
at 0.88–1.0, publishing the same z channel to the handle and bolt.
The six magazine root programs retain each previous visual axis in local 0
and a first-frame latch in local 1. They combine hip, sprint, reload, breathing,
walking bob, view lag, recoil, portrait framing, the native ADS solve and
holster, then follow the target at min(1, frameDelta * 16).

Numeric node indices only refer backward inside each program. Operation names,
read names, program IDs and transform channels describe the authored arithmetic;
coefficients and smoothstep key ranges can be edited here without a generator.
Do not change hand holds or action clocks in these programs.
