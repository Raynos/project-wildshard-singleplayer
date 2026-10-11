# Shared compressed-upload boundary paints

E435: experimental `buildPacing = shared-paints`, Developer only. The
ordinary `on` value remains the default, including outside Developer.
No quality, resolution, sampler or texture-format change.

The renderer-wide queue may share a successful compressed upload's trailing
paint as the next opted-in upload's leading paint. Each upload still occupies
a distinct frame, performs its own GL error round trip, fences owner/context/
version/sampler changes, and retains mips until the first successful real draw.
Ordinary requests keep the original two-paint path. Each preparation uses
a distinct scalar group; an intervening image upload starts a fresh group. Failure or cancellation
cannot supply a shared boundary to the next queued request.

Focused evidence: 105 initial checks plus a mixed-upload regression across compressed uploads, real precompile
forwarding, borrowed-resource cancellation, live shader slices, image upload
budgets, settings and Debug hygiene. Root strict and touched typed lint pass.
A six-array preparation uses seven boundary paints instead of twelve, with
six separate upload frames and six GL fences before composer publication.
This is a scheduling fixture, not measured arrival or frame-floor credit.

Open:

- Desktop and Simulator same-pin `on` / `shared-paints` arrival floors after
  sp-x1 releases both milestone surfaces. Report GL errors, wait, p95 and max.
- Physical-device memory/stability reading before any default flip. The
  variant stays default-off even if local floors improve (RENDERING.md).
