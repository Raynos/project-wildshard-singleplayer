# How authoritative should the Wildshard server be? An audit of server-authority approaches for a player-authored browser MMO

> Clean-room research for ask E435 (Claude seat). 2026-10-03. Read-only for the repo. Context taken from
> `docs/design/mmo/VISION.md` and `MMO-REQUIREMENTS.md` (M1–M7, R2/R7, O5, B1). Every external fact carries a URL.
> **[unverified]** marks claims I could not source, and my own estimates. Where a source is only a search-engine
> summary of a page that blocked fetching, it is marked *(via search summary)*.

---

## 0. The answer on one page

**Recommendation: approach 5, built on approach 1. The server owns everything that touches progress or other
players. Phones predict only their own character. Progress has one ledger that only the server writes.**

Spelled out:

1. **The room simulates the shard.** Each shard room runs the same TypeScript engine sim headless in Node: Rapier
   WASM, the fixed 60 Hz step, the seeded RNG, the logic graph, archetype brains, boss phase tables and the WASM
   plugins. Creatures, combat outcomes, doors, puzzles, pickups and quest state exist on the server only. Clients
   render them, interpolated about 100 ms behind.
2. **Your own movement is predicted and re-simulated.** The phone sends **inputs, not positions**. It predicts its
   own character with the same motor code and reconciles when the server corrects it. This is the model Roblox
   shipped to all creators in July 2026 after eight years of client-owned physics, and the one Bedrock offers as
   `server-auth-with-rewind`.
3. **Hits are lag-compensated on the server.** The client sends "I swung or fired at tick T with this aim". The
   server rewinds creatures to what that client saw (capped at about 250 ms) and settles the hit itself.
4. **Purely cosmetic things run locally**: particles, flocks, wind, ragdolls, foliage and ambient critters. They
   cannot affect state.
5. **One server-side progress ledger** is the only writer of loot, XP, coins, gear, titles, achievements and
   activity events. Room sims send it *facts* ("player P completed quest node Q in shard S at revision R"). The
   ledger applies them as idempotent, atomic transactions under per-shard reward budgets that it calibrates from
   observed play.
6. **Activity ranking gets its own anti-sybil layer.** Server authority stops *impossible* actions. It does not stop
   *automated possible* ones (OSRS is strictly server-authoritative and still bans about 67,000 accounts a week).
   Farming the ranking is an economics problem, not a netcode problem.

**Why:**

