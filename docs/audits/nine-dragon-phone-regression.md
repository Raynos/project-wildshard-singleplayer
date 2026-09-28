# Nine Dragon physical-iPhone regression — E256

2026-09-28. Investigation remains open; instrumentation is not a crash fix.

Jake confirms Nine Dragon worked on his physical iPhone during the Opus work and regressed after the handoff. Simulator success does not validate the physical phone GPU or memory budget.

## Evidence

- Pre-handoff checkpoint: `7a339ed2838e99bcae43636dbd1346b15cc5191a`, deployed as `7a339ed-mui4yqk8`. GitHub run `36230215574` identifies the original immutable deployment. A 24-hour deployment-scoped share link was supplied in chat for an exact phone control. Access token kept out of the repository. Exact good endpoint awaits Jake's test.
- E199 / `988c28ea` documents Opus stopping at its usage limit with WIP left in the shared tree. Model attribution comes from this handoff record, not Git authors (all Jake).
- E200 already recorded double loading before facade batching (`51cf6c83`) and practice (`ce1305ac`) shipped. Those additions cannot alone explain that earlier report.
- Sentry WILDSHARD-GAME-5: three abrupt first-frame reports on `324e4c8`; last durable point firstFrame 95%, no caught JS exception or native termination reason.
- Physical screenshot matches inbox `2026-09-28T12-13-14.322Z-cfab1f9b`: on `7d6a2af-mul7ckvn`, 2,466 ms into startup, Three.js WebGLCapabilities dereferenced a null shader-precision result while constructing WebGLRenderer. The world did not exist yet. This may be secondary to the preceding GPU failure, not its original trigger. It reached `/api/errors` but was absent from the Sentry listing at investigation time.
- No connected physical iPhone was visible to devicectl. The simulator compressedTexSubImage2D SIGBUS (E248) is a different observed failure; do not conflate the causes.

## Changes audited against the checkpoint

| Change | Finding |
| --- | --- |
| `8062b4ef`, `2bb24342`, `91084292`, `63e2058e` | PWA selection, document shard switches, title-first loading and GPU error handling changed. Original failure report predates these mitigations. |
| `2429aacf` | Shipped handed-over streak-card vertex culling and its missing uniform declaration. Earliest changed shader after checkpoint; no native-device causal proof. |
| `03b04b67`, `14412b97`, `13af1124`, `f962b730` | Added grapple, three instanced cast hooks, rope/FX and claw geometry. More resources; no evidence singles them out. |
| `51cf6c83` | Facade large pieces changed from InstancedMesh to BatchedMesh with WEBGL_multi_draw and new shader texture reads. Hardware-dependent path; now recorded in diagnostics. |
| `ce1305ac`, `b70ae6b9` | Arena and dummy assets/catalog added. Hidden arena participates in boot preparation. |
| `75e2c2c6`, `291d7ddf`, `95489b45`, `80b49381` | Paint relocation, smaller phone textures, serial image decode, released arrays and sliced geometry conversion. Reduced nominal allocation does not prove native stability. |
| `2d79732a`, `65faa7b1`, `9c716097`, `427cd5e7` | Image default, fewer post passes, deferred audio and next-launch rescue improved Simulator; physical crash persisted. |
| `7d6a2afc` | Spawn cull and no four warm turns. Subsequent physical report failed at renderer initialization; no successful phone gate. |

## Remote debugging loop

Synchronous boot-only checkpoints surround renderer creation, compilation, culling, world draw, each composer pass and the next animation frame. Submitted does not mean GPU completion. Keep 32 records, with no gameplay-frame recording. Save changing progress details even within the same percentage bucket.

Snapshots contain canvas dimensions/DPR, texture/geometry/program counts, draws/triangles, selected texture setting, multi-draw support, context-loss state, browser UA and JS heap where available. Safari heap is null. These are not total-process or GPU memory measurements.

Next launch sends the prior trace to Sentry structured context and the first-party error inbox. Handled errors carry the same diagnostics. Inbox gets the newest eight checkpoints to fit its 16 KiB limit and uses the existing offline queue. No storage dump, auth data, screenshot or replay is sent.

