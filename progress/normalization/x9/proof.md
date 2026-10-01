# E357 X9 — travel and title summary

Source: `c9f4d8c4` (data contract) and `fe7d97f5` (wiring, public ports, title A/B).
Production remains pinned; these builder commits were not pushed.

## Title Look board

Actual 390 × 844 captures of clean committed `fe7d97f5`, served as a build.
All three JPEGs were inspected after conversion.

- [Fresh title](title-fresh.jpg): no shard progress documents; summary hidden.
- [A, default](title-a.jpg): one shard per row.
- [B](title-b.jpg): two columns.

A/B use saved-progress fixtures only: Driftwood has two earned feats and 240 playS,
Pine has three and 620 playS; Nalati and Nine Dragon have no progress documents.
Global summary was removed before reload, so the title rebuilt these lines from
per-shard saves. Totals are unknown until played. No DOM was changed for captures.
Both variants are live through Debug → Look → Title summary; owner E357,
reviewBy 2026-12-30. Look acceptance and the title DOM baseline belong to the lead.

## Checks

- Eight focused files / 33 cases passed: X9 travel, summary, title summary;
  title deck/arrival, save persistence, Debug options and shard plugin.
- Seventeen X9 cases pass, including actual scope-bound item row registration,
  origin removal and target Bag addition, expiration/wrong target, persistence
  failure, read-only corrupt saves, summary reconstruction/export and known totals.
- Committed build `fe7d97f5`: real title ENTER on all four shards resulted in
  `hud.entered === true`, correct boot slug and a consumed (`null`) travel handoff.
- Cold title EXPLORE Nine Dragon opened `.ws-x` at `explore=hub`, handoff consumed.
- A saved session handoff fixture with mode `arena` opened Nine Dragon with
  `arena.entered === true` and `hud.entered === true`, handoff consumed. This checks
  arrival consumption; it does not claim a practice navigation click.
- All old switch/arena names are absent from `src/`.
- Gate `affb0233`: CSS/gen/gen-check/typecheck/API/oxlint/ratchet passed; full vitest
  stopped with 14 failures, 1874 passes, nine failing files. Lead's V1 owns full
  suite repair. Earlier gate `72fb9115` had only ranged.ts layer ratchet remaining;
  that rise is absent from the later gate. No gate was weakened.
- Browser `e357-sol-x9` closed; its foreground preview stopped; no preview remains.

## Narrow own-before parity

Before `db7d0f1bab2e061aa62dd1123a3226b756614669`, after
`fe7d97f5b775337e06694a5cd743430e6e33f250`. Both runs used:

```sh
scripts/browser-lane.sh --max 15 node scripts/parity.mjs --export=SHA --lane=m5 --shards=all --tiers=phone --only=fingerprint+poses --out=/private/tmp/e357-x9/before-or-after
```

Raw snapshots and 12 pose images per run remain under `/private/tmp/e357-x9/`.
[Direct comparison](direct.json) applies X9's rename map, omits each report's
existing verdict/fields metadata, and recomputes image SSIM against the own-before
JPEG, using the union of before/after creature masks. Verdict is **red**, not an
approved baseline. Concurrent S2/S3 commits landed between these source points.

| Shard | Direct pose SSIM | Other differences |
|---|---|---|
| Driftwood | pier .999946, beach .999998, wreck 1 | save reads only |
| Pine | gate .999998, cabin .999505, pond .998672 | systems, colliders 2409→2417, textures/GPU |
| Nalati | camp .961142, bridge .917800, plains .924472 | mesh +1, programs 114→102, calls −20, textures/GPU |
| Nine Dragon | spawn rail .984521, well/stair 1 | audio fault and 404 |

Every shard now reads all four progress documents for summary reconstruction;
this is the intentional X9 save fingerprint addition. Other differences were
reported to the lead rather than accepted or hidden. Nine Dragon's capture fault:
`shard.nd.audio` reassigns an AudioBufferSourceNode buffer (InvalidStateError), plus
one failed resource response. Driftwood, Pine and Nalati have empty boot errors.

Next, lead: resolve wave differences/audio fault, accept Look A/B and then run
the full two-tier parity batch; rebaseline title DOM only after Look acceptance.