- Wildshard's content is already data run by engine-owned systems (R1–R7). The engine can therefore make every
  shard multiplayer-correct without authors ever writing netcode. This is the UEFN/Verse lesson. The opposite
  pattern (VRChat, Rec Room, Garry's Mod, Roblox before 2018) produced a decade of insecure creations.
- A browser has **no client-integrity story**. There is no kernel anti-cheat, and the JS can be read and patched. So
  approaches 2–4, which work for Blizzard, ArenaNet and Facepunch only because Warden or EAC carry them, are weaker
  for Wildshard than for any case study below.
- Server authority also takes creature AI *off the 30 fps phone*.

**The five things to decide or build first:** see §5. In short:

1. The authority map as an SDK contract.
2. A deterministic headless sim with an inputs-not-positions protocol and a client/server parity hash test.
3. The progress ledger.
4. The anti-farming design for the activity ranking.
5. The room runtime: process model, sleeping, interest management, server-side budgets, transport, and phone
   reconnects.

---

## 1. Case studies

Each block covers: authority model · tick rate and netcode · UGC and sandboxing · cheats that came from the
authority choice · scale.

### 1.1 Rust (Facepunch)

- **Authority:** a hybrid that leans toward the client. The client sends ticks of input and state, by default 32 per
  second (`player.tickrate_cl`). The server applies a battery of **antihack validators** instead of fully
  re-simulating the player:
  - `flyhack_protection` (0/1/2, plus `flyhack_forgiveness` and `flyhack_reject`)
  - `noclip_protection` (default 3: ray/sphere/curve)
  - `eye_protection` (default 2: distance + line of sight)
  - `melee_protection` (default 3: initiator + target + LOS)
  - `projectile_protection` (default 3: speed + entity + LOS)

  [gameserverkings](https://www.gameserverkings.com/knowledge-base/rust/packet-flooding-player-tick/),
  [gamehostbros](https://guides.gamehostbros.com/games/rust/configure-your-server),
  [physgun server.cfg guide](https://help.physgun.com/en/article/setting-up-the-servercfg-for-your-rust-server-cojpuo).
- **Tick:** `server.tickrate` (network send rate) defaults to 10 Hz and community hosts run 30 Hz for PvP.
  `server.fps` is the separate simulation rate
  ([supercraft](https://supercraft.host/wiki/rust/performance_optimization/)) *(community source)*.
- **UGC:** server mods through Oxide/uMod (C#, trusted server-owner code, not sandboxed).
- **Cheats from the authority choice:** the validators are heuristics with "forgiveness" margins. Cheats live inside
  those margins:
  - Flyhack violations are a standing admin topic ([umod](https://umod.org/community/rust/14296-lots-of-flyhack-violations-on-my-server)).
  - ESP and aimbots exist because the client holds information it shouldn't.
  - Client-side spread is not sent to the server, so no-recoil cannot be fully checked
    ([programminginsider](https://programminginsider.com/types-of-rust-hacks-and-their-impact-on-multiplayer-balance/))
    *(low-quality source)*.

  Rust relies heavily on EasyAntiCheat, which a browser can't have.
- **Scale:** one process per server, typically 100–300 players **[unverified]**.

### 1.2 Minecraft: Java, Bedrock and Hypixel-scale networks

- **Java authority:**
  - Blocks, inventory, entities and mobs are server-simulated on a **single main thread at 20 TPS** that ticks every
    chunk and entity in order ([mineguard benchmarks](https://mineguard.pro/en/blog/minecraft-server-performance-benchmarks-2026)).
  - **Movement is client-reported**. The server checks distance per packet and rolls the player back with "moved too
    quickly!" ([MC-258862](https://bugs-legacy.mojang.com/browse/MC-258862)).
  - The ecosystem's answer is server-side anti-cheat that **re-simulates the client's movement**. Grim keeps "a 1:1
    replication of the player's possible movements", a per-player world replica, and latency compensation through
    queued world changes ([Grim](https://github.com/GrimAnticheat/Grim)). In other words, the community rebuilt
    server authority as a plugin because vanilla trusted the client.
- **Hacked clients:** killaura, reach, fly/nofall and speed
  ([wisehosting glossary](https://wisehosting.com/glossary/hacked-client)). Every one of them exploits client-reported
  movement or attack.
- **Bedrock:** `server-authoritative-movement` = `client-auth` | `server-auth` | `server-auth-with-rewind`. With
  rewind, the client rewinds to the correction time, applies it and replays its inputs. That is classic prediction
  plus reconciliation, retrofitted ([xgamingserver](https://xgamingserver.com/docs/minecraft-bedrock/server-properties)).
- **Bedrock UGC:** add-ons are data plus a server-side JavaScript Script API under a **watchdog**
  ([bedrock.dev](https://wiki.bedrock.dev/scripting/script-watchdog)):
  - hang threshold 3000 ms
  - spike 100 ms
  - slow 2 ms
  - memory warning 100 MB, memory limit 250 MB, which saves and shuts the world
- **Scale:**
  - Vanilla collapses around 100 players (7 TPS in that benchmark).
  - **Folia** splits the world into independently ticked regions on a thread pool. It holds 20 TPS at 100 players
    but breaks most plugins (mineguard, above).
  - **Hypixel** scales out instead of up: proxies route players into many small isolated instances ("350+ dedicated
    servers" by 2017, 100k+ CCU, 6 players max per SkyBlock island), and the custom *Watchdog* anti-cheat analyses
    movement and combat packets ([Hypixel wiki](https://hypixel-skyblock.fandom.com/wiki/Hypixel),
    [Watchdog](https://hypixel.fandom.com/wiki/Watchdog_Cheat_Detection)) *(fan wikis)*.
- **Lesson for Wildshard:** room-per-shard is the Hypixel/Folia shape, independent regions that each tick alone.
  Client-reported movement creates a permanent anti-cheat industry.

### 1.3 Black Desert Online (Pearl Abyss)

- **Authority:** reported as unusually client-trusting. A 2016 analysis said **movement, skill and potion cooldowns,
  minigames and HP/MP were held client-side**. Cheat Engine removed cooldowns, and only XignCode stood in the way
  ([mmos.com](https://mmos.com/news/client-side-data-makes-black-desert-easily-hackable), citing the MMOGFails blog)
  *(secondary source; treat as reported)*.
- **Cheats:**
  - Speed-hack farmers made 100–200M silver per hour in empty zones.
  - One Kakao ban wave hit 738 accounts, **356 of them for movement or attack-speed software**
    ([mein-mmo](https://mein-mmo.de/black-desert-bannt-700-hacker/)).
- **Scale:** a few large servers, each split into many **channels** (copies of the world). Dynamic channels open at
  80 % capacity ([mein-mmo](https://mein-mmo.de/en/black-desert-serverstruktur,68103/)).
- **Lesson:** a shared, populated feel (the quality Wildshard borrows from BDO) comes from channels and population
  management, not from trusting the client. The client trust is what got farmed.

### 1.4 World of Warcraft

- **Authority:** combat, loot, quests and economy are server-side. **Character position is client-determined** and
  checked by the server, so fake positional data enables teleport and speed hacks
  ([warcraft.wiki.gg/Hack](https://warcraft.wiki.gg/wiki/Hack)).
- **Anti-cheat:** the *Warden* client scanner, downloaded on the fly and run about every 15 s
  ([McGraw, USENIX ;login:](https://www.usenix.net/system/files/login/articles/529-mcgraw.pdf)).
- **Cheats from the choice:** WoW Classic's **fly/teleport bots farmed herbs and ores from 2019 on**, with
  characters "teleport[ing] across half the map". The EWT tool ("jump infinitely", walking through objects) was shut
  down by a cease-and-desist, not by netcode
  ([Blizzard forums](https://us.forums.blizzard.com/en/wow/t/fix-flyteleport-hacking-now),
  [mein-mmo](https://mein-mmo.de/en/wow-blizzard-has-defeated-one-of-the-largest-botting-tools,642044)).
- **Lesson:** trusting position, even with server checks, turned straight into resource-node farming. Wildshard's
  pickups and collectibles are exactly that kind of target.

### 1.5 EVE Online

- **Authority:** fully server-authoritative. One universe on a cluster, with **each solar system pinned to a server
  node**. Battles in one system share one thread on one core
  ([DatacenterKnowledge](https://www.datacenterknowledge.com/servers/experiencing-heavy-server-load-just-slow-down-time)).
- **Tick:** the physics sim ("Destiny") updates **once per second**, about 5–10 % of the load. Clients
  interpolate, and the game is designed around 1 Hz (orders, not twitch)
  ([CCP: TiDi](https://www.eveonline.com/news/view/introducing-time-dilation-tidi)).
- **Graceful overload: Time Dilation.** Rather than lag or crash, the node slows game time, down to a configured
  **10 % floor** (Asakai, 2,750+ players on one node)
  ([EVE Uni](https://wiki.eveuniversity.org/Time_Dilation), DCK above).
- **UGC:** none at runtime.
- **Lesson:**
  - The tick rate is a design choice. Slower games can run far cheaper authority.
  - A room that overloads should degrade deliberately (TiDi), not randomly.

### 1.6 Roblox: the closest UGC analogue

- **History:**
  - Until 2014 any client's changes replicated to everyone. Exploiters deleted whole maps.
  - `FilteringEnabled` (2014) stopped client changes from replicating, and was **forced on every game in 2018**,
    which killed "destructive" exploits
    ([devforum](https://devforum.roblox.com/t/non-filtering-enabled-emulator/1133708)) *(via search summary)*.
  - **Physics stayed client-owned through "network ownership"**: unanchored parts near a player, and the player's
    own character, are simulated by that client with "complete authority". That enables teleporting, flying and
    speed changes ([Roblox docs](https://create.roblox.com/docs/scripting/security/network-ownership.md)).
  - Creators had to write their own validation for every `RemoteEvent` ("never trust the client")
    ([client–server boundary docs](https://create.roblox.com/docs/scripting/security/client-server-boundary)).
- **2025–26 Server Authority:** the server runs movement, vehicles and physics authoritatively and "automatically
  reject[s] invalid client movements", with **client prediction and rollback**. Studio Beta, then Client Beta, then
  **full release on 9 July 2026**. Roblox warns it brings "increased server utilization"
  ([announcement](https://devforum.roblox.com/t/full-release-ship-fair-and-competitive-games-with-server-authority/4727993),
  [GamesBeat](https://gamesbeat.com/roblox-is-creating-responsive-cheat-resistant-games-with-server-authority/)).
  Known limits: remote events are not on the shared timeline (about 40–50 ms misprediction), and the mobile client
  trails desktop.
- **Client anti-tamper:** Hyperion (Byfron), shipped May 2023
  ([Roblox wiki](https://breezewiki.discard.no/roblox/wiki/Hyperion)) *(fan wiki)*.
- **Sandboxing (Luau):**
  - **Removed:** `io`, `package`, most of `os` and `debug`, `loadfile`, `dofile` and bytecode loading.
  - **Locked down:** globals and built-in libraries are read-only, and each script gets its own global table.
  - **CPU:** an **interrupt hook** lets the host kill runaway code, and Roblox uses watchdog timers.
  - **Memory: no limits by default.** The host must cap the allocator.

  ([luau.org/sandbox](https://luau.org/sandbox)).
- **Script Capabilities** (newer) put scripts in a *sandboxed container* with capability sets: where the script may
  run, and whether it may touch instances outside its container
  ([docs](https://create.roblox.com/docs/scripting/capabilities)).
- **Scale:** up to 700 players per server (a technical maximum)
  ([devforum](https://devforum.roblox.com/t/2232016)) *(via search summary)*. Server memory is about 6.4 GB +
  100 MB × peak players ([memory docs](https://create.roblox.com/docs/projects/performance-optimization/memory),
  [devforum](https://devforum.roblox.com/t/server-memory-formula-inaccurate-on-creator-docs/3913740)).
- **Economy farming:** engagement payouts were farmed by AFK Premium alts
  ([Roblox wiki](https://roblox.fandom.com/wiki/Engagement-Based_Payouts)) *(fan wiki)*.
- **Lesson:**
  - The biggest UGC platform spent about 12 years going from client-trusting to server-authoritative-with-prediction.
  - Each half-step (FE, then ownership, then Server Authority) left a class of exploits that creators had to patch
    by hand.
  - Wildshard can start where Roblox ended.

### 1.7 Fortnite UEFN and Verse

- **Authority:** server-authoritative Unreal dedicated servers. **Verse runs on the server.** A Verse computation
  that runs too long within a server tick fails with `ComputationLimitExceeded` or an infinite-loop error
  ([UE forums](https://forums.unrealengine.com/t/infinite-loop/2648044),
  [uefncentral](https://uefncentral.com/vi/verse-errors/error-3579-loop-infinite-iteration)) *(via search summary)*.
- **Language-level safety:** Verse code always runs inside a **transaction**. A failing context rolls back all its
  mutations, and Epic recompiled server C++ for Verse-compatible transactional semantics from Fortnite 28.10
  ([Epic tech blog](https://www.unrealengine.com/tech-blog/bringing-verse-transactional-memory-semantics-to-c)).
- **Budgets:** a memory calculator caps islands at 100,000 "memory units", computed at edit time and per streaming
  cell ([Epic docs](https://dev.epicgames.com/documentation/en-us/fortnite/memory-management-in-unreal-editor-for-fortnite)).
- **Persistence:** island persistence is sandboxed. Up to two `weak_map(player, …)` variables per island, **128 KB
  per player record**, readable only while the player is in that island's session
  ([Epic docs](https://dev.epicgames.com/documentation/fortnite/using-persistable-data-in-verse)) *(via search
  summary)*.
- **Anti-farming:** creators cannot grant global Fortnite XP directly. Epic **calibrates** XP: islands move from
  playtime XP to accolade XP as data accumulates, under a fixed XP budget, with a daily cap
  ([Epic help](https://www.epicgames.com/help/c-34406160/c-34044796/how-does-xp-calibration-work-in-fortnite-creative-a16010951))
  *(via search summary)*. Epic also penalised islands that promise "XP" or "AFK" in titles and thumbnails
  ([PCGamesN](https://www.pcgamesn.com/fortnite/island-changes)).
- **Lesson:** this is the best template for Wildshard's progress ledger and activity ranking.
  - Authors trigger *events*.
  - The platform owns the exchange rate from event to reward.
  - The rate is calibrated from how often real players trigger the event.

### 1.8 Second Life

- **Authority:** fully server-side.
  - One **256 m × 256 m region per simulator process, one region per CPU core, up to 100 avatars**, running at 45
    frames per second ([SL wiki: Grid](https://wiki.secondlife.com/wiki/Grid),
    [SimStats](https://wiki.secondlife.com/wiki/SimStats)).
  - Havok physics runs sim-side, and viewers only dead-reckon. "The sim is authoritative about avatar position"
    ([sldev](https://list-archives.secondlife.com/sldev/2007-December/007469.html)).
- **UGC:** LSL scripts all run **server-side**:
  - 16 KB (LSL VM) or 64 KB (Mono) per script ([Mono](https://wiki.secondlife.com/wiki/Mono),
    [llSetMemoryLimit](https://create.secondlife.com/script/lsl-reference/functions/llsetmemorylimit/)).
  - Script time gets what is left of the frame, about 15–19 ms on an unloaded sim. Homesteads throttle at about
    5–6 ms ([Kokua](https://kokua.atlassian.net/wiki/spaces/KKA/pages/1287258113)).
  - Even so, enough scripts "bog down" the sim ([Becky Pippen FAQ](https://wiki.secondlife.com/wiki/User:Becky_Pippen/Memory_Limits_FAQ)).
- **2025–26:** Linden Lab is replacing Mono with **SLua (Luau)**, 128 KB memory. Alpha in March 2025, beta in
  December 2025 ([modemworld](https://modemworld.me/2025/03/14/lab-officially-announces-luau-alpha-testing/),
  [SL wiki](https://wiki.secondlife.com/wiki/Lua_Alpha)).
- **Lesson:** this is the nearest structural twin of Wildshard: fixed-size cells, one process per cell, strangers'
  content running server-side. It proves the model scales to a world of user cells. It also proves that per-script
  caps are not enough: you need a **per-cell** CPU budget, enforced.

### 1.9 VRChat (Udon)

- **Authority:** client authority per object, **owner-based**. Every networked object has an owner, by default the
  instance master. Only the owner can write its synced variables, and other players' writes stay local
  ([VRChat docs](https://creators.vrchat.com/worlds/udon/networking/ownership)).
- **UGC:** Udon is a VM sandbox with an **allow-list of exposed Unity APIs**. An exception just disables that
  behaviour ([class exposure tree](https://creators.vrchat.com/worlds/udon/udonsharp/class-exposure-tree),
  [uhiyama-lab](https://uhiyama-lab.com/en/notes/vrchat/udonsharp-introduction/)).
- **Cheats from the choice:**
  - "Malicious modded clients in an instance are able to invoke any networked event on any behaviour of the world."
    VRChat added a `[NetworkCallable]` opt-in, an underscore convention and a server-guaranteed `CallingPlayer`
    ([network events docs](https://creators.vrchat.com/worlds/udon/networking/events/)).
  - Modified clients were behind harassment, crashes and thousands of stolen accounts a month, which drove the 2022
    Easy Anti-Cheat rollout ([VRChat blog](https://hello.vrchat.com/blog/vrchat-security-update)).
- **Scale:** hard cap of 80 per instance (82 with author/creator exceptions)
  ([VRChat wiki](https://wiki.vrchat.com/wiki/Instances)).
- **Lesson:** owner authority makes **every world author a netcode security engineer**. Most aren't. Fine for social
  hangouts, unfit for loot and titles.

### 1.10 Valheim (Iron Gate)

- **Authority:** the dedicated server is mostly a **relay**. Simulation of an area goes to the first client that
  enters it, the "zone owner". If the owner has a bad connection, everyone nearby suffers
  ([dathost](https://dathost.com/blog/valheim-common-performance-issues-and-solutions),
  [xgamingserver](https://xgamingserver.com/docs/valheim/troubleshooting-network)).
- **Fixes come from mods:** community mods move world and monster simulation to the server
  ([thunderstore](https://thunderstore.io/c/valheim/p/VerdantsAscent/FiresGhettoNetworking/changelog)).
- **Scale:** **10 players per world**, a hard cap even in 1.0
  ([berrybyte](https://berrybyte.net/wiki/games/valheim/how-many-players)).
- **Lesson:** owner authority is cheap to host and terrible for fairness and latency across players. A phone on LTE
  as zone owner would be the worst case.

### 1.11 Albion Online (Sandbox Interactive): the closest *architecture* analogue

- **Authority:** fully server-authoritative. The server is **plain C# on Photon with no Unity**, so levels,
  collision and pathfinding are engine-independent. "Server needs to work without Unity. Ideally, client works
  without Unity, too (tools, stress-test bots)."
- **The world model:** the world is split into **~1 km² "clusters"**, about 600 of them, spread over game servers.
  Players hand off between servers when they travel, through the database.
- **Threading:** each cluster's game logic is **single-threaded and event-driven, with no global tick**. Mobs sleep
  when idle and request recurring timers only when needed. IO and pathfinding go to worker threads.
- **Interest management:** a grid hash of 10 m × 10 m cells, with a subscribe radius and a larger unsubscribe radius.
  This was done "to reduce traffic… and prevent cheating".
- **Load per cluster:** about 500 mobs, more than 10,000 interactive objects and **up to 300 players**.
- **Hosting:** "8× 10-core Xeon, 32 GB… ~15k CCUs", roughly 190 CCU per core. The client simulates for prediction
  only.

All of the above is from the [Quo Vadis 2016 talk PDF](https://davidsalz.de/wp-content/uploads/2016/06/Albion-Online-Quo-Vadis-2016-talk.pdf)
and the [Unity blog](https://unity.com/blog/albion-online-cross-platform-pvp-mmo-architecture).

- **Lesson:** "a room per 500 m shard, keyed by id" is Albion's cluster model. It is proven at MMO scale on modest
  hardware, cross-platform including phones. The two big wins are the **engine-independent shared sim** and
  **sleeping objects**.

### 1.12 Old School RuneScape

- **Authority:** total. The client "cannot directly move your character, but can tell the server to move your
  character". The world advances on a **0.6 s game tick** ([OSRS wiki](https://oldschool.runescape.wiki/w/Game_tick),
  [Jagex dev blog](https://secure.runescape.com/m=news/dev-blog---movement-in-runescape)).
- **Cheats:** there is effectively no movement or combat hacking. **Bots are the plague.** Jagex banned 6.9 million
  accounts in 2023 and averaged more than 67,000 a week in 2024, with about 900B GP removed weekly
  ([Jagex update](https://oldschool.runescape.wiki/w/Update:Bots,_Bans_and_Appeals:_An_Update)).
- **Scale:** about 2,000 players per world **[unverified]**.
- **Lesson for the activity ranking:** perfect authority still leaves you with *legitimate-looking automated play*.
  Wildshard's "meaningful activity" metric is an OSRS-grade bot target the moment grid position has value to
  authors.

### 1.13 Guild Wars 2

- **Authority:** server-side combat and economy, but position is client-reported.
- **Cheats:** teleport and speed hacks (1 % to 1,000 %) have persisted, notably in WvW and in bots that farm resource
  nodes and chests ([GW2 wiki: Exploit](https://wiki.guildwars2.com/wiki/Exploit),
  [forum](https://en-forum.guildwars2.com/topic/113098-have-teleport-and-speed-hacks-been-given-the-green-light/),
  [ownedcore teleport source](https://www.ownedcore.com/forums/mmo/guild-wars-2/gw2-memory-editing/388142-source-code-click-2-teleport-fly-no-clip.html)).
- **Scale:** the **Megaserver** (2014) is a weighted load balancer. It spins up new map copies when full and ranks
  copies by party, guild and language ([GW2 wiki](https://wiki.guildwars2.com/wiki/Megaserver),
  [ArenaNet](https://www.guildwars2.com/en/news/introducing-the-megaserver-system/)).
- **Lesson:**
  - Same as WoW: trusting position means node-farming bots.
  - The megaserver is the answer to "room capacity" for a popular shard: copies of a shard room, with a placement
    score.

### 1.14 Destiny 1/2 (Bungie): the clearest real "progress-only" hybrid

- **Authority:**
  - **Physics, bullets, animation and positions run peer-to-peer on players' machines.**
  - A cloud **activity host** holds only mission facts: spawn state, enemy counts, objective triggers, script state.
    It runs at **10 Hz** in about 45 MB, roughly **5,000 instances per 40-core server**.
- **The exploit:** the Crota raid had boss logic "built entirely using client-side systems, bypassing the activity
  host". Players pulled network cables at the right moment to force favourable outcomes.

Sources: [Edgegap deep dive](https://edgegap.com/blog/destiny-2-s-network-achitecture---multiplayer-game-deep-dive),
[GDC 2015: Shared World Shooter](https://gdcvault.com/play/1022247/Shared-World-Shooter-Destiny). The figures come
from Edgegap's summary of the talk **[unverified against the talk itself]**.

- **Lesson:** progress-only authority is about **100× cheaper** per instance than full simulation. But every place
  where client state decides a server fact becomes an exploit, and in UGC you can't hand-audit those seams per
  shard.

### 1.15 New World (Amazon)

- Amazon said New World is "entirely server based" from a simulation standpoint. It still shipped:
  - an **invulnerability exploit**: dragging the window froze the client's updates, and the character became
    unhittable
  - a **gold-duplication** exploit using lag switches during trades, which forced Amazon to disable *all* wealth
    transfers

  ([TechRaptor](https://techraptor.net/gaming/news/game-breaking-new-world-invincibility-exploit-discovered),
  [PC Gamer](https://pcgamer.com/new-world-invincibility-exploit)) *(via search summary)*.
- **Chat rendered HTML**, so players injected images and crash payloads into other clients
  ([Inven Global](https://www.invenglobal.com/articles/15523/new-world-players-discover-potentially-game-breaking-code-injection-exploits)).
- **Lessons:**
  - "Server authoritative" is a property of *every code path*, not a label.
  - Economic transactions must be atomic under disconnects.
  - Untrusted text must never reach a rich renderer. That matters for author-supplied NPC dialogue and quest text.

### 1.16 Others in brief

- **Diablo 2 → 3 (Blizzard):**
  - D3 went always-online because, in Jay Wilson's words, otherwise "we would have to put our server architecture
    onto the client", which is why D2 suffered "extensive cheating and item dupes".
  - D3 still had a **gold dupe** that took the auction house offline
    ([Shacknews](https://shacknews.com/article/69839/diablo-3-online-requirement-to-prevent-hacks-piracy),
    [HITB](https://news.hitb.org/content/diablo-iii-harsh-drm-fails-prevent-hackers-cheaters)).
  - Lesson: authority stops forged items. Only transactional correctness stops dupes.
- **The Division (Massive, 2016):** "authoritative" for loot and most combat, but **fire rate was computed on the
  client** for smoothness. Fire-rate cheats and Dark Zone hacks followed
  ([GamesBeat](https://gamesbeat.com/?p=115754), [Digital Trends](https://digitaltrends.com/?p=962921))
  *(via search summary)*. One trusted number is enough.
- **Path of Exile:** the player chooses **lockstep** (wait one RTT, never desync) or **predictive** (instant, can
  desync) ([poewiki](https://poewiki.net/wiki/Desync)). Lesson: prediction quality is the whole latency story for
  server-authoritative action games.
- **Warframe:** P2P with a player host, host election and migration. A failed migration loses progress
  ([wiki](https://wiki.warframe.com/w/Host_Migration)). Lesson: host authority puts progress at the mercy of the
  weakest uplink.
- **Rec Room:** Circuits execute **locally on every device**. A server-chosen "authority" player is the source of
  truth for room state, and creators use a "Has Authority" chip to gate logic
  ([Rec Room blog](https://blog.recroom.com/posts/2020/8/3/how-2-circuits-2), [CV2](https://recroom.com/cv2)).
  This is owner authority as a creator burden, like VRChat.
- **Photon PUN (common Unity backend):** "PUN is a client-authoritative SDK"… if you're the master client "you
  control everyone's health, position" ([Photon forum](https://forum.photonengine.com/discussion/comment/37164/)).
- **Garry's Mod:** Lua in server and client realms. "Any client has the potential to send any net message at any
  time." Insecure `net.Receive` handlers in third-party addons are the classic backdoor
  ([gmod wiki](https://wiki.facepunch.com/gmod/net.Receive~edit)). Server-side UGC that *trusts its inputs* fails
  as badly as client-side UGC.
- **Core (Manticore):** creators choose per-object contexts: Default (static, never networked), Networked, Client,
  Server, Local. There is a **4,000 networked-object cap**
  ([Core docs](https://docs.coregames.com/references/networking/)). Lesson: make "static, never networked" the
  default and charge for networked state.
- **Screeps:** players' JS runs server-side in per-player **isolated-vm** isolates:
  - CPU metered per tick, with a 10,000-CPU bucket and a hard 500 CPU per tick
  - **256 MB heap** per player

  ([docs](https://docs.screeps.com/cpu-limit.html), [changelog](https://blog.screeps.com/2018/03/changelog-2018-03-05/)).
  Proof that metering untrusted code per tick works as a game mechanic.
- **Hytale:** "server-side first". Only the host has mods and **no client mods are supported**. Even singleplayer
  runs as a local server. Java plugins are acknowledged as unsafe, and a **visual-scripting sandbox** is planned for
  shared logic ([Hytale blog](https://hytale.com/news/2025/11/hytale-modding-strategy-and-status)). Lesson: one
  code path, with singleplayer as a local server.
- **Star Citizen:** **server meshing** with a central *replication layer*. Exactly one server node holds authority
  over an entity, and authority transfers at streaming boundaries
  ([CIG Q&A](https://api.star-citizen.wiki/comm-links/18397)). Static meshing shipped in Alpha 4.0 (December 2024)
  at 500 players per shard ([Digital Trends](https://www.digitaltrends.com/gaming/star-citizen-500-player-server-update/)).
  This is authority-handoff machinery Wildshard does not need inside a 500 m shard, but may need for the highway
  seam.
- **SpatialOS (Improbable):** a distributed entity/worker authority platform. Worlds Adrift shut in 2019, citing
  partly "challenges with working in SpatialOS", and Improbable exited games in 2022–23
  ([Game Informer](https://gameinformer.com/2019/05/29/bossa-studios-to-close-worlds-adrift),
  [CNBC](https://www.cnbc.com/2023/12/18/metaverse-firm-improbable-sells-gaming-unit-for-97-million.html)).
  Lesson: don't bet the game on exotic distributed authority.
- **Dual Universe:** a single-shard world with player Lua in control units that only runs with a nearby player
  ([DU wiki](https://dualuniverse.fandom.com/wiki/Lua_Scripting)) *(fan wiki)*. Servers shut on 27 August 2025
  ([Wikipedia](https://en.wikipedia.org/wiki/Dual_Universe)). A cautionary tale of ambition over cost.
- **Overwatch (reference netcode):** a deterministic ECS sim on fixed 16 ms command frames. It predicts abilities by
  default and reconciles against the authoritative server
  ([GDC 2017](https://gdcvault.com/play/1024001/-Overwatch-Gameplay-Architecture-and)).
- **Valve Source (reference lag compensation):** the server rewinds hitboxes by the shooter's latency. Clients view
  others about 100 ms in the past (`cl_interp 0.1`), and up to 1 s of history is kept
  ([Valve wiki](https://developer.valvesoftware.com/wiki/Lag_Compensation)).

### 1.17 Summary table

| Game | Movement authority | Combat / AI authority | Progress authority | UGC runtime | Signature exploit from the choice | Scale per room |
|---|---|---|---|---|---|---|
| Rust | Client + validators | Server + validators | Server | Oxide (trusted) | Fly/aim within forgiveness | 100–300 [unverified] |
| Minecraft Java | Client + checks | Server | Server | Plugins (trusted) | Killaura/reach/fly; anti-cheat re-sims | ~100 on one thread |
| Minecraft Bedrock | Configurable, incl. server + rewind | Server | Server | JS + watchdog | — | small |
| BDO | Client (reported) | Mixed (reported) | Server | none | Speed/cooldown farming | channels |
| WoW | Client + checks | Server | Server | UI addons only | Fly/teleport node bots | layered realms |
| EVE | Server (1 Hz) | Server | Server | none | — | 2,750+ / node with TiDi |
| Roblox (2026) | Server + prediction (opt-in) | Creator-written | Creator-written | Luau sandbox | Ownership teleports; Remote abuse | ≤ 700 |
| UEFN | Server | Server | Platform-calibrated | Verse on server | XP-farm maps (policy fix) | per island |
| Second Life | Server | Server | n/a | LSL/SLua on server | Script lag | 100 / region |
| VRChat | Owner client | Owner client | n/a | Udon (allow-list) | Any client fires any event | 80 |
| Valheim | Zone-owner client | Zone-owner client | Client saves | mods | Lag from owner | 10 |
| Albion | Server | Server | Server | none | — | 300 / 1 km² |
| OSRS | Server (0.6 s) | Server | Server | none | Bots, not hacks | ~2,000 [unverified] |
| GW2 | Client + checks | Server | Server | none | Teleport/speed node bots | map copies |
| Destiny | P2P | P2P + activity host | Server | none | Cable-pull boss skips | 5,000 hosts / 40 cores |

---

## 2. UGC lessons: how platforms contain strangers' code

| Mechanism | Who does it | What it buys | Wildshard mapping |
|---|---|---|---|
| **Small language, safe by construction** | Luau (no io/os/loadfile, read-only globals), Udon (allow-listed Unity API), Verse | No escape to host | WASM plugins with a **data-only host ABI** (R7); the logic graph as pure data (R2) |
| **CPU metering per tick** | Screeps (CPU per tick + bucket, hard 500), Verse (`ComputationLimitExceeded`), Bedrock watchdog (2 ms slow / 100 ms spike / 3 s hang), Luau interrupts | Runaway code can't stall a room | wasmtime **fuel** for deterministic, platform-independent metering plus **epoch interruption** as a wall-clock backstop ([wasmtime docs](https://docs.wasmtime.dev/examples-deterministic-wasm-execution.html)); logic-graph fuel and cascade caps (already in R2) |
| **Memory caps** | SL 16/64/128 KB per script, Screeps 256 MB per player, Bedrock 250 MB per world, Roblox 6.4 GB + 100 MB/player per server; Luau has **no limit unless the host sets one** | One bad shard can't OOM the host | `ResourceLimiter` on WASM linear memory; per-room heap cap; S3 budget |
| **A per-cell budget, not just per script** | SL throttles script time per region; UEFN memory units per island and per cell | Many small scripts can't add up to a lag bomb | **Server ms per tick per shard** as a validated, measured budget (§5.5) |
| **Determinism** | wasmtime NaN canonicalisation and fuel; Rapier `enhanced-determinism`, with the JS/WASM build "fully cross-platform deterministic" and snapshot hashes identical across machines ([Rapier](https://rapier.rs/docs/user_guides/javascript/determinism)) | The same code predicts on the phone and decides on the server; replay audits | Required for approach 1's prediction and the replay audit (§3, approach 6) |
| **Transactional effects** | Verse (failure rolls back all mutations); the one-shot's pure `dispatch()` returning effects | No half-applied state; dupes are impossible by construction | Logic-graph and plugin outputs are **effect lists**; only the room and ledger commit them |
| **Narrow, server-guaranteed caller identity** | VRChat `NetworkCalling.CallingPlayer`, `[NetworkCallable]` opt-in | Stops forged RPCs | Clients send only **input commands** from a closed engine schema; authors define no RPCs |
| **Capability containers** | Roblox Script Capabilities (`Sandboxed`, `AccessOutsideWrite`) | Third-party models can't reach global APIs | A plugin sees only its own shard's entities and variables; never profiles, the ledger or other shards |
| **Platform owns the reward exchange rate** | UEFN XP calibration and island-scoped 128 KB persistence | Authors can't mint global currency | The ledger converts shard events into global progress under calibrated budgets |
| **No client mods; content from the server** | Hytale, VRChat EAC | Predictable client | In a browser this is *impossible to enforce*. Treat the client as hostile, always |
| **Defaults that cost nothing** | Core's static Default Context; Albion's sleeping mobs | Networked state is the exception | Only devices that change state replicate; static geometry never does |
| **Never render untrusted text as markup** | New World's chat HTML injection | No client-side injection | Author strings (dialogue, quest text, titles) are plain text with a tiny allow-listed style set |

Two meta-lessons:

1. **Platforms that make creators write netcode get insecure creations**: Roblox RemoteEvents, VRChat network events,
   Garry's Mod `net.Receive`, Rec Room authority chips. Platforms where the engine replicates and the creator's
   logic runs only on the server (UEFN, Second Life, Albion's own content) don't have that class of bug. Wildshard's
   R2–R7 already put it in the second group, *if* the engine owns replication.
2. **Per-unit caps are necessary but not sufficient.** Second Life caps every script and still lags. The budget has
   to be per cell, measured, and enforced by degradation (EVE's TiDi) or eviction.

---

## 3. Each approach audited for Wildshard

The assumptions: rooms keyed by shard id; up to about 50 players per shard room in v1 **[unverified target]**; PvE
creatures and bosses; PvP optional per shard (M7); the reference client is an iPhone PWA at 30 fps and about 1 GB;
mobile RTT is roughly **30–50 ms idle on LTE**, and Ookla measured **US multi-server latency at 50.5 ms** with
**3.7×–11.4× degradation under load** across markets
([speedtesthq](https://speedtesthq.com/guides/mobile/4g-vs-5g),
[Telecompetitor/Ookla](https://www.telecompetitor.com/is-5g-ready-for-ai-ookla-report/),
[ISPreview](https://www.ispreview.co.uk/index.php/2026/07/ookla-benchmarks-22-countries-for-5g-mobile-broadband-for-ai-workloads.html))
*(ratio via search summary)*. So design for 150–400 ms spikes. Transport: WebSocket (TCP, so head-of-line blocking
amplifies loss) or **WebTransport datagrams, shipped in Safari 26.4 (March 2026) and now Baseline**
([webrtc.ventures](https://webrtc.ventures/2026/04/webtransport-is-now-baseline-what-it-means-for-real-time-media/),
[caniuse](https://caniuse.com/webtransport)).

### The approaches

1. **Full server authority over the shared sim, with client prediction.** The server runs physics, creatures, combat,
   devices and logic. Clients send inputs, predict their own character, and interpolate the rest.
2. **Progress-only authority.** Clients simulate PvE. The server validates claims (loot, XP, titles, activity) with
   plausibility checks.
3. **Client authority plus server validation heuristics.** Clients own their own position and hits. The server checks
   bounds (Rust, WoW, GW2, Minecraft Java style).
4. **Host or owner authority per room or object.** One client (the first in, the room "master", or the object's
   owner) simulates and the server relays (VRChat, Valheim, Rec Room, Photon, Warframe).
5. **Hybrid per system.** Each system is assigned a tier: server-authoritative, predicted, owner, or cosmetic.
6. **(Added) Deferred authority by replay audit.** Clients simulate and record input logs. Thanks to determinism the
   server *re-simulates asynchronously* only when a high-value claim arrives (a title, a world-first, a boss loot
   roll), or on a random sample. This is a cheaper way to make approach 2 honest.
7. **(Added) Deterministic lockstep.** Everyone waits for everyone's inputs (RTS style, PoE's lockstep mode). Shown
   for completeness.
8. **(Added) Server meshing or spatial partitioning** (Star Citizen, SpatialOS). Approach 1 spread across servers.
   It solves scale, not authority.
9. **(Added) Delegated authority to a trusted self-hosted server** (tier 3 portals). That host is authoritative for
   its own world. Its progress is *foreign* and must not feed global titles or the ranking unchecked.

### 3.1 Scorecard

Ratings: ●●● best … ○ worst. Costs are relative. Absolute numbers are in the prose.

| | Loot / items | Titles / achievements | Activity ranking | Server CPU / player | Phone latency feel | Eng. cost from SP engine | Author burden | Worst failure mode |
|---|---|---|---|---|---|---|---|---|
| **1 Full authority + prediction** | ●●● | ●●● | ●● (stops impossible, not bots) | ○ (highest) | ●● own move instant; hits lag-compensated; boss telegraphs need slack | ○ (highest: headless sim, netcode, prediction, lag comp) | ●●● none: the engine owns netcode | Room overload or crash hits everyone in the shard; rubber-banding on bad LTE |
| **2 Progress-only** | ● | ● | ● | ●●● (~100× cheaper) | ●●● solo; co-op diverges | ●● (low until co-op needs shared state) | ●● | Forged claims; co-op desync turns into approach 4 |
| **3 Client auth + heuristics** | ●● (if loot rolls stay server-side) | ●● | ● | ●● | ●●● | ●● | ●● | Endless arms race with **no browser anti-cheat**; teleport/speed bots harvest pickups (WoW, GW2) |
| **4 Host / owner** | ○ | ○ | ○ | ●●● | ●●● host / ● others | ●● | ○ (authors write ownership logic) | Host cheats; host's LTE or Safari backgrounding stalls the room; migration loses progress |
| **5 Hybrid per system (recommended shape)** | ●●● | ●●● | ●● | ● | ●● | ● | ●●● | Exploits at the seams between tiers (Destiny Crota, Division fire rate) unless the seam rule is mechanical |
| **6 Replay audit** | ●● | ●●● | ●● | ●● (audits only) | ●●● | ●● (needs determinism + logs) | ●● | Determinism breaks give false positives; delayed punishment; audit can be starved |
| **7 Lockstep** | ●●● | ●●● | ●● | ●● | ○ (one slow phone stalls all) | ● | ●● | One player's spike freezes the room; no drop-in |
| **8 Meshing** | as 1 | as 1 | as 1 | ○ + overhead | as 1 | ○○ | ●●● | Complexity; SpatialOS precedent |
| **9 Self-hosted delegate** | foreign | foreign | foreign | 0 for us | depends | ● | n/a | Treat as untrusted for global progress |

### 3.2 Prose audit

**Approach 1: full server authority with prediction.**

- **Cheat resistance:**
  - Loot, item rolls, boss kills, quest completion, puzzle state and pickups all happen in the server's world, so
    forging them is impossible.
  - Speed, teleport and fly are gone, because the server integrates movement from inputs with the same
    `CharacterMotor`. This is exactly what Roblox's Server Authority automates and what Grim reconstructs for
    Minecraft.
  - ESP is limited by **interest management**: Albion explicitly culls what each player receives "to prevent
    cheating".
  - **Aimbots survive.** An input is still an input. For PvE that matters little. For opt-in PvP shards it is the
    usual residual risk.
  - The **activity ranking is only partly protected**. Bots and alts with real clients generate real activity
    (OSRS). See §4 and §5.4.
- **Server cost:** the heaviest option. Per room the server runs Rapier at the fixed step, every player's character
  controller, creature brains and navmesh queries, the logic graph and the plugins.
  - My estimate **[unverified]**: a 500 m shard with heightfield and trimesh colliders, about 30 awake creatures and
    20 players at 60 Hz costs 1–4 ms per step in Node + Rapier WASM, or **6–25 % of one core**. That is roughly
    **20–80 concurrent players per core**, before sleeping.
  - Albion reaches about 190 CCU per core *without rigid-body physics and with sleeping objects*. Roblox explicitly
    warns of higher server use when Server Authority is on.
  - Mitigations: empty rooms sleep. Creatures sleep outside player radii (Albion). The server can step characters at
    30 Hz and creatures at 10–20 Hz with the client still at 60 Hz (Destiny's activity host runs at 10 Hz). Shards
    whose server cost exceeds budget are refused at upload (§5.5).
- **Latency feel:**
  - The player's own movement and attack animations are instant (prediction).
  - Hits on creatures feel instant with server lag compensation. Valve rewinds up to 1 s; cap Wildshard at about
    250 ms for phones **[unverified choice]**.
  - Creatures appear about RTT/2 plus about 100 ms of interpolation late. **Boss telegraphs and dodge windows need
    slack.** Design rule: wind-ups of at least about 400 ms, and server-side "favour the defender" grace on dodges
    **[unverified heuristic]**.
  - Corrections show up under LTE spikes. Bedrock's rewind-replay and Roblox's resimulation exist precisely to
    smooth them.
  - Bonus: the phone stops running creature AI, which **frees client CPU** on a device that throttles about 2×.
- **Engineering cost:** the highest, but the requirements already demand most of it:
  - M2 (headless sim)
  - M3 (serialisable state, stable ids, input commands, snapshot→restore→replay)
  - R2 (the logic interpreter runs headless on the server and on the client for prediction)
  - R7 (WASM plugins on both sides)
  - The engine already has a seeded RNG and clock, scope-owned resources, a fixed 60 Hz step and versioned saves.

  New work: the net protocol, entity replication with delta snapshots, prediction and reconciliation for the local
  character, lag compensation, interest management, and the room process. **Hytale's trick fits the T1 parity rule
  well: singleplayer becomes a local server** (in a Worker), so there is one code path.
- **Author burden:** none for netcode. Devices, brains, boss tables and quest graphs are engine-owned and replicate
  automatically. This is the UEFN position. Authors only feel it as server-side budgets.
- **Failure modes:**
  - A room crash or overload hits everyone in that shard. Mitigate with snapshot-and-restart and TiDi-style
    deliberate slowdown.
  - Misprediction rubber-banding on bad links.
  - Cost blow-ups from heavy shards.
  - Determinism drift between Safari and Node: Rapier has a known BVH-workspace snapshot issue in rollback use
    ([rapier#910](https://github.com/dimforge/rapier/issues/910)). That calls for a parity hash test (§5.2).

**Approach 2: progress-only.**

- **Cheat resistance:** weak in a browser. The server sees "I killed boss B, give me loot". It can check elapsed
  time, a damage-per-second ceiling, presence in the shard and quest prerequisites, but it **cannot know whether
  the fight happened**. Every check is a heuristic with a margin, and the client is fully patchable JS.
  - Titles and achievements become forgeable claims.
  - The ranking becomes trivially farmable: a script replays "completed quest" packets.
  - Destiny shows both the economics (about 5,000 activity hosts per 40 cores) and the failure (client-side boss
    logic skipped by pulling cables).
- **Cost:** tiny.
- **Latency:** perfect solo.
- **But Wildshard is about playing shards *together*.** Two players fighting the same boss need one creature state.
  Someone has to own it, and you've reinvented approach 4 with all its problems.
- **Engineering:** cheap at first, expensive later. Every shard's quests need plausibility rules, which are
  author-specific: who writes "how fast can this puzzle be solved"?
- **Verdict:** acceptable only for **solo-instanced, low-value** content, and only if paired with approach 6 audits.

**Approach 3: client authority plus validation heuristics.**

- This is how WoW, GW2, Rust and Minecraft Java treat *movement*. It works there because of Warden, EAC, Hyperion
  and native-binary obfuscation **plus** large anti-cheat teams. **A browser game gets none of that.** Anyone can
  open DevTools or proxy the WebSocket.
- Every exploit in §1 tied to client-reported position (WoW and GW2 node bots, BDO speed farming, Minecraft fly and
  reach) maps straight onto Wildshard's collectibles and pickups.
- Cheaper than approach 1 (no server character re-simulation), and the feel is excellent.
- **Verdict:** the *pragmatic fallback for movement only*, and only if approach 1's per-player character
  re-simulation proves too expensive. In that case use a **Grim-style server re-sim check** (the motor runs
  server-side in validation mode), never plain distance bounds.

**Approach 4: host or owner authority.**

- **No cheat resistance for anything a host can touch.** The Photon master "controls everyone's health, position".
- **The phone is the worst possible host:**
  - Safari suspends background tabs and PWAs.
  - Low Power Mode caps it at 30 fps, and it throttles about 2× within minutes (JAKE.md).
  - LTE uplinks spike.
- Valheim shows the cross-player lag ("player-B will also notice", from the owner's ping), and Warframe the lost
  rewards on migration.
- The authoring burden is the worst of all. Creators must reason about ownership (VRChat, Rec Room).
- **Verdict:** reject for public shards. Possibly acceptable for *private, social, non-progress* shards later
  (M7 "law" could allow it), but even then approach 1 is the same code, so why keep two paths?

**Approach 5: hybrid per system.** This is what every successful case study actually does. Minecraft is server for
world, inventory and mobs plus checked client for movement. Roblox ran server scripts plus owned physics, now plus
Server Authority. Rust and WoW split similarly. The hybrid's risk is **seams**: the Division's client fire rate,
Destiny's client boss logic, New World's frozen-client invulnerability. For UGC the mitigation must be **mechanical,
not per-shard review**:

- A system's tier is fixed by the engine, not chosen by authors.
- Only server-tier systems may emit ledger facts.
- Cosmetic-tier systems have no write path to shared state at all. Make it a type-level and lint-level guarantee, as
  the repo's layer guards already do for imports.

The recommended assignment:

| System | Tier | Notes |
|---|---|---|
| Own character movement, jump, mount, glide, grapple | **Predicted, server re-simulates from inputs** | Same `CharacterMotor` on both sides; reconcile on correction |
| Other players | Server → interpolated (~100 ms) | Interest-managed |
| Creatures, bosses (brains, phase tables), projectiles that hit | **Server** | Clients interpolate; boss telegraph timings designed for RTT |
| Melee and ranged hit resolution | **Server, lag-compensated** | Client sends aim + tick; server rewinds ≤ ~250 ms [unverified cap] |
| Devices that change shared state (doors, plates, movers, spawners, pickups, chests) | **Server** | Client may predict *its own* door press visually |
| Logic graph, quest graph, puzzles, WASM plugins | **Server** (client copy for prediction or UI only) | Effects-only outputs |
| Loot rolls, XP, coins, gear, titles, achievements, activity events | **Ledger only** | Idempotent transactions |
| Particles, flocks, foliage wind, ragdolls, decorative physics props | **Cosmetic, client-local** | No write path to state |
| Chat | Server-relayed, plain text, rate-limited | New World lesson |

**Approach 6: replay audit.** It needs the same determinism as approach 1's prediction, so it is almost free once
approach 1 exists. Use it as a **second line**: audit sampled sessions and every world-first or rare-title claim by
re-simulating the room's input log offline. Catch dupes or desync bugs that slipped past the online path. As a
*primary* model (instead of approach 1) it fails on shared co-op state, the same way approach 2 does.

**Approach 7: lockstep.** It needs every client to simulate everything and to wait for the slowest phone. Its
drop-in story is poor. Reject.

**Approach 8: meshing.** Not needed inside a 500 m cell. Albion and Second Life show that a single-threaded process
per cell is enough. Revisit only for a hot centre shard; the GW2-style answer there is **shard copies**, not
meshing.

**Approach 9: delegated self-hosted servers.** Fine as a portal. Its claims are foreign, so it gets no global titles
or ranking unless a future attestation scheme exists.

---

## 4. The activity ranking: authority is necessary, not sufficient

O5 asks for a ranking of "meaningful activity… resistant to farming". The adversary is **the author**, who gains
grid centrality, with alts, friends and bots. It is not a cheating player. Precedents:

- **Fortnite** had XP-farm islands, so Epic calibrates XP per island from trigger frequency under a fixed budget,
  caps it daily, and penalises "XP"/"AFK" marketing.
- **Roblox** had AFK Premium alts farming engagement payouts.
- **OSRS** bots are fully legitimate at the protocol level.

What approach 1 *does* buy here: every counted event is a **server-witnessed fact**. A quest completion really
happened in the server's world, a pickup was really reached by a really-moving character, and time-on-shard was
really spent with inputs flowing. That eliminates the cheap attack (forged packets) and leaves the expensive one
(scripted real play).

The rest has to be economics. Design proposals, all **[unverified]** as Wildshard specifics:

- **Count distinct trusted players, not events.** Weight by account age, login vs anonymous, and diversity of shards
  played. Exclude the author and the author's frequent co-players (graph distance). The one-shot already excluded
  the author.
- **Diminishing returns per player per shard per day**, and a **per-shard reward and activity budget** that the
  ledger calibrates from observed completion rates (UEFN-style).
- **Behavioural bot signals** are cheap on the server, because it has every input: input entropy, path repetition,
  24/7 sessions, identical routes across accounts.
- Make **ranking movement slow**: weekly windows, with locking and grace already required by O2. Farming then needs
  sustained investment and is easier to detect.

---

## 5. Recommendation and the five things to decide or build first

**Recommendation:** approach 5 with an approach-1 core (§0). Add approach 6 as an audit layer once determinism is in
place. Keep approach 3 in reserve, for movement only, if approach 1's per-player character cost proves too high in
load tests. Never approach 2 or 4 for anything that feeds the ledger.

### The five things to decide or build first

1. **Decide the authority map and make it an SDK contract.** Use the table in §3.2 approach 5 as the start.
   - Every engine system and device declares its tier (`server` / `predicted` / `cosmetic`).
   - Authors cannot change a tier.
   - Only `server` tier can emit ledger facts.
   - Cosmetic tier has no write path to shared state, enforced by types and a lint rule in the existing
     `lint/wildshard-plugin.js` family.

   This must come *before* more devices are converted in SHARD-PLATFORM (80/20), because every converted device
   either fits a tier or gets rewritten later. That is the Roblox lesson, at a cost of 12 years.
2. **Build the deterministic headless sim and the inputs-not-positions protocol, with a parity hash test.**
   - The engine's sim (Rapier WASM with `enhanced-determinism` semantics, the fixed 60 Hz step, the seeded RNG, the
     logic graph, brains, WASM plugins with NaN canonicalisation and fuel) boots in Node with no renderer.
   - A CI test feeds one recorded input log to a Safari/WebKit client build and to the Node server, and requires
     identical state hashes per N ticks. This catches issues like rapier#910.
   - On top of it: local-character prediction and reconciliation, entity interpolation, and server lag compensation
     for hits.
   - **Make singleplayer the local server** (Hytale's model) so T1 parity covers the multiplayer path from day one.
3. **Build the progress ledger as the only writer of global progress.**
   - It takes facts from rooms (`{player, shard, revision, fact, tick}`).
   - It applies **atomic, idempotent transactions** keyed by fact id. Disconnects and lag switches can't duplicate
     anything (the New World and Diablo 3 lessons).
   - It enforces per-shard reward budgets and calibration (UEFN), plus daily caps.
   - It produces an audit log that approach 6 can replay.
   - Island-scoped (shard-scoped) state stays with the shard (M6). Global profile changes only through the ledger.
4. **Decide the anti-farming design for "meaningful activity" before shards compete for the centre.**
   - It counts only server-witnessed facts.
   - It weights by distinct trusted players.
   - It excludes the author and the author's social graph.
   - It uses slow windows and behavioural bot signals.

   Decide now because it shapes identity (anonymous play counts for less), the ledger's schema, and what rooms must
   log. Retro-fitting trust weights after authors have optimised for a naive metric is the Fortnite-islands
   experience.
5. **Build the room runtime and its cost envelope.**
   - **Process model:** one single-threaded room per shard (Albion, Second Life, Folia regions). Sleep when empty,
     sleep creatures outside player radii. GW2-style room **copies** when a shard is full.
   - **Interest management:** grid cells, subscribe/unsubscribe radii (Albion's 10 m cells).
   - **Server-side budgets in S3:** "server ms per tick at N players", measured by `wildshard validate` running the
     shard headless with bots, plus WASM fuel and memory per room. Refuse shards over budget at upload. Degrade
     deliberately under load, TiDi-style, instead of crashing.
   - **Transport and phones:** WebSocket first for reliability, then WebTransport datagrams for snapshots (Safari
     26.4+). Fast resume on Safari backgrounding and network change. Plain-text-only rendering of every author or
     player string.
   - **Load-test target:** players per core on the reference shard. My a-priori guess is 20–80 **[unverified]**.
     Measure it before committing hosting costs.

---

## Sources (consolidated)

Netcode fundamentals:

- [Gambetta: client-server architecture](https://gabrielgambetta.com/client-server-game-architecture.html)
- [Gambetta: prediction and reconciliation](https://gabrielgambetta.com/client-side-prediction-server-reconciliation.html)
- [Gambetta: entity interpolation](https://gabrielgambetta.com/entity-interpolation.html)
- [Valve lag compensation](https://developer.valvesoftware.com/wiki/Lag_Compensation)
- [Overwatch GDC 2017](https://gdcvault.com/play/1024001/-Overwatch-Gameplay-Architecture-and)
- [Colyseus state sync (20 Hz default patch rate)](https://docs.colyseus.io/state)
- [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism)
- [Rapier #910](https://github.com/dimforge/rapier/issues/910)
- [wasmtime deterministic execution](https://docs.wasmtime.dev/examples-deterministic-wasm-execution.html)

Networks and transport:

- [Ookla via Telecompetitor](https://www.telecompetitor.com/is-5g-ready-for-ai-ookla-report/)
- [ISPreview on Ookla](https://www.ispreview.co.uk/index.php/2026/07/ookla-benchmarks-22-countries-for-5g-mobile-broadband-for-ai-workloads.html)
- [speedtesthq 4G vs 5G](https://speedtesthq.com/guides/mobile/4g-vs-5g)
- [WebTransport baseline](https://webrtc.ventures/2026/04/webtransport-is-now-baseline-what-it-means-for-real-time-media/)
- [caniuse WebTransport](https://caniuse.com/webtransport)

Case-study sources are linked inline in §1. The repo context comes from `docs/design/mmo/VISION.md`,
`MMO-REQUIREMENTS.md`, `SHARD-PLATFORM-PLAN.md` (lines 95–110: the one-shot's 30 Hz sim / 15 Hz snapshot server
and pure effect-returning interpreter), and `src/engine/core/fixedStep.ts` (60 Hz fixed step).