Regression tests inject shader failure and a null precision result, intercept both report destinations, and require evidence, one loader, a fatal modal and no automatic navigation. Unit coverage includes restart, intra-percent details, bounded history, pass failure/restoration, planned exits and ready state.

Next: test preserved pre-handoff deployment on the phone, then narrow deployed revisions using that result. Keep E256 open until current Nine Dragon loads and enters on that phone.

## Relevant commit inventory

- `903d66e0` Title deck: the Nine Dragon Stack COMING SOON art re-shot from the in-engine partial shard (Jake: "update the hero images in the carousel for coming soon too") — the hero + card from the spawn (mockup A's camera), and the carousel: the Yamen Well's edge and down the Well (free camera just out over the rim), the stair-street (mockup C's camera), and crossing the Well from the bridge mid-shaft; the clean-room slides "canyon up" and "gold on indigo" retired. Captured from the exact checkpoint-3 build (free camera, no HUD, no viewmodel); checked on a production build at iPhone size: hero, card and slideshow in step, no errors
- `8062b4ef` Remember last shard for PWA launch
- `7eb0f72c` Show portrait empty state for unregistered models
- `2429aacf` Fix Nine Dragon card shader vertex uniform
- `2a1393be` Register placed Nine Dragon GLBs in Model Explorer
- `fcd49d9d` Contain Nine Dragon fragment with safe floor recovery
- `03b04b67` Add playable Fei Zhua zip to Nine Dragon fragment
- `473ea97e` Round the Nine Dragon Well balustrade rail
- `9398ace0` Add tea verandas to Nine Dragon upper stair
- `14412b97` Place Fei Zhua dragon hook sculpt in fragment
- `51cf6c83` Batch Nine Dragon facade details when multi-draw is available
- `13af1124` Port Fei Zhua rope effects and safe miss cycle
- `f962b730` Give flying Fei Zhua claw a three-talon silhouette
- `283640f9` Keep Model Explorer variants above portrait detail sheet
- `ce1305ac` Add shared portrait practice arena and training dummy family
- `f5f4d5cd` Remove invisible practice target shadow draws
- `5dac1755` Batch practice target details and link current trailer review
- `75e2c2c6` Move Nine Dragon painted textures to production paths
- `95dfcba9` Version relocated Nine Dragon painted textures
- `a9137f1f` Match generated Nine Dragon asset version order
- `2bb24342` Reload the page for cross-shard navigation
- `76a2f265` Always launch Driftwood from the PWA root
- `291d7ddf` Cut Nine Dragon phone boot memory and release build buffers
- `511893cf` Make standalone shard URLs recover to Driftwood
- `2085d199` Defer Nine Dragon audio and art decoding past world build
- `88d9b99e` Recognize fullscreen iOS PWA for safe shard URL reset
- `91084292` E222 show title before loading a shard
- `95489b45` E224-E227: cut Nine Dragon phone memory and Props stalls
- `4dd6c84f` E227: version Nine Dragon phone textures for offline cache
- `0db14c9e` Add compact shared training dummy meshes and bake scripts
- `b70ae6b9` Load shared training dummy variants in arena and Model Explorer
- `624cab78` Add lightweight portrait art for each shard loader
- `63e2058e` Enter shards once and surface Nine GPU boot failures
- `80b49381` Speed up Nine Dragon paint loading
- `3cef2b11` Keep only selected shard title art decoded on phones
- `240107cc` Use static image comparisons across World Explorer
- `2d79732a` Use image textures for Nine Dragon phone Auto while isolating WebKit crash
- `65faa7b1` Reduce Nine Dragon phone render targets during boot
- `9c716097` Add deferred serial audio preload for Nine Dragon phones
- `427cd5e7` Defer Nine Dragon phone audio and rescue interrupted boot
- `4fdcca55` fix: make practice dummies human-sized solid lock targets
- `f5b98c94` fix: remove practice arena banner
- `7d6a2afc` fix: cull Nine Dragon before phone first frame
