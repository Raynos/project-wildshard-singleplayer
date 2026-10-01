# E357 L3 — m5 baseline record

Runtime: `73c51589185ad7ea3a3eba1c70edb87db717a58b`, after the source fixes and G14 passed the paired full clean-export gate. Three concurrent repetitions, four originals plus `_template`, phone and desktop, full fingerprint/poses/walk/combat/pause/unload profiles. Signal Dunes and Sky Reach are excluded from recording. Prior baselines come from `720dd05b`'s tree, recorded on `479cc5fb` and accepted/repaired in `8dc8ad55` / `45106e0e`.

The runtime cache's clean export is initialized with `pnpm gen` then `pnpm exec vite build`, matching the full gate. Direct Vite build exposed G14's missing boot-table initialization before standalone shard derivation; sol-g13 owns that cold-start generator fix. The lead explicitly approved this bootstrap sequence; it changes no runtime source.

Every changed assertion field is listed with its cause in the accompanying JSON. Existing class-C timing, heap, capture paths, pose mask observations, route traces, record dates and replay census information retain their informational classification. All class-D checks remain enforced. No masks, thresholds, pending board entries, quarantine or ambient-info settings are added.

Accepted causes:

- J11/J12: Nalati owns crouch; other shards lose its hidden touch disc. Bow auto-shot is removed.
- R9 (`eb3d9a78`): Pine's three people, Nalati rigs, Driftwood Captain/Sailor preload before play. Pine draw/triangle/resource increases are intended.
- J10: key-binding table. J14: BRACE ring/disc removed. J13: tappable ammo-chip markup.
- G6 (`26b5f6b3`): depth clearer removed; starter lantern actually drawn. G7/L8: sky program ownership changes.
- L6: Bag/map layer ownership. J15: template HUD and device save read.
- sol-fin L5 (`2e6c1260`): spawn clears a live dash. Nalati sabre swings 7→3, kill 4.241333→1.708 seconds, lunge +1 and stale footsteps removed.
- Z3: new shard keys appear in boot save reads; no new shard baselines are recorded here.
- J1/J2 (`47ce62e7`, added by lead): Pine listener follows player; distant Nalati colonies pause. Nearby sentry whistle still emits exactly once after approach; three targeted cadence/listener/whistle tests pass.
- G10 (`87a54828`, separately accepted by lead): template manifest's `#engine`→`#engine/data` import changes the shared audio RNG phase. Nalati's combat ambient marker loses `steppe.marmot`; the scheduler still runs. At identical combat-start clock 98.233333, parent `badca136` has 9.167630 seconds remaining, G10 has 11.171712 seconds. The same 11.041333-second combat ends with 0.130379 seconds remaining on G10; parent has fired/reset. SteppeAmbience's source is unchanged. Full parent/child captures include identical pose/walk prelude, and earlier marmot callbacks appear on both. L5 parent and child retain the marker, so the shortened route alone is not the cause.
- J6/L9 (`dee61b01`) and L3 budget fix (`b65d860a`): calibration-derived budget payloads; template current-view count observations (46 draws/11833 triangles phone, 71/14993 desktop); measured Pine desktop R9 ceiling 1318.5415477752686 MiB from captured values, generated with lead approval and SHA256 provenance. No number was hand-entered in a limit file.

The initial 30-capture record on `720dd05b` correctly refused all writes on missing template count observations and Pine's stale desktop GL limit. The source fix records frozen current counts only when there are no standing parity poses; real shards keep their standing poses and prior budget coverage. The combined `73c51589` full gate passes. Its parent budget candidate boots the four originals with `boot.errors=[]`. The fresh record passes all ten pairs with no class-D reds or unexplained assertion changes; all 24 original old-vs-new image scores pass (minimum 0.9899873475), and all 24 poses were visually inspected.

Z4 leftover, requested by the lead: **SteppeAmbience draws from the shared RNG, so unrelated import changes move its phase; give it its own seeded stream.** The lead files the leftover ask; this job makes no ambience change.

Complete raw captures and bisect records: `/private/tmp/e357-sol-base/`. Runner bootstrap was dispatched as GitHub run `36934798431` on `720dd05b`; the lead owns its long wait and artifact collection. This record does not accept artifacts from the two new shards.
