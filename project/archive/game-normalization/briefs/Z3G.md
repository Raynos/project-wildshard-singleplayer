# E357 job Z3G — fix the new shards' API gaps in the public API (11 §Z3 step 4)

Read `docs/plans/game-normalization/brief-common.md` first: its rules bind you. Then read
`docs/plans/game-normalization/reviews/shard5-gaps.md` (the gap list, G1–G12), the "API gaps" sections of
`docs/tasks/asks/E363.md` (Signal Dunes) and `docs/tasks/asks/E364.md` (Sky Reach), and `docs/ENGINE.md` §6, §10, §13.1,
§19, §21.

## The job
Every gap becomes a public-API fix: the verb / field / event in `#engine` (or `#engine/data`), a focused test, and the
ENGINE.md lines (plus SHARDS.md and `src/shards/_template/` where the gap names them). Then move the two shards off
their workarounds onto the new API (`src/shards/sunscar-dunes/`, `src/shards/far-reach/`), so neither touches an
undocumented field. Order:
1. **G1** `app.player.mode` + `player.mode` event → Sky Reach's hover bridges use it.
2. **G6** a viewmodel root on `app.equipmentHost`; the engine keeps the camera in the scene and owns the one depth-clear
   viewmodel pass (kit families stop copying it, parity unchanged) → both shards and the template whip use it.
3. **G2** a `flight` block for species (altitude, climb/dive) + a 3-D strike shape → the dune ray and the manta use it.
4. **G3** a documented creature impulse and a fall / out-of-world death cause → Sky Reach's GUST uses them.
5. **G4** open `ShardManifest.style`; **G7** the engine adds a backdrop's `clouds` dome; **G9** document `horizon`
   fully and let a shard drop or reshape rings / boundary; **G10** one `buildTerrain` import path in SHARDS §3 and the
   template; **G11** `gen-shards` writes one slug's entry; **G12** SHARDS documents a check export without `public/`.
6. **Last, after sol-j11 (J11) and the J10 key-bindings job have landed** (they hold `src/engine/input/**` and
   `src/game/inputContexts.ts` now): **G5** `touch.relabel` on the melee attack disc + §10 names the disc spots;
   **G8** a custom melee context inherits `weapon.melee`'s keys, and the template / SHARDS §5 step 4 show `heavy`.
   Ask the lead before touching those files.

- Each gap = its own commit (`E357 Z3G: G<n> …`), flipping its row in `shard5-gaps.md` to `fixed (<sha>)`.
- Parity on the four original shards must not move (`--only=fingerprint+poses`, phone, unwrapped); boot both new shards
  too (`--shards=sunscar-dunes,far-reach`), `boot.errors` empty. G6 touches every weapon family: run `walk+combat+leak`
  as well.
- Hot files (decision 110): manifests, `plugin.ts` files and layer index files go through the lead as exact hunks
  (or a private candidate the lead fast-forwards); a single export line you may commit yourself (HEAD + that line).
- Owns: the engine / kit files each gap names, the two new shard folders' workaround lines, `_template`,
  `docs/ENGINE.md`, `docs/SHARDS.md`, `shard5-gaps.md` rows, tests for these.
- Stop at 400k context, 90 min or ~200 turns, whichever comes first: commit what is done, update your Handoff in
  E357.md, report ≤ 40 lines with what is left.
