# G172 Driftwood default and G180 Pine memory (SF22a, E435)

Driftwood's new default is below the unchanged 1,000 MB proxy: **678.378 MB play / 687.831 MB Explorer**. Pine's cold Auto path with memory trim ON is **over**: **1,114.671 / 1,112.836 MB**. Forced KTX2, measured as a separate native composition, is below: **916.324 / 926.056 MB** with the full-pose GL census. All are Simulator WebContent plus labelled desktop GL, not a physical-phone cap pass or a whole-grid measurement.

| Source / pick | Native play median [cold range], MB | Labelled GL, MB | Play / Explorer median + GL, MB | Explorer native phase high + GL, MB |
|---|---:|---:|---:|---:|
| Driftwood G172 `fe508c172`, default | 473.878 [471.813–477.024] | 204.5 | 678.378 / 687.831 | 714.5 |
| Pine G180 `3f8409900`, trim ON, cold Auto | 591.171 [589.615–596.758] | 523.5 | 1,114.671 / 1,112.836 | 1,126.5 |
| Pine G180 `3f8409900`, trim ON, forced KTX2 | 631.050 [599.380–652.858] | 285.274 full poses | 916.324 / 926.056 | 952.274 |

The forced-KTX2 spawn-only GL census is also retained: 239.1 MB, yielding 870.150 / 879.882 MB. The earlier G180 270.99 MB reference sampled all capture poses on an earlier base, unlike a spawn-only census. This same-pin full-pose repeat reconciles every resource, reports no page errors and accounts 285.274 MB. Its Explorer peak leaves **47.726 MB** under 1,000 MB; the settled Explorer median leaves 73.944 MB. No cap or allowance was raised. The Auto composition exceeds the cap by 114.671 MB at play; do not replace its GL with KTX2 GL.

## Protocol and provenance

Nine runs: three cold Safari restarts and origin resets per case, one Simulator at a time (iOS 26.5, iPhone 17 Pro Safari). Each runs 30 s play and 30 s Explorer; each phase takes the median of three one-second native/Inspector samples. The case result is the median and full range of the three independent cold medians, without dropping outliers. Native phase peaks, Inspector totals and GPU-process RSS remain separate. All build/shard/Debug-pick checks and all zero exit codes pass. Driftwood has no deleted hybrid pick: the lowered world is its only world at G172. Pine seeds only `debug.plugin.pine-hollow.pineMemoryTrim=on`; the matched set additionally seeds global Settings `tex=ktx2` and verifies it after loading.

Every Simulator is shut down before its GL wave. The spawn census uses fresh muted Chromium/Metal, iPhone 16 Pro 390×844@3, phone tier/render scale 2, 15 s settle and 10 s sampling. GL counts buffers, textures/full mip chains and renderbuffers; GPU-process RSS is never added. The full-pose G180 census uses the existing cut-capture tool, no content cut (`{}`), all three capture poses and KTX2; its served build id differs from the native build because the same source pin was built again. Source revisions and both identities are recorded.

## Metadata and findings

Driftwood's shared runtime constant records **473.878 MB WebContent + 204.5 MB GL**, revision `fe508c172` and this evidence. The dated **299 MB** engine calibration remains `91f97bdfc`; it was not remeasured. G144 subtracts and calibrates once: the exact claim is **341,781,982 bytes**, modeled home playing cost **759,378,001 bytes**. Twelve metadata/page-boot/real-platform fixtures pass; assertions keep exact literals, refusal and cleanup. Typed lint passes. The previous G173 receipt remains historical, now superseded for the default metadata.

Cold Auto resolves image textures until the compressed set is cached (`engine/boot/gpuFiles.ts`); therefore the supplied forced-KTX2 reference was not the cold Auto composition. The Pine lane owns the policy fix `bc7181016`; its new Auto cold remeasurement is a separate follow-up. This receipt does not claim that fix is measured yet.

## Reproduce / cleanup

Use `scripts/serve-build.sh --rev <source>` from the scratch folder; then `scripts/sim-lane.sh run --max 35 wildshard-iphone node scripts/sim-memory.mjs --url=<preview> --out=<empty folder> --runs=3 --play=30 --fly=30 --shards=<slug>` with the above picks. After Simulator shutdown run `scripts/browser-lane.sh --max 12 node scripts/crossroads-rig/desktop-probe.mjs --base=<preview> --shard=<slug> --settle=15 --out=<gl.json>` and identical picks. The full-pose command is the existing `progress/shard-platform/g180/cut-capture.mjs <preview> <out> <label> '{}'` through browser-lane. `python3 aggregate.py <evidence-folder>` reproduces raw measurement rows; summary adds the receipt/provenance and full-pose comparison.

Raw native/Inspector JSONL, plan/report/table files and labelled GL ledgers are retained. Incidental device/session telemetry is omitted; images and phase scratch files are discarded. All owned resources for these cases closed; fixed-Auto follow-up is a distinct run.
