# Additive joint FK extension

CollisionPose accepts per-joint Euler order and scale, absolute local transforms, and upright y capsules. Defaults remain the existing YXZ/unit behavior. set/setLocal change locals; solve is the only publication boundary, preserving cached contact history. No native creature is bound in this commit.

The original defining module is captured byte-identically with its source/revision/hash. Across10k frames, default anchors and x/z pitched capsules are bit-identical. All6 Euler orders, animated squash and scaled y capsules match real propagated bones within1e-12m. Another10k absolute-local frames match real anchors bit-identically both before and after explicit publication. Invalid transforms refuse without corrupting the old pose. Existing King fixture remains green.

Validation:12 focused tests in2 files, root strict, touched typed lint and private hooks. No builder full suite (Jake speed rule). No behavior, bakes or payloads deliberately changed; the pusher now owns loaded-input freshness. Native activation and actual rig captures remain pending x2 Driftwood relocation.
