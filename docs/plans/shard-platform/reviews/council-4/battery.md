# SHARD-PLATFORM council 4 (E447): the battery

Scenarios the plan must answer. Walk each through the plan; a step it doesn't answer is a finding. Seats may add
scenarios; they stay.

1. **Cold pickup of F0.** An agent with no context picks up SF1 and then SF4. Can it do each without guessing (files,
   fixtures, gates, done-when)?
2. **Build M1.** Walk SF7 → SF16 as the executing agent. Where would you stall, guess, or build the wrong thing?
3. **A fresh outside author** with only the SDK (the S19 trial; M1 proves the template only) builds a small shard: a door puzzle, one creature type,
   a two-step quest, a reward. Which SDK pieces exist at M1, and which gaps are expected?
4. **The drive.** A player on the phone drives from Driftwood Isle to Nalati Grasslands through a crossroads at
   30 m/s with a 3 s network stall. Which rows make every second of that work?
5. **Pine Hollow onto the grid** (SF47): 587 MB of phone GPU today. What does the plan say it must become, and in what
   order?
6. **A future MMO server team** loads a shardfile unchanged. What does it rely on that this plan guarantees, and what
   would they find missing?
7. **Modes and toggles.** Signal Dunes in dev mode on the grid; Nine Dragon in DEVSERVER mode; explore mode one shard
   at a time. Is each surface specified (where the toggle lives, what the player sees)?
8. **A look under the one-frame rule.** Nalati's painterly look cannot be a full-screen pass any more (SF19). What
   happens, and how does Jake decide?
9. **A hostile or buggy script** in the singleplayer client: an endless loop, a memory hoarder, a NaN effect, a reward
   fact replayed. What does the player see, and what does the host do?
10. **An API bump in alpha.** The SDK API moves from v0 to v1 inside the ~72-hour window with three shard projects
    (template, Driftwood, an outside author's). What runs, what breaks, who upgrades?
11. **An iOS memory kill on the grid.** The phone kills Safari's WebContent while the player is in INFINITE WILDSHARD;
    Safari reloads the page. Does the player land somewhere safe, and can they still play one shard at a time? (round 2)
12. **The resume.** The coordinator's context is compacted mid-row while Jake is away (G109 may also pause it). A fresh
    agent reads only AGENTS.md and the plan (State, §9, §10, Handoff). Can it pick the next row, its owner, its gates and
    the push protocol without guessing? (council 2)
13. **A legal shard.** An outside author builds a new shard from the SDK. Walk G93 / G99 / G103 / G131 / G104: what must
    its shardfile declare (entries, width, depth, accent, edge profile), what does `validate` refuse, and where is each
    rule written? (council 2)
14. **The crossing, second by second.** On the phone: inside Driftwood with the sword → the border → the boulevard at
    30 m/s → a roundabout → Pine Hollow's turn-in → inside Pine. Name the row and rule behind every visible change
    (weapon, mount, HUD accent, SAFE ZONE chip, minimap, title card, speed look, save wait, respawn). (council 2)
15. **A seam the generator can't blend.** Nalati's west rim (median 49.6 m, max 101.6 m) beside the boulevard, with a
    midpoint entry cut through it; then Sky Reach's cloud-sea edge. What does each stretch become, within which budget
    (G101), and which row builds it? (council 2)
16. **Jake comes back after 48 h** and opens the deployed game on his iPhone. What should he be able to play, what is
    still greybox, and what boards are waiting for him (G120, G122, G123, SF19b)? (council 2)
17. **The 80/20 port of Pine Hollow.** From 0.2 % public today to grid-ready and 80/20: the order of work, the memory
    rule (G110), the entries (G103, G131), the look (G111, G112), and how its old path retires. (council 2)
18. **Template 2 from Blender only.** An agent builds SF55's Blender shard with no generator: one world GLB from a
    Blender script, data rows and AssemblyScript. Walk it through `wildshard build` to an admitted shardfile: what does the
    SDK bake (tiles, LODs, colliders, far proxy, entries, families), what must the author supply, and what refuses it?
    (council 3)
19. **The memory soak fails.** SF57's 30-minute Simulator drive shows the footprint climbing after unloads, and the grid never
    reloads (G171). Walk the route: attribution, our own retention fixed first, then a per-shard content-cut board (G65);
    what stays Developer-only and what M2-ready counts as Jake's gate. (council 3, rewritten for G171)
20. **A hostile upload.** A stranger's shardfile lists 3 GB of orphan files, a script that loops forever, a 4096² texture
    on every face and a compendium sketch pointing at a tracking URL. Walk admission and SF58: what refuses what, and
    what is still open? (council 3)
21. **The dev-map look shipped** (G163). Check SF56's row, the deleted Debug row and SF59's re-expression as a graph are
    consistent. (council 3, updated)
22. **Driftwood after G164 / G170 / G172.** An old save from before the drop loads; the player walks from the road's entry
    deck up a pier ramp to dry sand; the memory rows are on (G173). Name each rule, row and fixture. (council 4)
23. **Pine Hollow at 1,192 MB** (G180). Apply the four cuts, then the content-cut board: who measures, on what ruler,
    what reaches Jake, and what keeps Pine out of the grid meanwhile? (council 4)
24. **Sky Reach's entry is undecided** (G176) and Nine Dragon's climb is a mockup (G177). What may an unattended agent
    build for SF49-g / SF51 now, and what must wait? (council 4)
25. **A material-graph shard** (SF59, G169): build the ink / cel valley stress case as a fixture shard: graph files,
    post stack, the cell-edge switch (G158, G175), the GPU budget, SF58's graph caps and fuzzing. (council 4)
