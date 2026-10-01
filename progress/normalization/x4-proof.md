# X4 animation proof

Parent `875b82f63c293114664b13a5f67777cc566461fc` → consumer `126f33478521d4f6e7fa89e3aadb41515eade8fd`.

Four phone captures boot with zero errors. Direct parent/final comparison reports zero changed fingerprint fields. All 12 pose call/triangle counts and creature boxes match exactly. Shader program counts stay Driftwood95, Pine109, Nalati100, Nine67; geometry/texture counts match. The12 images pass SSIM≥0.99 (minimum0.9910857 at Driftwood beach), using the parity harness's7×7 luma-window/sample-covariance algorithm offline with both frames' creature masks. The beach before/after frames were inspected; no visible change was found. No wave-board item is needed.

Both commands exit1 against historical baselines because those include pre-X4 normalization deltas; this proof compares these two captures directly. No baseline was changed.

```sh
node scripts/parity.mjs --export=875b82f63c293114664b13a5f67777cc566461fc --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses --out=/private/tmp/e357-x4/parity-before
node scripts/parity.mjs --export=126f33478521d4f6e7fa89e3aadb41515eade8fd --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses --out=/private/tmp/e357-x4/parity-after
```

[Measurements](x4-comparison.json), [before](x4-beach-before.jpg), [after](x4-beach-after.jpg). Full capture JSON/JPEGs: `/private/tmp/e357-x4/parity-{before,after}/`. Focused committed-export tests:119 across6files; owned type-aware lint and clean-export gen/tsc/ratchet green. Mixer ratchet baseline `f24b2976` contains zero sites.

Disposable X4 clean exports are deleted. Cleanup of the capture-created parent cache was rejected by dcg's home-path policy: `/Users/raynos/.cache/wildshard-parity/b8e31c8a4b6564a7a8fb708cd0b67d239c98a8a746246946806e2a1bb40acadf`. It remains for lead cleanup; final capture reused the lead's ready cache.
