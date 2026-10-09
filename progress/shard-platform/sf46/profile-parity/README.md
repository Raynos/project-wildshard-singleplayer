# Driftwood profile-ledger parity refresh

The profile save key introduced by `3e995e5a2` is intentional: C26 moves Driftwood facts/counts into the same SF14
emitting ledger. Boot reads `wildshard.save.v2.profile`; combat checkpoints write it. The migration/refusal/rebind
contracts preserve inventory, flags, coins, title and metadata without a second grant.

Official records, **nine full-profile captures**, all green:

- M5 phone + desktop, three per tier, pinned `16728f1c6f1d0cd7f29162d4ea2560909680ecf1`,
  `node scripts/parity.mjs --record --runs=3 --lane=m5 --shards=driftwood-isle --tiers=phone,desktop --url=<pinned preview> --jobs=1 --retry=0 --timeout=400`.
- gh-macos15 phone, three captures, content `584c24d611397c4af695a6caaa4aeeac3b4a44ab`,
  [official run 37865888684](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/37865888684).
  Only its Driftwood artifact is accepted, byte-for-byte; no other shard's artifact is copied.

Only the two save fingerprints above differ on runner/phone. M5 desktop also selects bird/drip instead of drip/swell
in the ambient window: the existing seeded ambient scheduling class documented by parity triage, not a changed event
multiset or missing sound system. No comparison rule, ceiling, quarantine or assertion changed.

Minimum self-SSIM is **0.99327451** on M5 phone and **1.0** desktop. All nine old/new pose comparisons exceed .99
(minimum .99108441, runner beach); exact scores are in `image-scores.json`. Walks have zero stuck legs; boot errors,
disposal errors, bodies, colliders and adjusted resource/listener deltas are zero. Combat and pause/resume pass.

`receipt.json` hashes every accepted baseline/image and raw/settings capture. The raw captures, settings, full reports
and timings are preserved compactly. M5 images are the official first captures; only CLI-owned shot paths differ in
the recorded JSON. The shared M5 metadata was restored to its pre-record bytes; no other lane's recording was replaced.
Signal Dunes baselines are untouched. All owned browser/preview resources are closed.

Plan-State: unchanged.
