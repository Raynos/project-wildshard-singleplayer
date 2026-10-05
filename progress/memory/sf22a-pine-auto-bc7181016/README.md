# Pine G180 cold Auto after the KTX2 policy fix (SF22a, E435)

The fixed cold Auto path at `bc7181016`, with Pine memory trim ON, is below the unchanged **1,000 MB** standalone composition proxy: **919.537 MB play / 926.271 MB Explorer**, using three cold native-run medians plus the full-pose labelled GL census. The transient play high is **982.276 MB**, just **17.724 MB** below the cap. This is Simulator WebContent plus desktop labelled GL, not physical-iPhone cap evidence, and it leaves little room for grid neighbours or platform residency.

| Cold Auto | Native median [full cold range], MB | Spawn GL, MB | Native + spawn GL median, MB | Native + full-pose GL median, MB |
|---|---:|---:|---:|---:|
| Play | 634.262 [603.099–650.613] | 239.1 | 873.362 | **919.537** |
| Explorer | 640.995 [613.913–662.655] | 239.1 | 880.095 | **926.271** |

Full-pose GL is **285.276 MB**; all resources reconcile, with zero page errors. Full-pose combined loading/play/Explorer native highs are **1,071.276 / 982.276 / 950.276 MB**. Loading stays below 1,800 MB; play and Explorer stay below 1,000 MB. Inspector medians and GPU-process RSS remain separate and are not added to WebContent + GL.

## Before / after and provenance

The [pre-fix receipt](../sf22a-default-g172-g180/README.md) remains unchanged: at `3f8409900`, cold Auto uses images and records 523.5 MB spawn GL, or **1,114.671 MB play / 1,112.836 MB Explorer**. At the new pin, unforced Auto uses the phone tier's KTX2 policy: 239.1 MB spawn GL, identical to the separate forced-KTX2 spawn census. Full-pose Auto GL, 285.276 MB, agrees within 0.002 MB with the prior forced-KTX2 same-coverage census (285.274 MB). The 270.99 MB G180 reference used an earlier base; do not substitute it for this measured full-pose total.

Three cold Safari restarts/origin resets, one iOS 26.5 iPhone 17 Pro Simulator at a time. Each has 30 s play and 30 s Explorer, with three one-second native/Inspector settled samples per phase. The case is the median/full range of the three independent cold medians, with no dropped run. All build/shard checks and the explicit device pick `debug.plugin.pine-hollow.pineMemoryTrim=on` pass. No global texture pick is seeded for the cold native or spawn GL run. Native/spawn served build `bc71810-muupbmvr`; full-pose build is separately recorded, at the same source revision. Nine settled phase readings and all six play/Explorer identities pass.

The Simulator shuts down before the matching GL wave. The spawn census uses muted fresh Chromium/Metal, iPhone 16 Pro 390×844@3, phone tier/render scale 2, 15 s settle and 10 s sample. The full-pose helper is the existing G180 census with `settings.tex=auto`, no content cut (`{}`), service workers blocked and all three capture poses; it waits 120 real frames per pose. It deliberately keeps Auto, allowing the new phone tier policy to resolve compressed textures. No production source, cap or Debug default changes are made in this receipt.

## Reproduce / cleanup

Serve a clean `bc7181016` export. Through sim-lane run `node scripts/sim-memory.mjs --url=<preview> --out=<empty> --runs=3 --play=30 --fly=30 --shards=pine-hollow --device-save=debug.plugin.pine-hollow.pineMemoryTrim=on`. After shutdown, through browser-lane run `node scripts/crossroads-rig/desktop-probe.mjs --base=<preview> --shard=pine-hollow --settle=15 --out=<gl.json> --device-save=debug.plugin.pine-hollow.pineMemoryTrim=on`. Full-pose command: `node progress/memory/sf22a-pine-auto-bc7181016/full-auto-gl.mjs <preview> <scratch-out> auto '{}'`, through browser-lane. `python3 aggregate.py <evidence-folder>` reproduces raw measurement rows; summary adds the full-pose comparison and receipt metadata.

Raw JSONL, plans/reports/tables and both GL ledgers are retained. Incidental device/session telemetry is omitted, images and phase scratch discarded. All owned Simulator, browsers and previews are closed. No Driftwood metadata change accompanies this Pine follow-up.
