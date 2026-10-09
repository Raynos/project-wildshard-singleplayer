# Sampled GL observer — E435, 2026-10-09

Source `d34018fdc7db704ca86796ae1103bc7487320f62` is on origin/main. The quiet desktop proof passes **7/7**, every standing / travel / template-interior sample **59.88 fps, p95 16.7 ms**, with the observer ON and Developer OFF. The one-minute machine load fell **10.17 → 6.64**. No Simulator, build or suite ran during the samples. No page errors; the actual road and template route has frame / interior / residency witnesses. This clears the requested ≥58 desktop bar; it is not a physical-phone reading.

## Root cause and implementation

The GL allocation hooks already observe only create / storage / upload / delete mutations. They do not wrap draw calls or capture stacks by default. The expensive path was `gpuLabels.ts`: census presence bypassed SF69 amortization and caused whole-scene / material / attribute walks on every render and draw, plus repeated native label writes.

The default observer now keeps allocation accounting exact, amortizes engine label walks, and flushes exact scene / resource labels synchronously when `__sc_gl()` is read. Weak scene / renderer references do not pin retired worlds. The flush checks existing renderer properties before reading, so disposed resources cannot have their properties recreated. Late attributes, shader uniforms and improved native-handle labels are covered by focused fixtures. The no-harness rendering branch retains its previous amortization and behavior.

`glbytes-probe.mjs --gl-labels=full` selects the old full render/draw label diagnostics explicitly. `--gl-labels=sampled` is the default. The frame-floor CLI accepts only `--gl-observer=off|on`; ON is sampled and never selects full diagnostics.

## Exact census comparison and profile

Before pin `ec37f340396c5b2049c960fdd3ba0197ffb2753b`, after pin `d34018fdc7db704ca86796ae1103bc7487320f62`. Both used the same `_template` desktop spawn route, seed 1, 60 drawn frames at each pose, and the existing census probe. **All observed fields compare equal, with no ignored fields**: 596 resources, 280,176,252 bytes, zero unlabelled, reconciled. This includes native IDs, owners, assets, per-mip/subresource details, compressed-upload records, dimensions, renderer and grouped owner totals used by the soak reader. Raw censuses and the zero-difference result are committed beside this receipt.

An explicit Chromium CPU profile of four seconds at `_template` with Developer OFF found 68,002 native label writes before and zero after, with source-label writes 11,374 → 733. `gpuLabels` self samples fell 481.070 → 132.021 ms (11.64% → 3.18% of sampled wall time). Both profile runs had 600 resources / 382,347,900 bytes and zero errors. These per-call clocks and CPU profiler are diagnostic instrumentation, **not** the frame-floor ruler. No storage/allocation calls occurred in either settled four-second window. Full CPU profiles are preserved.

## Checks and replay

Clean export of HEAD `734a516e4` plus the seven owned source paths: `pnpm gen`, `node scripts/generated-files.mjs --write` inside the export only, root + scripts strict, owned-file lint, graph, shrink-only coupling and ratchet passed. Full suite through heavy-lane: **1,062 files / 5,877 passed, 14 skipped, 117.23 s**. Soak GL tools: **7/7 passed**. Logs are compressed beside this receipt. The validation driver initially used git-dependent graph/regen CLI commands in an archive; corrected to the pure generated writer and complete graph scan. No generated output was committed by this lane.

The quiet floor reused the already built sole owned preview, avoiding a new build inside the window:

```sh
scripts/browser-lane.sh --max 10 node scripts/frame-floor.mjs --worker \
  --surface=desktop --developer=off --base=<d340-preview-url> --shards=grid \
  --grid-scenario=template --gl-observer=on --frames=120 --settle=2 \
  --deadline=<epoch-ms-now-plus-600000> --worker-out=<output.json>
```

The first worker invocation omitted its required deadline and refused before any samples. Its diagnostic is retained separately; the corrected invocation above produced the complete 7/7 result. `floor-desktop.json`, the command/log and load readings preserve the accepted run. All browsers closed and the only owned preview (:4404, PID 92467) stopped. No Simulator or queue ticket remains.

Plan-State: unchanged; the coordinator owns plan updates and pushes.
