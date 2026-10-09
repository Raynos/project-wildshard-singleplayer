# Failure-only native replay diagnostics

The unchanged worker digest assertion now writes both canonical snapshots and a field-level diff to an owned temporary directory on mismatch, then prints that path in the original failure. State uses the digest JSON semantics; native physics includes exact Float64 bits and body/collider/contact record labels. No artifact work runs on the successful path, and writing failures still throw the original mismatch. No retry, normalization or deadline changes.

The prior intermittent worker continuation failure did not reproduce in five unchanged focused controls. Its cause remains unclassified. These artifacts arm the next recurrence without claiming contention as a cause.

Two real-Rapier regressions prove the nested adapter diff, unchanged throw, and exact moved-motor physics bits. The actual Driftwood checkpoints and compatibility record were rerun on the committed base named in payload-equality.json plus this diagnostic source. All four gzip payloads (three checkpoints and the command tape) are byte-identical; every non-input manifest/compatibility outcome remains equal, including the 19,255-tick tape, Captain tick 18,339, 916-tick suffix and 60 exact SDK worker ticks. Compatibility remains false for the existing open list.

Validation: clean-export full suite through the machine lane: **1,097 files / 5,994 tests passed**, 206.86 s. Root strict, root-config typed lint on all touched TypeScript files, both focused artifact regressions and private-index hooks passed.
