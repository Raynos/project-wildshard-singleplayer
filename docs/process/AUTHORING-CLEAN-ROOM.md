# Authoring clean-room report (G320)

The nightly `Authoring clean-room report` workflow runs on Linux at 08:47 UTC,
or through `workflow_dispatch`. Its artifact records the exact Git SHA and
every registered generator's result. It is report-only while authoring ports
are incomplete; an infrastructure error still fails the workflow.

Run `node scripts/generation-clean-room.mjs --out=<report.json>` locally. The
runner creates an owned Git archive of HEAD. It deletes every `runtime/` and
`*-legacy/` directory under `src/`, including SDK runtime facades, and every
declared generated output before running any producer. The shared generation
backend receives a new, isolated cache directory. Source checkout files and
existing caches are unchanged. Only outputs with verified matching hashes are
made available to subsequent producers in the same archive.

G320 authoring inputs belong to the shard's `generators/`, `data/`, `quests/`,
`blender/`, `assets/` or `behaviour/`, or the SDK and commons. Package and lock
metadata may key the job. `authoring-inputs.mjs` walks literal imports through
defining package exports, including type imports and SDK implementation
dependencies. It reports runtime, engine/game, other shard, unresolved,
computed and glob imports. It reads code without importing or executing it.

A page/browser producer, runtime loader, generated-output source seed,
forbidden input root or unsupported Darwin-only byte comparison remains an
explicit blocked job. The report includes unregistered producers and a status
for every shard's product. A shardfile with no retained generation job remains
unavailable. An asset match alone does not close its shardfile status.

The first real baseline had 30 registered jobs and no authoring-only matches.
This is the migration inventory, not a clean-room pass. Nine's layout still
reaches native geometry/recording helpers; the page physics jobs still capture
client registration. The Pine coat page is a separate probe because its
`riggedHullRows`, `riggedHulls` and `hulls` imports now reach trusted runtime.
These sources must become retained authoring producers before their rows can
report a match. Linux never receives a guessed Darwin bit-exact verdict.
