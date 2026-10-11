# SF82 BR-1: parametric guardian core

The `interior` and `perch` patterns share one `GuardianPolicy` admission, step fence and continuation owner.
The existing `GuardianBrain` and `PerchHunterBrain` constructors and defining paths are presets. Actor memory
remains the mutable state owner; native rise/sink, drop/climb, projectile, reach and token recipes remain unchanged.
The perch policy retains the separately owned shared attack RNG. Original state integers and tuning-contract JSON
field order are preserved, including raw-spec versus schema-admitted key order.

`test/fixtures/guardian-oracle/` captures both shipping policy bodies before extraction, with source commit and
SHA-256 in each header. Only relative imports and class names change in those independent oracles.
The two engine tests compare captured, catalogue-preset and direct parametric policies by ordered actor-frame
SHA-256, plus contacts, sounds, attack starts, splash/projectile recipes and both RNG streams. Three interior and
four perch scenarios each run 10,000 ticks. Six in-flight restores keep the old contract bytes, draw no RNG and
publish no body callbacks, then reproduce the exact remaining trace. Wrong-pattern and invalid-step requests
refuse before actor or RNG mutation; zero-step interrupt wakes remain accepted.

Proof: 24 focused tests across four files green (3.64 s); root/layer strict, touched typed lint, ratchet and hooks.
All four native witness recorders pass; three stale fences actually re-recorded in 12.6 s with payloads and outcomes
byte-identical. No input-only manifests are committed. No new layer pair; one defining engine export
`./ai/guardianPolicy`, documented in ENGINE.md. No collider, presentation or encounter changes.

Open: parametric guardian authoring/full-schema rows and their native-body adapter; remaining BR-1 herd,
wind-stooper and stalker consolidation; BR-2 through BR-5. This slice does not claim whole BR-1 completion.
