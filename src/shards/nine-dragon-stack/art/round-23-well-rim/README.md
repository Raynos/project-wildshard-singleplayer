# Round 23 · the Well from the rim (F4 mockup B, F5 the deep Well; E276 / E281)

Jake's playtest: "down the Well is the weakest in absolutely all of them … not layered and complex". This slice
worked the Well's rim (B1 / D1), the run north (B2) and the deep Well (D2) in passes, each captured, eye-checked and
committed.

All frames are the iPhone frame (402×874 @3, tier phone, touch, HUD and viewmodel on), posed with a free camera at
`src/chunks/nine-dragon-stack/mockupCameras.ts`. The grapple's "◇ DRAGON HOOK" marker is hidden in these captures: under
a free camera `grapple/Traversal.ts` stops updating it, so it sits stale in mid-frame.

| File | What it shows |
|---|---|
| `board-BD.jpg` | Mockup B, before (`e3c477d`, the live build's source), after (`7726176`), then the same for mockup D. The after includes the render agent's pass 1 (`27043b0`). |
| `domes-pass0-vs-pass3.jpg` | The engine's nine views of domes B1, B2, D1 and D2, pass 0 (`e3c477d`) over pass 3 (`c3b1463` + the pass-3 files, so this slice's work alone, before the render pass). Captured with `scripts/nine-dragon-domes.mjs`, no HUD. |
| `camera-B-proposal.jpg` | Mockup B's camera now (a metre back from the rail) against the camera pulled back to z 13.3 and 13.6. From there the carved balustrade, a post on the lower right and the canyon above read like the mockup. A camera change for the coordinator, not made here. |

## The passes

| Pass | Commit | What changed | Eye-check |
|---|---|---|---|
| 1 | `5f77ea8` | The Well's mist as four cloud strata (+103, +84, +64, the +44 cloud sea under the temple), a lighter depth curve, aerial perspective along the canyon (`look/style.ts`) | B's run north fades into the silk rung by rung. D2's views from inside the Well went white. |
| 1b | `d38c8cc` | The strata thinned (τ ≈ 0.2 each), the along-canyon air 0.01 → 0.006 per metre | Reverted D2's white slab. The temple and crossings read again from inside. |
| 2 | `c3b1463` | The rim balustrade becomes rain-dark granite that takes 40 % of the neon spill, no longer pink. Its posts are re-laid so that neither camera has a post as a block in frame. The two rungs that floored over the temple's sightline are gone. | Better: B's and D's lower thirds are dark stone, and D's middle is less of a floor. |
| 3 | `7726176` | Mockup B's red gondola is parked mid-span up the run north. The temple terrace rises from +48 to +56, above the cloud sea, with lit lattice screens and its lanterns outside the eaves. | Slightly better: the gondola is small at 59 m and the temple is still faint through the silk. Eye-check has flattened, so no pass 4. |

Tried and reverted:

- B's lower-right post inside the frame at x −19.0 was a bulb filling a third of the frame.
- D's lower-left post at x −14.5 showed as a flat block.
- A 6.2 m temple spur filled the gap between the galleries and read no better through the mist.
