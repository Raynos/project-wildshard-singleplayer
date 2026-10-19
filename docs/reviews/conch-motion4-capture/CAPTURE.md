# Conch motion4 capture

## Exact executed product

- Isolated immutable app: `tmp/conch-readable-preview-dist-build2`.
- Product source hash: `e41d1e7600a94074384a00fca22b58f634c060f5eb0458c5d34ec2bf44db6cb8`.
- `build-manifest.json` pins all 137 app files. `executed-provenance.json` verifies they remain unchanged and every source-freeze input is unchanged.
- Embedded build pin is the preserved `tooling-attempt2/reviewed-build-pin.json`, SHA `7c929ab05053e8541a38219f066c05fea4e0f9c98cf072cbe288116fe1168a2d`. It is not the later capture-tooling pin. No runtime product is relabeled.
- Later changes are candidate/argv typing guards and capture tooling only. Run2 adds a non-intercepting diagnostic overlay and explicit active-interruption trial. No game, engine, host, decision, animation, native payload or combat value changed.

## Genuine runs and failures

Run1 preserved 3,599 encoded video frames. Ordinary thrust/player damage succeeded, then the diagnostic label intercepted Retry. Full failure, raw stream and video remain preserved. This is a capture UI failure.

Run2 completed with 3,336 encoded video frames and 1,158 complete rendered observations. Twenty-five of 26 functional checks pass, including guard/counter, actual enemy/player damage, enemy death, retained own-death delivery, three practice coins, player defeat, blocked defeated attack, Retry, reload, empty browser stores and unchanged empty world state. No page errors.

The one failed check is `stopResumeObserved`: the original diagnostic moved the target fourteen meters away for “stop,” which causes pursuit. This is not proof of an enemy defect or successful stop/resume. The separately frozen supplemental harness passed all four checks: observed near-target combat stop, far-target resumed pursuit, another stop and zero errors. Its complete 86-render trace, seven events and geometry are preserved whole under `stop-resume/`; its video remains separately pinned. This closes the intended coverage without rewriting the original failed assumption.

All unsuccessful guard and interruption trials remain in the full stream. Trial names describe the requested timing, not guaranteed contact timing: the real event, memory and runner observations establish what actually happened.

## Observation integrity

Read-through wrappers call existing owner methods once and return their original results. They do not inject animation, events, health, enemy state, time, RNG or engine behavior. The observer logs diagnostic player placement and restores its render-only camera afterward. The viewmodel is hidden in the observer recording; this is not a normal player-view visual acceptance capture.

The trace records actual StrikeRunner phase/elapsed/locked lane, current admitted strike spec, actor memory clock, actor transform, all 15 bone local/world transforms, native mesh world/bind transforms, and all bone world matrices. The separately captured native geometry retains every vertex, index and all four weights. The offline analyzer verifies all 7,338 runtime vertices and all joint/weight attributes against the inflated exact native payload before reconstruction.

Pose evaluation has its own index and clocks, including authored `frame.attack`, stage, memory clock, flinch, alive and deathT. Event timestamps are not silently treated as pose evaluation timestamps. The observer never calls animate to manufacture a damage-time pose.

Twenty actual hurt requests were observed in run2, including the queued counter and late lane entry. Nineteen use a previous pose with rapier tip approximately −9.44 mm from the actual locked lane center. One counter callback in the idle-interruption trial uses a 100 ms-old pose at memory clock .3: its tip is +.926 m lateral. The same frame's next render, only 2.6 ms later, evaluates clock .4 and shows the player at 84 HP. This callback-time stale-pose observation does not alone establish a visible off-lane damaged frame. Independent review must compare the previous encoded pose, exact damage observation and first subsequent rendered pose.

## Preservation and acceptance

All whole JSON files at or below 5 MB and phone stills are preserved under `run1/` and `run2/`. Oversized complete trace streams and original videos remain intact at the source directories named in each evidence receipt for native Site source protection. They are not divided into chunks or archives. Every media/stream receipt includes exact byte count and SHA-256.

Video timestamp metadata comes from ffprobe. Burned-in frame/game-clock labels provide anchors; no invented one-to-one video/render mapping or guessed recording-start offset is asserted.

Source admission, product receipt and capture summaries retain visual/runtime acceptance false. This report does not award a motion score, physical-phone performance acceptance, human-fun acceptance or production promotion. Independent complete-frame review and mounted verification own their findings.
