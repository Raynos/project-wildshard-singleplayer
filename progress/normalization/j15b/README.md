# J15b — Developer switch immediate feedback

Captured the candidate runtime (`a747948e`) in Chromium with Metal, an iPhone-sized 390×844 viewport, mobile layout, native touch and a coarse pointer. No page errors.

- `before-tap.jpg`: Developer OFF, no Debug card.
- `after-tap-on.jpg`: one native tap immediately sets aria-checked=true and `.on`; cyan pill and Debug card visible.
- `after-tap-off.jpg`: second native tap immediately sets aria-checked=false and removes `.on`; pill and Debug card return to OFF.
- `proof.json`: immediate DOM assertions before waiting 250 ms for CSS transitions to settle for screenshots.
- `capture.mjs`: repeat with `scripts/browser-lane.sh --max 3 node progress/normalization/j15b/capture.mjs <preview-url>`.

Checks on the clean private export: TypeScript, whole-tree oxlint, 350 test files / 2,413 tests passed. The missed-notification regression fails on HEAD and passes with direct repaint. Basic HEAD clicks did not reproduce Jake's stale UI; the original phone notification failure remains unconfirmed. Document mirror, title refresh and HUD subscriptions are unchanged.

Boot evidence: `progress/parity/a747948/` (local runner output). All seven slugs have empty boot.errors; original four fingerprint/poses are green. Overall comparison is red for pre-existing template/desert baseline differences, with far-reach lane-pending.
