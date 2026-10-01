# E357 F6 codemod

Run from the checkout root:

```sh
node scripts/normalize/classify.mjs --check docs/plans/game-normalization/move-map.json
node scripts/normalize/move.mjs docs/plans/game-normalization/move-map.json --dry-run
pnpm exec vitest run test/normalize-move.test.ts
```

The dry run prints the complete report and writes the identical JSON to
`/private/tmp/e357-f6c/dry-run.json`, outside the shared checkout. It returns 1 for missing move inputs,
unresolved local imports, destination collisions (including case-only renames), or cross-shard edges.
Unmatched path literals are warnings, including computed paths and directory/glob literals needing a manual edit.
The report contains every touched path for the lead's separate, committed rollback manifest.

`classify` never writes the map. It checks every current source file, reports unmapped files with proposed rules
and destinations, and recomputes I/G/N/M ownership against the syntax import graph. Reviewed destinations seed
recursive ownership groups; new importers can retract ownership until the graph reaches a fixpoint.
The M override array carries a reason for every mechanism. Semantic renames come from the reviewed map.
G uses positive conditional branches and locally derived gate names; it ignores type positions and `instanceof`
checks. Unproven ownership is reported rather than accepted. F7 null-destination tombstones are expected deletions.

`move` plans imports, globs, literals, comments, docs, config and ratchet re-keying in memory before any mutation.
Imports use aliases across layers and from tests; unchanged tooling/public targets remain relative. Assets retain
their extensions and query suffixes. History directories, the input map, this tool and its fixture directory
are excluded from rewriting. Generated `docs/MOVED.md` lists every old, interim and final path.
The report includes the reviewed manual edits; these belong to the lead's real F6 commit.

Without `--dry-run`, the tool requires a clean tracked tree, no untracked source/test/script files, a passing
classifier, F4 ratchet tooling, and a passing virtual-tree preflight. It uses path-specific `git mv`, writes only
changed contents, records the initial layer ratchet at F6, and then runs the lowering-only ratchet check.
A completed second pass writes nothing. Later moves use `--row S2.3` (or the other reviewed row), matching
the map's arrow suffix and moving its interim path to its final path. Deletions remain their owner's job.

F6c ran only the classifier and dry run against the real tree. Parity and a real move are the lead's work.
The parser is `@typescript/typescript6`; TypeScript 7 remains the project's compiler.
