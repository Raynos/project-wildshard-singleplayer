# SHARD-PLATFORM council: the frozen ledger

Settled. A seat may reopen an item only with **new evidence** (a file and line, a quote, a source) that it is wrong;
preference is not evidence.

1. **The scope** (Jake, E435, 2026-10-03, G41): *"This plan and goal is purely to make shardfiles that are MMO &
   multiplayer compatible, I do not want to build any multiplayer code, I want to refactor the singleplayer game to be
   about running a singleplayer three.js game that contains shardfiles that are MMO/multiplayer compatible."*
2. **Every answer in the plan's §10, G1–G47** (Jake, E435 grill, 2026-10-03/04), quoted there. In particular: code-first
   (G1); fixed core + modes (G3); families → graphs → shader code (G4); auto-bake (G5); the commons (G6); entity
   scripts + director (G9); server + client scripts (G10); quests as data (G11); brains + custom (G12); no global coin
   (G25); one world clock (G27); the API window ~72 h until the public grid (G29); the AI playtester with Clef / Jev
   (G31); renderer-neutral (G32); travel only like Black Desert (G33); the highway as the platform-owned seam (G35);
   no-man's land outside the cells, N = 20 m to start (G37); unbounded-ready (G38); thin M1 (G42); conversion from M1
   (G43); up to six council rounds (G44); compatibility checks, no network (G45); the singleplayer grid of three shards,
   five in dev mode, Nine Dragon in DEVSERVER mode (G46); everything local or static, WorldClaw out of scope (G47).
3. **The plan's §8 picks Q1–Q5**, including Thin Ice staying code (Q1, confirmed in E435) and package-first (Q5).
4. **MMO-REQUIREMENTS §6 decisions 1–20** (E431, E435), including AssemblyScript first (O4), full server authority with
   a progress ledger (M1, M8) as a compatibility target, two wallets (M6), the two 80/20 measures staged to 100/0
   (T2), the kit becoming the SDK (T6).
5. **Repo rules** (AGENTS.md and docs/process/): render scale 2× on the phone; memory 1.8 GB loading / 1.0 GB playing;
   no URL switches (Debug rows only); a look change keeps the old look as a Debug variant; a risky render or memory
   change ships default-off behind a Debug row; no facade multi-draw; `src/engine/physics/` owns collision; HUD
   changes go over herdr and to Jake (E332); Jake does no phone chores except where he chose one (the one physical
   crossroads reading, E435).
