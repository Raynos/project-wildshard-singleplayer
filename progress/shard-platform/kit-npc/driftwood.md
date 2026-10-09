# Driftwood NPC ownership relocation — 2026-10-09

Plan-State: unchanged. SF54 / E442; the coordinator owns plan updates and the serialized push.

Driftwood now owns the literal face-head decoder in `npc/faceHeads.ts`. `npc/Castaway.ts` and `species/sailor.ts` import that local implementation. Its SHA256 is `5e522658a86d33296bf278c4ceca97d8e75f4738b1c30953936c0c6d39d27584`; every byte matches the historical game implementation, which remains unchanged for the pending SF73 registered frozen consumers. No alias or frozen-source edit.

Actual muted iPhone 16 Pro / phone / DPR2 capture pin: `3d7c0bed33aab48a18335383a4935007b5f43178`, based on `2ec9b44e9810662d8b7bcd5bb1e72f7cff044191`. Both independent physics reads agree: 34 actor bodies plus the captain, 2,067 world solids, 34 registry pieces and the 255 × 255 ground. All non-provenance fields equal the prior committed bake: ground, solids, actors, herds, habitat, pieces and captain. The input fence explicitly adds the actual local decoder and updates the sailor import hash.

The actual quest-spot capture also agrees between independent reads: all 30 table rows, the talk and sword prompts, and the finale reward spot are exactly unchanged. Only provenance changes. The map source closure is unchanged, so no map rebake is required. No visual, fitting, geometry, animation, physics or gameplay arithmetic change.

Checks: Driftwood directory plus baked-map checks covered 186 tests; the initial stale quest-spot input refusal was resolved by the actual capture, and the affected quest/physics tests pass 7/7. Root/layer/scripts strict and touched typed lint passed on committed source plus the relocation. Shared working-tree checks encounter unrelated package-export edits; those hunks are excluded. No builder full suite. No input-only witness manifests are carried: `ec89b2e60` assigns their re-recording to the serialized push. The earlier recorder produced unchanged outcomes on the literal move.

Import accounting: two Driftwood game import sites removed (58 → 56 at the original inventory); together with Nalati's six, the initial 233-site debt falls by eight before other lanes' changes. The decoder uses Three directly and introduces no layer public edge. Historical definitions/exports remain until the exact legacy consumers retire. No generated ratchet/API/graph outputs carried.
