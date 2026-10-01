# E357 P3 — Input / HUD board

**Needs Jake's pick.** Timing defaults are buffer120ms and coyote100ms (decision40). A/B compares only the reserved verb discs; both preserve E319's left HORSE · HOVER · SWAP ring. No baseline or parity snapshots were accepted by this evidence commit.

| Review | Before / A | After / B | Measured result |
|---|---|---|---|
| Nine Dragon late roof jump | [Clip](roof-before.mp4) · [frame](roof-before.jpg) · [counter](roof-before.json) | [Clip](roof-after.mp4) · [frame](roof-after.jpg) · [counter](roof-after.json) | Jump33ms after leaving the collider: existing airborne jump8.6m/s → ground-grace launch7.2m/s. |
| Dodge pressed mid-swing | [Clip](dodge-before.mp4) · [frame](dodge-before.jpg) · [counter](dodge-before.json) | [Clip](dodge-after.mp4) · [frame](dodge-after.jpg) · [counter](dodge-after.json) | Press inside the final72ms of cooldown: one starting dodge → starting dodge plus one buffered dodge. |
| Blocked jump buffer | [Clip](buffer-before.mp4) · [frame](buffer-before.jpg) · [counter](buffer-before.json) | [Clip](buffer-after.mp4) · [frame](buffer-after.jpg) · [counter](buffer-after.json) | Jump pressed while crouched, released67ms later: zero → one ground jump. |
| Controlled ground removal | [Clip](coyote-before.mp4) · [frame](coyote-before.jpg) · [counter](coyote-before.json) | [Clip](coyote-after.mp4) · [frame](coyote-after.jpg) · [counter](coyote-after.json) | Existing airborne8.6m/s → grace7.2m/s. This supplemental case moves the player5m above the floor. |
| Pine reserved bolt verb | [A: first row above JUMP](pine-hollow-verbs-a.jpg) | [B: second row above JUMP](pine-hollow-verbs-b.jpg) | Same BOLTS action, native live HUD; B is screenshot-only CSS. |
| Nalati reserved offer verb | [A: first row above AIM](nalati-grasslands-verbs-a.jpg) | [B: second row above AIM](nalati-grasslands-verbs-b.jpg) | Same OFFER action and left HORSE tab; B is screenshot-only CSS. |

The source for the after clips and verb images is `df3989476a82869c3e14b9c0127259ecec3d2d88`. Driftwood before clips use pre-X1 `478f6864`. That revision cannot boot Nine Dragon (missing primary weapon factory), so the roof before clip uses the same current source with **only player.coyoteMs set to0 by the capture script**. This preserves the roof and equipment for a controlled timing comparison; it is not a historical full-tree before capture. The after roof clip keeps100ms. Harness captions and fixture preparation are capture-only.

All captures use Chromium with Metal,390×844 portrait, phone tier,30Hz deterministic harness frames. Clips retain the final4seconds, without audio. The jump counters hook the real motor's onJump; dodge counts successful calls to the real dodge method. `beforeRelease` in the dodge JSON stores the final dodge count (1before,2after). The capture script restores its wrappers; no runtime diagnostics were committed. All images and representative clip frames were inspected; every artifact is below500KB.

Controls: [defaults](controls-default.jpg) → [conflict and SWAP/CANCEL](controls-conflict.jpg) → [swapped forward/back bindings](controls-swapped.jpg). These are the real Settings ▸ Controls panel. The keyboard conflict swaps W/S; touch positions are fixed. The binding change lives in the isolated capture browser's storage.

[R6 coyote evidence](r6-coyote.md) explains Nine Dragon's changed walk/footstep cadence, exact100ms boundary, single consumption and no renewed grace after takeoff. The lead classified this as intended decision40; Jake still decides P3. [Measured proof](r6-coyote-proof.json). R5's USE gesture/audio ordering fix is documented in [the sample-bed evidence](../r5-sample-bed.md).

Step7 uses the lead's explicit exception: **no new Debug row** (25 cap). [Trace image](input-trace.jpg) and [proof](input-trace.json) show the live context stack and last20 actions, off by default. Enable with `window.__wildshard.world.game.app.debug.snapshot().input.trace(true)`; read `input.last20()` / `input.contexts()` on that handle, and disable with `trace(false)`. Gameplay scope disposal removes the DOM, system and debug exposure. Source `ad1f66dfa1cafc61b8f26e054d5bf15db4b7d3ec`; full2145tests/typecheck/whole-tree lint/ratchet green, four phone boots errors[] with3poses each.

Reproduce through the shared lane:

```sh
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:478f6864 before /private/tmp/x1-before
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:df398947 after /private/tmp/x1-after
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:df398947 before-coyote0 /private/tmp/x1-roof-before roof
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:df398947 after /private/tmp/x1-roof-after roof
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:478f6864 before /private/tmp/x1-dodge-before dodge
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:df398947 after /private/tmp/x1-dodge-after dodge
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-verbs.mjs http://127.0.0.1:<built-preview-port> /private/tmp/x1-verbs
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-trace.mjs ad1f66df /private/tmp/x1-trace
```

The verb script expects the df398947 built preview and sets the existing horse/alert fixture for OFFER/HORSE; [Nalati DOM evidence](nalati-grasslands-verbs.json) records the real show predicate and rendered bounds. [Pine DOM evidence](pine-hollow-verbs.json). Browsers and temporary previews close in finally.

The exact next source census is [native-census.json](native-census.json): **no-raw-input0; no-global-listener-patch93 across40files** on clean candidate d9594dea (same runtime as ad1f66df). The remaining native sites and legacyCapture deletion belong to a fresh continuation, per the lead. See [continuation steps](continuation.md).
