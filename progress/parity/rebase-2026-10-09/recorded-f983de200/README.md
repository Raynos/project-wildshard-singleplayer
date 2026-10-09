# Completed M5 rebase (SF57, E435)

All four remaining shards have **three independent captures per tier, phone + desktop, GREEN** on the clean `f983de200b2b54ccde9cb551cc41188c24445222` build. All 24 captures report zero texture, program, geometry, body and collider leaks; Pine and Nalati's separate rain unloads also report zero. No page/disposal errors, stuck walks, tolerance changes or assertion relaxations. The baseline commits contain only each shard's clean-export JSONs/JPEGs; the foreign working-tree `meta.json` was never read into a commit.

| Shard | Baseline commit | Old-to-new image minimum, phone / desktop | Classified numeric changes |
|---|---|---|---|
| Nalati | `513b95f14` | .999739 / .999903 | exactly the three shard migration / profile ledger keys (`28fe9f479`, `a4ffb1c2d`) |
| Signal Dunes | `ca8e97149` | .990491 / .993887 | exactly the previously bisected ray, baked instancing, memory-saver, count and draw changes in the parent receipt |
| Pine | `ac9d055a1` | .999616 / .999517 | four removed entry blockers, registry/count/draw changes, contact-solver endpoint and ambient observation windows |
| Nine | `a12e1a3db` | .982853 / .993230 | phone's three accepted minimap changes (`f9a2e7493`, `fce37c222`); no numeric red |

The three Nine phone diff images were inspected: the changes are concentrated in the minimap disc, matching the earlier bisection. All other pose scores meet their unchanged old thresholds. `old-to-new.json` names every red field with its old/new value, band and classification. `records.json` includes the real self-image minima, measured numeric spreads and each individual run. Adjacent compressed raw captures preserve the actual probe responses.

## Pine's two side effects

All **six recorded walks** contain `pineLife.drum` and `pineLife.woodpecker`. Phone combat's three windows contain woodpecker/thrall but no drum; desktop's later windows contain thrall in 2/3 runs, so their correctly intersected ambient baseline is empty. These are scheduler observations, not removed sounds: drum bouts are short, player-distance-dependent and occur before the combat window. `77772d696` did not change PineLife or its RNG seed; the original receipt's claim of a changed seed is superseded by this source check and actual sound evidence.

Phone climbs end at `(34.926, 57.477, 211.280)`; desktop at `(34.916, 57.477, 211.286)`. These are the two roughly 1 cm contact-solver endpoints already observed after four distant colliders were removed/reordered. Each tier's three runs is stable; every walk is zero stuck. The separate five phone leak proofs landed on the other endpoint. Only the actual three-run spread is recorded; no artificial band is added.

## Commits after the original 77772 pin

The `f983de200` record includes Signal's `ac189becd` skitterer bake, Nalati's `fd32b3203` / `92f2347c5` host group clocks, Pine's `8f982a5a4` navmesh rebake, the `950eecdf9` quest ledger alignment, Signal's `e42533833` far baker relocation and `a755bf10e` interaction declarations, Pine's `609b3beef` zipline shared motion / `b20b732dd` headless tape, and `b0c280ca9` headless constructor fields. None adds an unexplained standalone field/image red. The later Pine/Nine checkpoint work changes test/witness files; the later shared body-band commit exposes its existing pure module without changing runtime behavior.

Signal's runtime changed again with `741b37a06` after the record pin. A fresh clean `306f6e9580a5377745b0a2f6b1cb02d1110578a6` build is **GREEN on phone and desktop** against the recorded baseline (no retries), covering that extraction too. An initial comparison ran before the updated fixture was installed and used the obsolete Signal baseline; its classified reds are retained as `latest-signal-*-stale-fixture.json.gz`. The fixture was corrected before a separate full capture; no game code or assertion changed.

## Validation and scope

The code proof is in `../leak-fixes/`: five final-pin unloads each for Pine/Nine, five Pine rain unloads, four real boot smokes, the clean full suite (1,054 files / 5,838 tests), typed lint/strict/guards and the green serialized code gate. The coordinator's existing SF57 soak owns continuous sampling; no extra Simulator soak was started. That separate public soak's cells leg is still red on its recorded memory rule (b), not a leak failure; this receipt does not turn it green.

CI-runner baselines remain the coordinator's dispatch. These records are the M5 lane only.
