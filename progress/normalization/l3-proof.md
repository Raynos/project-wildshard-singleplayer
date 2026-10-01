# E357 L3 — scope disposal failure proof

Source tested: `6d13ef8f69996c5b03cb023e21e8b3eb91462ab9`, m5, phone, 2026-10-01.

## What failed and what changed

On `21f2ecd0`, Nine Dragon's narrow walk/combat/unload check reported five `AudioScheduledSourceNode.stop` failures because the sources had never started. An earlier `shard.nd.audio` fault identified the cause: `AmbienceBeds.loopVoice` assigned a non-null buffer, then `loopAt` assigned it again. WebAudio rejects the second assignment even when it is the same buffer. The permissive old node fake missed that rule.

- `21f2ecd0`: Scope's AggregateError message includes all inner failures. Probe returns `disposalErrors` alongside the post-unload census; parity emits unquarantinable class-D rows for normal and weather disposal errors.
- `220217d0`: `loopAt` owns the sole buffer assignment. Failed positional and zone loop starts disconnect their graphs and release sound/listener ownership immediately; an unstarted source is never stopped. Strict WebAudio tests enforce both rules, range exit, and repeated disposal.
- `af57bf56`: empty AggregateErrors remain failures; parity logs HTTP failure URLs.

## Verified

The four commands used `scripts/browser-lane.sh --max 15 node scripts/parity.mjs --export=6d13ef8f69996c5b03cb023e21e8b3eb91462ab9 --lane=m5 --shards=<slug> --tiers=phone --only=walk+combat+leak --retry=0 --out=/private/tmp/e357-l3/proof-<label>`.

| Shard | Build | Leak thresholds | Disposal errors | Scratch label |
|---|---|---|---|---|
| Nine Dragon | 6d13ef8-mupijlw6 | 28/28 green | [] | nd |
| Pine Hollow | 6d13ef8-mupijlwk | 57/57 green, including fresh rain | [], weather [] | pine |
| Nalati | 6d13ef8-mupijlw9 | 57/57 green, including fresh storm | [], weather [] | nalati |
| Driftwood | 6d13ef8-mupijlwj | 28/28 green | [] | driftwood |

Every unload returns all level-owned counts to B0. [l3-leak-proof.json](l3-leak-proof.json) keeps every leak threshold and census; full parity reports remain in the scratch folders above. All browser contexts and preview processes closed when their commands finished.

49 focused scope, probe, parity comparison, positional-loop lifecycle and audio-profile tests pass. On a clean Vercel export of the tested source, generation, `tsc --noEmit`, whole-tree oxlint, CSS and Vite build pass; logs are `/private/tmp/e357-l3/gates/`.

## Work outside L3

Overall narrow parity remains red on other migration rows (system names/order, saves, audio/registry/look differences); the JSON lists the other red fields per shard. The full Vercel gate on this source passed CSS, generation, app/API types, lint and ratchet, then stopped on 14 test failures in 9 unrelated fixture files; V1 owns that full-suite fix. L3 does not claim a green overall parity run or full test suite.

An intervening `main.frame → engine.player.regen → engine.player.hud` dependency cycle prevented all four boots on `220217d0`; S2.1b fixed it in `75810729`, before the successful source above.

Failed-HTTP logging reproduced `/api/errors` on that older failed boot (`http://127.0.0.1:56287/api/errors`). The successful Pine and Nalati runs also request `/api/telemetry` (ports 55782 / 55788); Vite preview has no API backend. These URLs were reported to the lead without suppressing the errors or weakening parity.

No design choices guessed. Production remains pinned; the lead owns push and the full integration batch.
