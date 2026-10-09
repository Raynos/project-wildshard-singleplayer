# Additive renderer-free joint law

QuadrupedRigPose extracts the shipping AnimalView channel-to-joint expressions, including the original Euler conventions, corpse leg spread and breathing accumulation. applyAnimalRoot retains its root position and terrain/flinch expression order. The structural joints accept either real visual bones or plain Vector3/Euler/scale values; no scene graph is created. Both APIs remain unused by production in this commit.

Two real factory rigs (boar and bear) compare every local transform and published matrix exactly over 10,000 mixed 60/30/20 Hz and paused frames, including gait, look/overlays and death. Fresh owners resume the last 5,000 frames exactly after breathing and transforms are restored. The test-only expression capture is fenced by the actual historical AnimalView source and method hashes. Another 10,000 frames match the root law. Missing joints and malformed continuation refuse; restore writes no joints.

Validation: five focused tests, root strict and typed lint passed. Under Jake's speed rules, no builder full suite was run; the serialized push gate owns that check. No bake input, loaded witness input, live caller or collision publication changes. The private view-forwarding/FK/volume candidate remains pending x2's actual Driftwood relocation and the coordinated bakes.
