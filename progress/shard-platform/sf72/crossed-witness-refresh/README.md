# Witness refresh after the crossed shared-source landings

Re-recorded from clean committed HEAD `49a7a133feaa3cd5ef3949280baba12e606f51b1`,
which contains both SF73 entry/save changes `2f765d83b` and SF72 body/contact changes `794c4e128`.
The contact candidate had recorded before the SF73 loaded-module changes; its metadata projection
did not re-execute the witnesses on the final merged tree. The push gate correctly refused those stale fences.

Ran each shard's official `run.mjs checkpoints` mode, not a synthetic hash rewrite.
Every one of the **14 `.snap.gz` files and the Driftwood command tape is byte-identical** to HEAD;
the before/after SHA256 values and actual recorder durations are in `payload-equality.json`.
All manifest fields except `inputs` are identical. Pine and Driftwood's real `record` modes also
reproduced every compatibility outcome exactly, changing only their input hashes.
No gameplay, source, bake, snapshot payload or compatibility claim changes in this forward.

Validation: clean `pnpm gen`, then queued `pnpm exec vitest run test/proof --maxWorkers=4`
(heavy-lane ticket 1123): **33 files / 50 tests passed**, 35.70 s. Private source-only hooks
before CAS are green. Coordinator alone pushes.
