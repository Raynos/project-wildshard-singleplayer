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

Open: remaining BR-1 herd,
wind-stooper and stalker consolidation; BR-2 through BR-5. This slice does not claim whole BR-1 completion.

## Guardian authoring and native admission

`kind: 'guardian'` with `pattern: 'interior' | 'perch'` is an additive strict data spelling, in format/brains.
The old no-pattern interior and `perch-hunter` rows remain unchanged. Each branch reuses the old field validators
and the exact old ordered-range predicate. Canonicalization runs the existing parser to retain legacy key order and
policy-contract bytes. The full-schema creature host and species catalogue both select the original native recipe
and family before preflight; no other pattern's fields or arbitrary runtime reference is accepted.
The SDK's `guardianPattern(data)` is author-only. JSON Schema emits the new root and both branch admission checks.

Proof: 74 focused tests across six files green (7.13 s), SF45 coverage 100% and 91 format JSON roots;
root/layer strict, touched typed lint, ratchet and hooks green. Seven 10k-tick captured traces now additionally
match the authored-pattern species catalogue; complete factory snapshots match the legacy spelling, and a legacy
save restores into patterned rows without any callbacks before an exact 1000-tick continuation. Every invalid
or cross-pattern declaration refuses at the full-schema boundary. All four native recorders actually re-recorded
in 15.7 s with payloads and outcomes byte-identical. No manifest committed. Same layer pairs; game→format +2
bindings and SDK→format +3 bindings under the standing approval. No new package exports.
