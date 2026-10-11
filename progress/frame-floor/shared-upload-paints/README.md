# Shared compressed-upload boundary paints

E435: experimental `buildPacing = shared-paints`, Developer only. The
ordinary `on` value remains the default, including outside Developer.
No quality, resolution, sampler or texture-format change.

The renderer-wide queue may share a successful compressed upload's trailing
paint as the next opted-in upload's leading paint. Each upload still occupies
a distinct frame, performs its own GL error round trip, fences owner/context/
version/sampler changes, and retains mips until the first successful real draw.
Ordinary requests keep the original two-paint path. Each preparation uses
a distinct scalar group; an intervening image upload starts a fresh group.
The same opt-in applies to asynchronous KTX2 loaders before warm-up. Native
image uploads invalidate pending boundaries, including already queued
requests. Failure or cancellation cannot supply a shared boundary to the
next queued request.

Focused evidence: 110 current checks across compressed uploads, real precompile
forwarding, borrowed-resource cancellation, live shader slices, image upload
budgets, settings and Debug hygiene. Root strict and touched typed lint pass.
A six-array preparation uses seven boundary paints instead of twelve, with
six separate upload frames and six GL fences before composer publication.
This is a scheduling fixture, not measured arrival or frame-floor credit.

Official Node recapture on `812c2164918` regenerated all six physics
bakes plus Driftwood and Pine quest spots. All eight canonical payloads
were byte-identical after excluding only `inputs`, `revision` and `build`;
the engine upload inputs and admitted audio rows changed those fences.
No collider, placement, actor or quest payload changed.

Same-pin desktop comparison on `3ab73b7e2`, at shipping road speed 30 m/s:

| Setting | Wait | p95 | Maximum | Verdict |
| --- | ---: | ---: | ---: | --- |
| `on` | 0 ms | 16.8 ms | 133.3 ms | FAIL: play hook |
| `shared-paints` | 0 ms | 16.8 ms | 133.3 ms | FAIL: play hook |

Both completed without game errors or context loss and with zero frames
visible before readiness. This single pair establishes no desktop benefit.
The quiet capture ran 22:35:31–22:38:14 UTC, load 7.09 / 8.60 / 9.95.

Both Simulator attempts failed configuration checks before measurement:
the owned preview lacked the pre-navigation Safari fixture page. They are
explicitly unavailable in `summary.json`; no Simulator pass or saving is
claimed. The scratch worker now creates the standard helper from the exact
served index before its next Simulator attempt. All workers, browsers and
Inspector connections closed; Simulator 0 booted at explicit release.

Open:

- Simulator same-pin `on` / `shared-paints` arrival floors after sp-x1
  diagnostic and the held landings. If no benefit, remove the option and
  its implementation together (E451).
- Pine desktop play spike: 133.3 ms in both arms, coordinated with sp-x1’s
  active CPU/GPU diagnostic; desktop gate remains 100 ms.
- Physical-device memory/stability reading before any default flip. The
  variant stays default-off even if local floors improve (RENDERING.md).
