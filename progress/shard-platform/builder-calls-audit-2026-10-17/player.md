# E487 player-facing audit (agent finished 2026-10-17 ~22:58 Cancun)

Headline: ports faithful (parity proofs, exact replays, old saves restore; 7 before/after boards match). No enemy/quest/ride/NPC behaviour silently cut. ~80 commits read fully. 3 STEER · 11 WORTH KNOWING · ~470 TRIVIAL.

## STEER
S1 Memory gates can't fail; Pine already over. dc01e03fb added src/format/memoryGates.json mode: report-only (no gate refuses at any size) and raised phone texture-switch / grid-admission threshold to 1,200 MB. G433 lifted cap to 1.2 GB, never said stop failing. STATE showed Pine estimate 1,219 MB. Fix: enforce at 1.2 GB (one line).
S2 Daily "Calls for Jake" list (G352) dropped on 10-14 (393de57ca); absent in 90 STATE versions since; only 8 CALL: lines in 1,534 commits. "Coordinator-approved" stood in for Jake on look boards, new comparison rows, ratchet raises, boss replay rebake (659d7935c, e3137bb6b, d24ef264c, 07597ee1d, 7346c8f93, a88e5e415, 4068a3603). Root of E487. (G495 trailer now covers it.)
S3 Risky phone-memory changes shipped default-ON with no iPhone reading (rule: default-off Debug row first): ef70dd7ff music streams AAC (Simulator-only), 9bf3084da image decode/memory pacing (after-measure not done), the 1,200 MB threshold. Production frozen at 10-13, so they reach the phone in one jump. Fix: Debug row each, or one real-iPhone run before the unfreezing deploy.

## WORTH KNOWING
W1 Bosses/elites/Pine night waves on AS at 10 Hz (a68cc666a, 17ef0c2e8, f4e0c85ae; 10 Hz = G454). Re-recorded fights changed (7346c8f93): Captain damage to player 0→24, Pine King fight 88.93→77, victory ticks moved.
W2 Similar-not-identical looks approved by coordinator not Jake: Nalati grass (MaterialX noise, desktop cards alpha-cut not A2C), river, storm, Titan, ground (60b2e883b, 4c967cd0f, 9cfdf3e46, 75e8f545a, 14491fc52); Nine neon 3–6/255 dimmer (43915465d), steam phase (60606acb5); Sky storm rhythm (07bc43f9c). Recommend board per shard live 10-13 vs HEAD, Nalati + Nine first.
W3 Nalati camp smoke lost painted fog: after 2384aa14d nalati-camp-smoke graph doesn't select nalati-fog (water/grass/puddles restored in 908dcec0a). One-line fix.
W4 Regressions sat on main, lanes fixed (no player saw): Pine King kit missing on grid re-entry ~15.5 h (7bc1c2ca8→efd7adc4d); DW wood sword refused at boot (e658785b3→614aac37d); Nalati fog gone ~2.5 h; Nine portals paled/reverted/re-landed; unlit graphs paler on baked maps (b835bba67, rebaked 7d723d42a).
W5 DW reef school: all fish size 1.25 (was per-fish), shared flock pattern, Model Explorer 70→66 (67c4656fb, 23594c7d8).
W6 Sky storm lightning fixed beat ~3.9 s / 8.7 s alternating (was random 3.5–8 s); cosmetic strike hook gone.
W7 G416 purge (819a36b8d, 10-13) deleted real behaviour tests: DW quest spine test/quest.test.ts, corrupt-save coins test/loot.test.ts, saves-persist, walk-in-pickup, sky-quest-stages, physics-walk. Some coverage back since. Restore the two cheap ones.
W8 Missing assets now crash instead of degrade (b335803c1, 45e79bb0f, 3ef50911b; per G422); Nalati camp keeps a fallback — uneven.
W9 Boot download growing (G412 allows): DW cover cells ~3.1 MB/tier, ground +2.35 MB, pier +1.55 MB gz, cove 2.7 MB, Pine NPC skins +1.03 MB; logged in download-diet.md.
W10 First-person sleeves: Nalati recurve ~6k verts (62d6529a2); Pine 19.6k→7.3k earlier.
W11 DW hoverboard deck, boundary poles, blood decals lost toon shading → plain PBR (0b64213ef); board shows no visible difference.

## TRIVIAL
~420 shard refactors with proofs; ~25 look ports with matching boards; ~15 confirmed-dead deletions. Debug rows net +1 engine (fixedShadowSamples, default off) +1 Developer comparison; 8 perf rows added+deleted 10-16. No URL switches. Jake-asked/ratified: DEV switch, PORTED badges, G442, G463, G472.
