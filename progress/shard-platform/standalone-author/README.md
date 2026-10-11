# OS-F10 standalone author setup

PASS for the documented archive-consumer workflow on Node 24.18.1, macOS.
Three local SDK/format/commons archives, an empty author directory, no workspace symlinks
or scratch dependency repairs. The SDK archive contains both ordinary clients and the retained TS reference.

The final SDK build used the heavy build lane (58.41 s). The isolated consumer proof took 27.95 s:
install → bootstrap → typecheck → synth → generate → build → validate.
Validation completed 240 native ticks, 92 edge lanes and 46,102 capsule steps.
The generated product includes the normal client and immutable catalogue assets.
The source remains readable TypeScript: Scene, Mesh, BoxGeometry, PlayerStart and four Entry.midpoints.

The retained runner is scripts/docs/proof-standalone.mjs. It refuses a reused project and checkout links.
Commands and exact package/declaration closures are documented in scripts/docs/standalone-author.md.
One earlier run built successfully to the CLI's default public/shardfiles folder but the reference
validate script expected dist; the fixed reference requests dist explicitly. No failing run is claimed.

Prerequisites landed: b1d5def8b (same-graph synth), a5433a26b (packaged exports),
37741da82 (official clean-export workspace dependency links).
Generated template files are outside the repository's source compilation; the isolated author project
typechecks those retained TS files itself. Root rules were applied explicitly to executable docs,
whose folder is otherwise ignored by lint.

Browser play and frame/memory floors are UNMEASURED. This is a minimal floor reference, not the full
one-shot outpost. OS-F1 owners are landed separately; OS-F2's genuinely equipped commons spear
remains OPEN because an admitted spear view/family is not present. No scenery/sword substitute is credited.
