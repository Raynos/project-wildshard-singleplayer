# Nalati NPC ownership relocation — 2026-10-09

Plan-State: unchanged. SF54 / E442; coordinator owns the plan and serialized push.

Nalati now owns the literal figure rig and motion implementations in `models/npc/`. Six author imports and three test imports name those local modules. Historical game implementations and exports remain byte-for-byte unchanged for the pending SF73 registered frozen consumers. No runtime alias or frozen-source edit.

Capture pin: `5fcdc794833524e4561549d0c0f99ecff8af164a`, based on `17640876207ecc425f12d03f55f65804e10f66dc` after G258 `986dc7495`. Both implementations are byte-identical to their historical sources: figureRig SHA256 `19ba9a5ed14f4917549350e17a798b6ef00b4d7f25ac6a7962a418ceeae047a8`, figureMotion `acb9cf845f9a2e20e74b79634e1b4a376dc136f29025d525238008836fab9134`. The only authored source changes are those import specifiers. The model contract explicitly names these two support files; an undeclared helper in the same folder or another shard still fails.

The actual muted phone/DPR2 browser physics bake agrees between its two independent reads: 35 native bodies, 155 trees, 2,694 solid world colliders, 81 registry pieces and the 255 × 255 Rapier floor. Every non-provenance field is identical to the previous committed bake: ground, solids, actors, herds, trees/tops, yurts, pieces, spawn/group/flock continuations, ledges, marmots and grass. The new source fence includes both local NPC modules and the redirected `models/people.ts`.

The actual map was rebaked because `models/` participates in its source hash. The 1,000 × 1,000 map is 134,464 bytes; its lossy image is not byte-identical to the prior capture (mean absolute RGB channel difference 1.015272667/255, max 94, 586,171 changed pixels). This is a new real map capture, not a claim of pixel-exact map parity; no renderer, fitting, animation, palette, sampler or model geometry code changed.

Checks: all Nalati focused checks covered (189 tests), plus model-contract checks (8) and map checks (9). The initial model-folder guard refusal was fixed with the two exact declared support modules and a negative sibling fixture. Root/layer/script strict checks and touched-file typed lint pass. Current-HEAD recipe inputs match the captured physics provenance; the four canonical checkpoint fences remain fresh. No private full suite under the new speed policy; the serialized push gate owns it.

Import accounting: Nalati's author game-import sites fall 46 → 40; original total 233 → 227. The literal rig adds one direct Nalati → engine `anim/rig` import site; that unique public-module edge already existed. Driftwood's two sites remain for the separate move. No generated ratchet/API/graph outputs carried.
