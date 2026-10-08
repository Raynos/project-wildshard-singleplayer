# Entered-hook CPU trace (E435)

`hooks-1cca1dcc2.json`: pin `1cca1dcc2`, build `1cca1dc-muz1tbpz`, one muted Chromium/Metal iPhone 16 Pro, Developer ON, phone Auto, 2x. Same real-input Pine then Nalati route as the ledger; both destination witnesses pass, source regions retire, no page errors. Browser and preview :4405 closed. This is a CPU diagnostic, not a frame-floor or native-memory measurement.

The CDP profiler samples at 5 ms. The probe maps emitted frames through that build's hidden source maps and correlates the page performance clock with the bounded runtime hook transcript. Sample time estimates ownership; they do not replace wall durations.

| Hook | Wall ms | Dominant source |
|---|---:|---|
| Pine world | 383 | Smaller procedural world work |
| Pine afterKit | 5,638 | 3,028 ms sampled in `species/coats.ts:208` flap transplant; 1,342 ms in `coats.ts:331` coat generation, via `hulls.ts:202` → `looks.skin` → AnimalFactory.model → AnimalManager.spawnHerds |
| Pine play | 423 | NPC rigs and encounter creature coats |
| Nalati world | 1,298 | `paint.ts` / noise / voxelAO, outcrops and KurganDungeon construction |
| Nalati afterKit | 602 | 329 ms sampled in `species/coats.ts:164`, via wildlife spawnHerd / attachAnimals |
| Nalati play | 115 | Camp people figure rigs |

Pine has a separate 3,945 ms task immediately after afterPlay completes. This capture grouped CPU samples by hooks only, so it does **not** identify that task's owner. The probe now also groups samples by long-task intervals for the next capture.

The trace found a configuration bug to verify next: regional foundation/entered hooks did not install the destination's measured G188 texture policy or register its KTX2 overlay. Standalone does both before asset requests. Pine's compressed rig/coat path avoids procedural coat painting; its regional path could inherit the home's Images choice. The fix must preserve Debug precedence and restore the home policy on leave, then prove the actual requested rig URLs. No measured-runtime discount is taken from this inference.

Generic stage presentation pauses are `4c2e78d04`; scoped engine texture policy primitive is `e19077727`. Remaining single synchronous renderer/content builds are routed to the coordinator with these source stacks. A passing route is not a claim of stall-free entry.
