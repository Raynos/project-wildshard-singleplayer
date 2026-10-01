# E357 P3 — Input / HUD board

**Needs Jake's pick.** Timing defaults are buffer120ms and coyote100ms (decision40). A/B compares only the reserved verb discs; both preserve E319's left HORSE · HOVER · SWAP ring. No baseline or parity snapshots were accepted by this evidence commit.

| Review | Before / A | After / B | Measured result |
|---|---|---|---|
| Driftwood visible pier-edge jump | [Clip](roof-before.mp4) · [frame](roof-before.jpg) · [counter](roof-before.json) | [Clip](roof-after.mp4) · [frame](roof-after.jpg) · [counter](roof-after.json) | Same two presses: first 33ms past the visible edge, second 333ms later. Coyote 0 spends its air jump and misses the boat; 100ms preserves the air jump and lands aboard. |
| Dodge pressed mid-swing | [Clip](dodge-before.mp4) · [frame](dodge-before.jpg) · [counter](dodge-before.json) | [Clip](dodge-after.mp4) · [frame](dodge-after.jpg) · [counter](dodge-after.json) | Same presses in the normal input phase, second in the last ~67ms of cooldown during a sword swing: 1 → 2 visible forward dodges; 3.79m → 6.56m along the pier posts. |
| Blocked jump buffer | [Clip](buffer-before.mp4) · [frame](buffer-before.jpg) · [counter](buffer-before.json) | [Clip](buffer-after.mp4) · [frame](buffer-after.jpg) · [counter](buffer-after.json) | Jump pressed while crouched, released67ms later: zero → one ground jump. |
| Controlled ground removal | [Clip](coyote-before.mp4) · [frame](coyote-before.jpg) · [counter](coyote-before.json) | [Clip](coyote-after.mp4) · [frame](coyote-after.jpg) · [counter](coyote-after.json) | Existing airborne8.6m/s → grace7.2m/s. This supplemental case moves the player5m above the floor. |
| Pine reserved bolt verb | [A: first row above JUMP](pine-hollow-verbs-a.jpg) | [B: second row above JUMP](pine-hollow-verbs-b.jpg) | Same BOLTS action, native live HUD; B is screenshot-only CSS. |
| Nalati reserved offer verb | [A: first row above AIM](nalati-grasslands-verbs-a.jpg) | [B: second row above AIM](nalati-grasslands-verbs-b.jpg) | Same OFFER action and left HORSE tab; B is screenshot-only CSS. |

The replacement roof and dodge pairs use the same clean source **`064e06763548ab6bf060b7ed76b82ccb01ce00db`**, the HEAD selected when this review began. BEFORE sets respectively motor `coyoteMs=0` and `input.buffer.ms=0`; AFTER uses 100ms and 120ms. These compare timing on the same game, not historical full-tree builds. The buffer and supplemental controlled-ground-removal clips retain their earlier sources (`478f6864` before, `df398947` after); verb images use `df3989476a82869c3e14b9c0127259ecec3d2d88`.

**The rejected Nine Dragon roof fixture was wrong.** It teleported to `(24,165,-10)`, atop the forty-metre building-front barrier, then walked beyond its back edge at x28 into visual-only scenery. Normal play is at y125. A normal walk from spawn with no teleport stayed grounded; downward rays and an exact old-fixture replay confirmed the cause. No collider was removed by that roof fixture, and no normal street fall-through was reproduced. [Exact collider audit](roof-fixture-audit.md) · [normal walk and fixture traces](roof-fixture-audit.json). No runtime fix was needed.

The new `roof-*` files show a real Driftwood pier edge and the water gap to the moored boat. Movement, jumping and landing use unchanged game collision. **The game already has an air jump:** with 0ms coyote, a late first press launches 8.6m/s and spends it; with 100ms, the first launches 7.2m/s from grace and leaves it for the equal second press. The failure/success demonstrates retained air jump, not a claim that 0ms forbids airborne jumping. No colliders, velocity, jump allowance or movement tuning are changed.

The new dodge pair faces along real pier posts. Movement direction is held only around the two presses, so the bursts and the pause between them read clearly. Both takes deliver presses during the player's normal input phase: a 0ms press between harness frames would expire before any action could read it. The real `dodge()` return value and per-frame positions are recorded; only AFTER has a second launch at frame48.

All captures use Chromium with Metal, 390×844 portrait, phone tier and 30Hz deterministic harness frames. Replacement clips are six seconds without audio, assembled from every drawn frame (180 frames); the JPG is frame100. JSON includes positions, presses, launches and unchanged collider counts. All four replacement clips were inspected using `ffmpeg -vf fps=4,scale=195:422,tile=6x4`, with sheets in `/private/tmp/e357-sol-roof/`. Every committed artifact is below 500KB. Observation wrappers and timing settings are restored; browsers and previews close in `finally`. Other board clips retain their original four-second edit.

Controls: [defaults](controls-default.jpg) → [conflict and SWAP/CANCEL](controls-conflict.jpg) → [swapped forward/back bindings](controls-swapped.jpg). These are the real Settings ▸ Controls panel. The keyboard conflict swaps W/S; touch positions are fixed. The binding change lives in the isolated capture browser's storage.

[R6 coyote evidence](r6-coyote.md) explains Nine Dragon's changed walk/footstep cadence, exact100ms boundary, single consumption and no renewed grace after takeoff. The lead classified this as intended decision40; Jake still decides P3. [Measured proof](r6-coyote-proof.json). R5's USE gesture/audio ordering fix is documented in [the sample-bed evidence](../r5-sample-bed.md).

Step7 uses the lead's explicit exception: **no new Debug row** (25 cap). [Trace image](input-trace.jpg) and [proof](input-trace.json) show the live context stack and last20 actions, off by default. Enable with `window.__wildshard.world.game.app.debug.snapshot().input.trace(true)`; read `input.last20()` / `input.contexts()` on that handle, and disable with `trace(false)`. Gameplay scope disposal removes the DOM, system and debug exposure. Source `ad1f66dfa1cafc61b8f26e054d5bf15db4b7d3ec`; full2145tests/typecheck/whole-tree lint/ratchet green, four phone boots errors[] with3poses each.

Reproduce through the shared lane:

```sh
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:478f6864 before /private/tmp/x1-before
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:df398947 after /private/tmp/x1-after
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:064e0676 before-coyote0 /private/tmp/x1-roof-before roof
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:064e0676 after /private/tmp/x1-roof-after roof
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:064e0676 before /private/tmp/x1-dodge-before dodge
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-timing.mjs rev:064e0676 after /private/tmp/x1-dodge-after dodge
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-verbs.mjs http://127.0.0.1:<built-preview-port> /private/tmp/x1-verbs
scripts/browser-lane.sh --max 4 node progress/normalization/x1-board/capture-trace.mjs ad1f66df /private/tmp/x1-trace
```

The verb script expects the df398947 built preview and sets the existing horse/alert fixture for OFFER/HORSE; [Nalati DOM evidence](nalati-grasslands-verbs.json) records the real show predicate and rendered bounds. [Pine DOM evidence](pine-hollow-verbs.json). Browsers and temporary previews close in finally.

The exact next source census is [native-census.json](native-census.json): **no-raw-input0; no-global-listener-patch93 across40files** on clean candidate d9594dea (same runtime as ad1f66df). The remaining native sites and legacyCapture deletion belong to a fresh continuation, per the lead. See [continuation steps](continuation.md).
