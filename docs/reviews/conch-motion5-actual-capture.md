# Conch motion5 actual capture and mounted attempt

Recorded 2026-10-19. **Unaccepted diagnostic evidence; required coverage incomplete.** No source, QA script, pin, host, Site, Git or remote changes were made by this lane. The motion4 public host remains untouched. Original evidence and both failed attempts are retained.

## Actual capture

- Run: `tmp/conch-motion5-qa/actual-run1`; 2026-10-19T14:16:46.124Z–2026-10-19T14:25:39.766Z; exit 1, no fatal harness exception. Exact admitted source/product/host identity matched before and after.
- Real native sword combat established Conch-only entry, ordinary/counter and guard, player/enemy damage and defeats, bout-local 3-coin reward, Retry, reload, empty browser/world persistence, all 15 bones and authoritative pose inputs. No page errors. Diagnostic player placement and observer camera are disclosed in the report; no health/enemy/time/RNG injection.
- 17 complete sampled ordinary cycles, 1 counter cycle, 174 clock-zero stun samples and 12 repeated hits while flinching. These are sampled phase sequences, not every simulation tick.
- Collision-qualified late windup, ordinary active and recovery are present. Guarded .10, guarded .20 and counter preparation .215 are **not observed**; finite failed trials do not establish unreachability. The known .36631255398-rad guarded .20 source regression remains untested in actual contact.
- `stopResumeObserved=false`: the stop phase has only two rendered samples, both speed .85; approach/resume likewise .85. No genuine stopped sample was captured.
- `noPostDeathStrike=false`: first dead actor frame 1297 has deathT=0 but the last evaluated pose is living (deathT=-1) and StrikeRunner remains recover. Frame1298 has stage5/deathT=.125 and idle strike. No player HP loss occurs across the80 dead samples. This is retained as an actual failure, not relabeled passing.
- Lethal onset happened in recovery, behavior clock1.2, not the requested active phase. The first rendered dead-pose boundary (1297→1298) has rapierArm Y delta 0.5899314048013247rad. The coverage helper's deathTransitions marks actor-alive transition (1296→1297), so those rows alone do not identify the first dead pose. The known .8-rad active-death source risk remains missing. No continuity or death-improvement conclusion follows.

## Fresh contact and encoded evidence

- Fresh exact canonical comparison and all-four-weight world skinning:7338 vertices,94 blended,1654 rendered samples. Minimum geometry height3.0mm; maximum per-frame minimum4.978mm above each queried actual arena floor. Zero frames below−5mm; every frame has some vertex within±20mm.72 settled-corpse samples retain3mm clearance. This is proximity, not collider/foot-planting or visual acceptance.
- Original402×874 portrait WebM: `video/page@cb44d293943a4df9fd5207326d277192.webm`.13012 encoded frames, PTS0–520.440s. Streamed272 complete-portrait8×6 sheets (49,848,410bytes),100×218 thumbnails; padding after the last frame is not evidence. Original movie remains authoritative. No full-frame disk cache was created.
- Every PTS and sheet range/hash is in `streamed-frame-review/index.json`; no human every-frame inspection or score has been performed by this capture lane.
- Actual observed render intervals (1625 same-bout intervals): min5.4ms, median240.4ms, p95653.5ms, max4396.6ms. Encoded25Hz frames include repeats and are not engine cadence. Parent reported Bellback CPU rendering overlap until~14:17UTC and Colossus two-thread rendering from14:20:53UTC; no end timestamp was supplied. This cloud diagnostic gives no phone/Safari/performance inference.

## Mounted attempt blocked

`tmp/conch-motion5-qa/mounted-run1` exits1. The prepared script line29 expects homepage `a[href="conch-engine/index.html"]`, but the current unchanged homepage routes through `arena.html` and contains no such link. The locator timed out after30s, before desktop Start or native-phone checks. No mounted combat/reload/persistence coverage is claimed. Both identities, Site HTML and all four app inventories remained unchanged. Exact error and inventories are retained; no harness patch or retry was made.

## Identity and handoff

- source SHA256: `be09cb6bd1c376099bf4d38edc9fd8f38873c999168f72902cf06279320eab38`
- sourceFreeze SHA256: `29f4f09a8c397394c532450aabe4c0b8989088beeb718d37249b5e7106213fc9`
- buildPin SHA256: `3a584795af56adef1d35d4ff3907bc8ac053f481cee43c222775541c27305489`
- hostInventory SHA256: `7a51507bf92abd3af2261785bfcbb87097986a7c8d0613f28bee78ddbff7964b`
- preview SHA256: `346580249b80f84598fe7e3e7781fbf9cdcc284370474a480c12d1becba2cea7`
- video SHA256: `730f29e7f535027eac5e2f1d31022cd9f202ae994c9f65d3219d2989338044de`
- trace SHA256: `09222bae3382ebc4a41c44cf399b9b04f50d6e19870a8a52dd339ae269fef7b5`
- events SHA256: `0c2f4e4d7694ead981b3612d6d533ca42247c167c2d6d5c3a53851852141ef31`
- geometry SHA256: `e7c7ab65d8c8e08cae682f308ac2f5cc060d5f959b34aed05981ba3f6f71bb5e`
- contact SHA256: `3c6226ad246a3a73ef32e3f48f818bbc204b5a145ffbd5cca49fbc3d8270eb00`
- framesIndex SHA256: `b870afd7ca18714a222fc3ff873c692bdf57101835756ae0c60e8b49553cec42`
- actualReport SHA256: `59f655eca6b79f84891f3cf8035f2c783dc28bfdb0eb82aee1af69c064fe151b`
- mountedReport SHA256: `bd0a4ae3d63d38c39bda944b813686d6dfee8ea86195e3c11b3ae113f1e758d0`

Compact machine-readable audit: `tmp/conch-motion5-qa/actual-run1/run-summary.json`. Full render/event/contact/PTS evidence remains there. Disk started at768MiB free and ended near600MiB; no previous evidence was deleted. Fresh independent frame/contact interpretation and any further run need separate preserved evidence; this report does not authorize publication or acceptance.
