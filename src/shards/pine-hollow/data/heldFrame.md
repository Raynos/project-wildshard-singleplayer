# Pine held-frame rows

`heldInputs.json.frames` is authored presentation data consumed by the existing
`HeldPlayback` numeric input/output bindings. Each weapon evaluates its frame
programme once after `RangedFrame.sampleFrame`, before sight and root pose.
Action clocks, string spring, contacts and flight remain outside these rows.

Both programmes keep two private locals, initially zero: sprint and reload
presentation blends. Sprint approaches its boolean observation with
`min(1, delta * 7)`. The crossbow approaches
`reloading ? sin(min(1, reloadProgress) * PI) : 0` with
`min(1, delta * 10)`. The lever approaches its reload observation with
`min(1, delta / (loading ? reloadIn : reloadOut) * 2.2)`.

Portrait is `aspect < 1 ? min(1, (1 - aspect) * 1.6) : 0`.
ADS is the original clamped smoothstep; scale is
`hipScale * (1 - portrait * factor)` with factors 0.55 / 0.14.
Outputs x/y/z/value/scaleX publish sprint/reload/portrait/ADS/scale into
private frame fields; these channel names never refer to world coordinates.

Node endpoints (zero-based; named inputs and outputs remain in the JSON):

- crossbow: sprint = 10, reloadTilt = 24, portrait = 31, ads = 43, scale = 48.
- lever: sprint = 10, loadBlend = 22, portrait = 29, ads = 41, scale = 46.

The root pose programme publishes its uniform scale at the original pose
phase, immediately before its root translation/rotation outputs.
