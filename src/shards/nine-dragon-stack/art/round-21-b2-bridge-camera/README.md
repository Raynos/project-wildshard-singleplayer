# B2 bridge camera correction

The B2 dome's first-person camera was specified at ground **(−14, 118, −22)**, while the finished timber crossing is centered at **(−14, 119, −21)** (`world/well-plan.ts`, `world/well-mid.ts`). The old eye sat inside its cinnabar railing. `before.jpg` shows the red wall; `after.jpg` moves the eye and aim together by (+0, +1, +1) m, placing it 1.62 m above the built deck. The 3×3 `cameras.json` now uses that bridge center for its six first-person views. The three aerial views and all target artwork remain as made.

The after capture has an unobstructed canyon view. This corrects the evaluation camera, not the B2 world geometry or its target-vs-engine look gap. Captured at 512×768 CSS pixels, phone tier, from the clean export of `f962b730` with the revised camera; `before-after.jpg` shows both at the same scale. The fragment's 76-pose budget ruler was rerun with this camera correction.
