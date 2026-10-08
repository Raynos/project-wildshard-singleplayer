# Pine compressed-2D upload: matched fresh-device counterfactual

**Baseline 5/5 settled, fixed 5/5 settled; zero GPU losses in either arm.** No boot losses, unresolved outcomes, upload-trace overflow or page errors. Every entry held the same document through the 20-second Pine settle and ended with a zero unload leak census. The known baseline crash did not reproduce here, so this cohort **does not demonstrate a crash-rate reduction** or establish absence of future failures.

Baseline `b24f8c36b31f40d6584e3639209a0b401c69c844`; isolated fix `edd757a1fdda21d06c36d16c76d878fd3bac59c5` has that sole parent and exactly four changed paths: precompile, shader patch registry, Pine crags and the focused injected-texture fixture. Main fix is `6a7e0c278f3c97d1c791be8bef46b2df5db39057`. The isolated arm excludes the subsequent late-upload queue. `protocol.json` retains exact runtime blob IDs, HTTP/disk build identities and twelve frozen harness fingerprints.

Five newly created Simulator devices per arm, alternating baseline then fixed, with no adopted, replaced or excluded trials. Developer ON, phone tier, portrait, render scale 2, mute; cold Safari and cleared origin storage/cache/service workers. Each uses the existing Driftwood road-to-Pine first-crossing diagnostic and bounded raw storage/stack capture **ON in both arms**, matching the prior compressed-array counterfactual protocol. Command: `scripts/browser-lane.sh --max 45 node <archived-driver.mjs>`; workers invoke the existing soak runner through `sim-lane.sh`. Short workers intentionally exit 1 because they do not satisfy the 30-minute/full-catalogue gate; connected-canvas loss and explicit settled-entry witnesses determine the entry verdicts. The enclosing driver exited 0 after all ten workers closed.

| Pair | Baseline entry | Fixed entry | Baseline crag-map storage span (ms) | Fixed span (ms) |
|---|---|---|---:|---:|
| 1 | settled | settled | 0 | 67 |
| 2 | settled | settled | 0 | 67 |
| 3 | settled | settled | 0 | 67 |
| 4 | settled | settled | 0 | 67 |
| 5 | settled | settled | 0 | 66 |

The same three crag textures appear in every attempt, all 512x512 compressed 2D: `mossy_rock/diffuse-bf493a74.ktx2` (ASTC 6x6 sRGB, `0x93d4`), `mossy_rock/nor_gl-bcd9bcf8.ktx2` (ASTC 6x6 RGBA, `0x93b4`), and `mossy_rock/arm.phone-ebb00dd2.ktx2` (ETC2 RGB8, `0x9274`). `analysis.json` retains their exact asset labels, texture identities and first storage records per attempt. These spans measure first storage notifications, **not upload duration**; a zero span means the same observer timestamp. Bounded stack sampling did not select these exact three texture operations in any trial, so there is no per-texture call-stack claim. Raw notifications are not literal GL call counts or transferred bytes.

The fencing mechanism is witnessed: baseline issues all three first storage events at one timestamp; fixed separates them by two painted-frame intervals. The source change explicitly registers the `pine.crag` closure maps, captures actual texture-valued shader uniforms during compile, recollects after compile, and warms each compressed 2D/array with a painted-frame / `initTexture` / error / painted-frame fence. The preceding failed long soak and native compressed-2D fault remain recorded in [the failure receipt](../b24f8c36b-dev-subset/README.md); this cohort does not replace that failure.

Memory remains separate and unresolved. Recorded WC + labelled live GL peaks range **819.658–993.806 MB** on baseline and **989.612–1,309.544 MB** on fixed. Fixed04 completed despite its **1,309.544 MB** entry peak and **1,466.598 MB** loading peak. The fixed arm gets no native-memory saving or cap clearance. All original `memoryPass:false` and `gatePass:false` grades are preserved; GPU-process footprint stays separate from WC + live labelled GL. Cold page PIDs replaced before the connected game are retained in native logs, not reclassified as entry losses.

`archives.json` records ten Brotli JSON containers preserving eight original UTF-8 files each (80 raw files), both exact injected fixture blocks, the driver and the full summary. Total compressed bytes: **2,050,806**. All raw and archive SHA-256 hashes were round-trip checked. Decode with Node `brotliDecompressSync`, then `JSON.parse` for JSON containers. Every device ID, native sample, storage notification, sampled stack, command log and unchanged grade is retained.

All Safari / Inspector / proxy / sampler workers closed; Simulator 0/1 and browser lane 0/4 verified on release. This is Developer-only diagnostic evidence under G233: no public-grid, phone-cap, native-saving, full-catalogue or 30-minute SF57 claim. The current-origin light-observer/raw-OFF rehearsal and 30-minute retry remain open; other-layout and road-only coverage remain open too.
