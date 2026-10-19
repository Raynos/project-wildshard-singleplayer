# Mantis V7 native22 motion4 corpse-fold candidate

Unaccepted anatomy-only correction over frozen motion3. The exact source/native tuple is pinned by admission.json. No shared engine, physics, collider, root translation, strike duration/range/damage or tactical/observer guest changes. Every live pose and all bone positions/scales are numerically identical to motion3.

Death rotation deltas, weighted by smoothed death d: body roll−.2rad (.6→.4), abdomen pitch+.2 (−.15→+.05), elbows+.4 (.4→.8), knees side*2*d*(1−d) transient tuck. Hooks do not move independently; forearms fold them upward.

Exact composed-world replay covers47motion2+87motion3dead samples with unchanged captured ragdoll meshWorld. Original minima−.12394/−.14482m become+.01368/+.01369m. No replay vertex below−.005m. Failed simpler variants are retained succinctly in replay-variants.json. This is not a new physics run or a universal floor guarantee. Fresh actual collapse/settle capture and frame-independent visual review are required.

Known phase3 limitations remain:10Hz observation latency and active cut blend may trail authoritative active onset; this revision does not change timing. Existing primitive collider omits neck/crown/limb detail. Gait anchoring, physical phone performance and visual acceptance remain unapproved. Isolated nonpersistent state/reward boundary unchanged.
