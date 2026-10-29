# Authoring clean-room report (G320)

This is the historical G320 report for the retired generation-job pipeline.
The former nightly report recorded the exact Git SHA and each registered
generator result; an infrastructure error failed the report.

Current commands and producer ownership are documented in
[GENERATION.md](GENERATION.md). The retired clean-room runner is no longer
a local command; do not export a copy of the shared repository to run it.

## Historical report contract

G320 authoring inputs belong to the shard's `generators/`, `data/`, `quests/`,
`blender/`, `assets/` or `behaviour/`, or the SDK and commons. Package and lock
metadata may key the job. `scripts/authoring-inputs.mjs` walks literal imports through
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
