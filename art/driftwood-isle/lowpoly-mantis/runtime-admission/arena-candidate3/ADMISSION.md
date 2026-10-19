# Mantis V7 native22 motion3 candidate

Unaccepted successor to frozen motion2. Native geometry/payload and measured collider unchanged. Original tactical AssemblyScript is preserved verbatim except renaming onTick to tactics and adding an observation-only wrapper. The supported strikeState read publishes phase and phase-clock fields at10Hz. Movement, damage, range, strike timing and cancellation remain unchanged. Three exact Wasm equivalence/observer tests pass. No engine edits.

Authored pose follows observed windup/active/recovery and holds its sickle cut throughout variable-duration lane active phases. Observation clock has up to one10Hz tick latency; exact phase snapshots are captured separately. Lower-amplitude gait remains unaccepted for foot anchoring. Flinch has measured .09×flinch lift; local minimum+.00966m across41samples. Idle, gait, both phase sequences, flinch and death local sweeps pass zero-below-floor check at sampled values. This is not a full-world contact guarantee.

Death pose and real generic rigid ragdoll remain unchanged. Candidate2 composed-world baseline has alive minimum−.07162m and corpse left hook−.12394m. Candidate3 does not compensate an assumed ragdoll root sink. A separate anatomy-level fold can be investigated after this frozen revision.

Practice state/persistence boundary unchanged: no world flags, quests, encounters, bosses, homes, persistent save namespaces or reward grants. Source/native rendering, physics contact, full idle cycle, actual frame-independent cycle review and performance remain unaccepted. Eight valid matched rest views from candidate2; failed top attempt is preserved, not counted.
