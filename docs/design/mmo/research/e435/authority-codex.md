**Recommendation: Wildshard should use trusted server authority for shared gameplay and all persistent rewards, with client prediction for responsiveness.** Clients should control presentation and submit intentions. Shard authors should control content within an enforced API. Neither should be able to declare authoritative kills, mint portable items, award globally trusted titles, or submit their own activity scores.

That is approach **1 for gameplay**, implemented with a careful per-system split. It does **not** require simulating particles, cloth, decorative wildlife, or every rendered object on the server.

The harder finding is that **server authority cannot make an author-created reward farm meaningful**. It can prove that a creature died according to the rules. If its author put that creature in a cage, disabled its attacks, and made it respawn instantly, the server has faithfully operated a farm. Wildshard needs both authoritative simulation **and a separate platform policy governing rewards and ranking**.

Research checked on **3 October 2026**. I read the two supplied background documents and made no repository changes. Historical disclosures are dated below; **unverified** means I could not establish the detail from a suitable primary source. Architectural recommendations and attack examples are my analysis, not claims that a particular game implements them.

---

**1. What “authoritative” must mean**

There are three separate decisions:

| Decision | Question |
|---|---|
| Simulation authority | Who decides where an entity is, whether an attack hits, and whether a boss dies? |
| Persistence authority | Who can change inventory, achievements, currency, and saved quest state? |
| Rule authority | Who decides which encounters, items, and achievements deserve globally recognized value? |

Putting inventory in a database addresses persistence. It does not establish that the reported encounter happened.

Running an author’s code on your server addresses where it executes. It does not make the author’s rules trustworthy.

Likewise, **prediction is not authority**. A client can immediately simulate movement and display an attack while the server retains the final decision. Roblox’s current server-authority documentation explicitly describes this combination of prediction, rollback, and resimulation. [Roblox server authority](https://create.roblox.com/docs/projects/server-authority)

Do not equate these rates:

- Client rendering frequency.
- Physics integration frequency.
- AI decision frequency.
- Network snapshot frequency.
- Persistence frequency.

EVE explicitly distinguishes its 1 Hz physics simulation from other operations; Albion’s published architecture does not even use a universal per-object tick. Those distinctions materially affect cost. [EVE technical discussion](https://www.eveonline.com/news/view/paint-your-ship-red-and-make-it-faster), [Albion CTO presentation, 2016](https://davidsalz.de/wp-content/uploads/2016/06/Albion-Online-Quo-Vadis-2016-talk.pdf)

---

**2. Case studies**

**2.1 Rust — authoritative world, with documented client contributions**

**Authority and netcode.** Rust is a useful corrective to the claim that successful competitive games necessarily simulate every projectile exclusively on the server. Facepunch documented client-side projectile simulation with a simplified server verification model, including rejected-hit reporting. It also documented lag compensation for server-side firing-rate checks. These are historical implementation disclosures, not a guarantee that every detail remains unchanged. [Projectile netcode, 2016](https://rust.facepunch.com/news/devblog-123), [Firing-rate compensation](https://rust.facepunch.com/news/devblog-114)

**Tick and scale.** Facepunch exposes separate player-to-server and server-player update rates. I did **not** verify a single current, universal “Rust tick rate.” Capacity is operator-configurable; Facepunch’s operational examples explicitly discuss 1,000-player populations, which should not be mistaken for a performance guarantee. [Update-rate controls](https://rust.facepunch.com/news/july-update1), [Population-dependent behavior](https://rust.facepunch.com/news/nerfed-buffed-balanced)

**Interest management.** Networking uses spatial grids. Facepunch has also reduced sensitive replicated information, including buried stash locations, and investigated server occlusion. [Network grids](https://rust.facepunch.com/news/maintenance), [Anti-cheat and occlusion](https://rust.facepunch.com/news/road-renegades)

**UGC and exploits.** Custom maps and server administration are supported, but that is not evidence of a hardened arbitrary-author script sandbox. Facepunch documented subtle jump/fly cheats designed to remain inside permissive checks. [Custom-map support](https://rust.facepunch.com/news/electric-anniversary), [Movement-validation evasion](https://rust.facepunch.com/news/devblog-130)

**Wildshard lesson:** plausibility checks can work operationally, but maintaining them is continuing security work. Rust is evidence for a nuanced hybrid, not for trusting client-reported rewards.

**2.2 Minecraft — Java, Bedrock, and Hypixel are different cases**

**Java authority.** Minecraft’s logical server runs inventory, health, AI, spawning, and gameplay mechanics—even when that server lives inside the single-player application. Calling Minecraft generally “client-authoritative” is misleading. Client-reported movement and its validation are a narrower issue. [Forge’s description of Minecraft’s logical sides](https://docs.minecraftforge.net/en/1.12.x/concepts/sides/), [Fabric networking documentation](https://docs.fabricmc.net/develop/networking)

**Tick and netcode.** Java’s documented default simulation rate is **20 ticks per second**. Its rendering and entity interpolation are separate. Exact movement validation and lag-compensation behavior depend on version and server implementation; I did not establish one universal rewind model. [Mojang tick-command documentation](https://feedback.minecraft.net/hc/en-us/articles/20707371679117-Minecraft-Java-Edition-Snapshot-23w43a)

**Bedrock.** Mojang documents an input-driven server-authoritative movement protocol: clients predict, servers simulate inputs, and corrections reconcile disagreement. Server configuration also exposes authoritative movement controls. This is materially stronger than blindly accepting positions. [Bedrock movement protocol](https://mojang.github.io/bedrock-protocol-docs/guides/player-movement-overview/), [Dedicated-server properties](https://learn.microsoft.com/minecraft/creator/documents/bedrockserver/server-properties)

**UGC isolation.** Java server plugins are normally trusted machine-level code: Paper explicitly warns that plugins have unrestricted access to the server and its machine. Bedrock scripting has watchdog and memory controls; the documented default combined script-memory limit is **250 MB**, with world shutdown on exceedance. That is not a per-author isolation guarantee. [Paper plugin security](https://docs.papermc.io/paper/adding-plugins/), [Bedrock watchdog settings](https://learn.microsoft.com/minecraft/creator/documents/bedrockserver/server-properties)

**Hypixel and exploits.** Hypixel’s Watchdog runs server-side, detecting client irregularities and improbable behavior. Paper’s anti-Xray demonstrates another problem: authoritative block ownership does not prevent cheating if hidden resource information reaches the client. [Hypixel Watchdog](https://support.hypixel.net/hc/en-us/articles/360019613300-About-the-Hypixel-Watchdog-System), [Paper anti-Xray](https://docs.papermc.io/paper/anti-xray/)

**Scale.** Capacity is configuration- and workload-dependent. Hypixel’s network-wide population is not a single simulation-instance capacity. Its current internal per-instance limits and detailed topology are **unverified here**.

**Wildshard lesson:** copy the logical server/client separation and data-driven content. Do not copy Java’s trusted-plugin security assumptions.

**2.3 Black Desert Online — useful evidence, substantial undocumented details**

**Authority.** Pearl Abyss’s GDC presentation explicitly says its XML behavior-tree infrastructure supports **server-side action validation to detect hacking**. That establishes server validation, but does not establish exactly which movement, hit, and animation decisions are accepted from clients versus independently simulated. [Pearl Abyss GDC presentation, 2018, slides 13–16](https://s1.pearlcdn.com/pearlabyss/publications/%5BPEARLABYSS%5D_GDC2018_Taking_MMO_Development_to_the_Next_Level.pdf)

**Tick and netcode.** Current simulation tick rate, snapshot rate, reconciliation algorithm, hit-rewind policy, and network interest-management rules are **unverified**. Player complaints about desynchronization are not sufficient evidence for reverse-engineering the architecture. The same presentation documents distance-based rendering reductions, which must not be confused with network filtering.

**UGC and scale.** The documented behavior authoring is an internal developer system, not a public hostile-script platform. Pearl Abyss describes **300-versus-300** War of the Roses battles; this establishes an activity size, not one physical process’s capacity. [Developer commentary](https://blackdesert.pearlabyss.com/TR/en-us/News/Notice/Detail?_boardNo=18342)

**Cheats.** Pearl Abyss documents macro detection and enforcement. A precise causal attribution of specific speed/damage cheats to its authority model is **unverified**. [Pearl Protect announcement](https://blackdesert.pearlabyss.com/ASIA/ko-KR/News/Notice/Detail?_boardNo=1884)

**Wildshard lesson:** use BDO as a combat-feel and population reference. Its public evidence is insufficient to justify copying a particular authority split.

**2.4 World of Warcraft — centrally controlled rules, with client responsiveness**

**Authority.** Blizzard’s spell-batching explanation describes the server processing and resolving spell actions. This is server adjudication, not clients awarding their own successful attacks. Exact current movement acceptance, prediction, and interest-management internals are **unverified**. [Blizzard spell-batching explanation](https://us.forums.blizzard.com/en/wow/t/spell-batching-in-classic/137118/)

**Tick.** Historical spell-batching windows must not be presented as the tick rate of the entire server. Blizzard deliberately reproduced older batching behavior for Classic and subsequently changed it for Burning Crusade Classic. [Burning Crusade Classic technical discussion](https://worldofwarcraft.blizzard.com/en-us/news/23625673/world-of-warcraft-explorando-burning-crusade-classic)

**UGC.** Addons operate through a restricted client API; this is not permission to upload authoritative monsters or server scripts. Blizzard continues to restrict combat information and addon capabilities. [Combat-addon API changes](https://worldofwarcraft.blizzard.com/en-gb/news/24244638/how-midnights-upcoming-game-changes-will-impact-combat-addons)

**Scale and exploits.** Realms, layers, and instances are distinct. Blizzard explicitly declined to publish fixed Classic layer population caps. Its repeat-instance exploit allowed unintended repeated rewards despite server-controlled gameplay; bots also remained an enforcement problem. [Layer-cap disclosure](https://us.forums.blizzard.com/en/wow/t/q-a-compilation-wow-classic-development-team-ama/260760/1), [Repeat-instance exploit](https://us.forums.blizzard.com/en/wow/t/fix-for-repeat-instance-bug-exploit/300823), [Bot enforcement](https://us.forums.blizzard.com/en/wow/t/thank-you-for-your-reports/556126)

**Wildshard lesson:** instance lifecycle and reward eligibility are security boundaries. Correct combat simulation alone does not protect progression.

**2.5 EVE Online — strong authority, deliberately slow simulation**

**Authority and netcode.** CCP describes server-side solar-system simulation, **1 Hz physics**, and separate processing for non-physics interactions. Replication is scoped to spatial “bubbles,” commonly called grids. Time Dilation slows simulation when fleet fights exceed processing capacity. This is not an action-game latency solution. [CCP server deep dive](https://www.eveonline.com/news/view/paint-your-ship-red-and-make-it-faster)

**Scale.** The 2020 FWST-8 battle reached **6,557 concurrent characters in the system**. That is a documented historical event, not a current cap or a claim of normal-speed simulation. [CCP battle report](https://www.eveonline.com/es/news/view/fury-at-fwst-8-battle-report)

**UGC.** Player organizations and economic behavior are extensive, but this is not arbitrary player code running as authoritative world logic.

**Exploits.** CCP’s starbase-reactor exploit created valuable production materials and significantly affected markets. It was a trusted-server rule defect, not evidence that clients controlled inventory. [CCP investigation](https://www.eveonline.com/fr/news/view/update-regarding-the-starbase-exploit)

**Wildshard lesson:** separate world simulation, global services, and cosmetic traffic. Do not borrow EVE’s tick rate for first-person traversal or melee.

**2.6 Roblox — the most important comparison, with two distinct security layers**

**Authority history.** Roblox made replication filtering universal in **2018**; its later deprecation notice confirms that all experiences operated as if `FilteringEnabled` were enabled. This prevented broad client changes from automatically becoming shared truth. It did **not** make all physics server-authoritative. [Roblox’s FilteringEnabled history](https://devforum.roblox.com/t/filteringenabled-property-is-being-deprecated/1203582)

**Traditional physics model.** Roblox assigns physics ownership to clients or servers. Its documentation explicitly warns that it cannot verify client-owned physics and that clients can fabricate touches, teleport parts, or move them through walls. [Network ownership and security](https://create.roblox.com/docs/physics/network-ownership)

**Current server-authority model.** Roblox now documents server-owned simulation with client prediction, rollback, synchronized simulation time, and resimulation-compatible gameplay callbacks. The existence of that mode does not mean all older experiences use it. [Server authority](https://create.roblox.com/docs/projects/server-authority)

**Tick, interest, and scale.** There is no single verified rate here that safely describes physics, replication, and arbitrary script execution. Streaming restricts replicated content; server-authority setup requires it. Roblox’s official server-size announcement discusses **200-player servers**, but capacity remains experience-dependent. [Server-size controls](https://devforum.roblox.com/t/experience-join-improvements-server-size-join-queues-and-social-slots-reservations/2294621)

**Sandbox.** Luau removes dangerous libraries and supports protected globals and interruption. The embedding application must still enforce capabilities and resource limits. A malicious script running on Roblox’s server is still malicious game logic. [Luau sandbox](https://luau.org/sandbox/)

**Wildshard lesson:** replication filtering, script containment, physics authority, and economy protection are separate systems. Wildshard needs all four.

**2.7 Fortnite / UEFN / Verse — platform-owned gameplay with constrained extensions**

**Authority and netcode.** UEFN sessions use a dedicated server and client. Current documentation distinguishes server-configured state from locally evaluated camera behavior, and says creator-written client Verse prediction support remains under development. Do not assume creators can arbitrarily distribute Verse simulation across peers. [UEFN sessions](https://dev.epicgames.com/documentation/fortnite/live-edit-and-iteration-improvements-in-fortnite), [Camera execution boundary](https://dev.epicgames.com/documentation/fortnite/camera-component-modifiers-in-unreal-editor-for-fortnite)

**Tick and scale.** Epic documented an increase to **30 Hz** for standard Fortnite modes in 2018. That is historical evidence, not a universal current UEFN guarantee. Island settings support **1–100 players**. Epic also documented Replication Graph work for Fortnite’s replication scaling; current mode-specific hit-rewind details are **unverified**. [Tick-rate announcement](https://www.fortnite.com/news/state-of-development-v5), [Island capacity](https://dev.epicgames.com/documentation/fortnite/island-settings-in-unreal-editor-for-fortnite), [Replication architecture](https://www.unrealengine.com/tech-blog/replication-graph-overview-and-proper-replication-methods)

**Sandbox and rewards.** Verse has runtime error handling for runaway execution. The **100,000 memory-unit** publishing limit measures cooked content; Epic explicitly says it does not establish runtime memory safety. XP accolades undergo platform calibration and diminishing returns. [Verse troubleshooting](https://dev.epicgames.com/documentation/fortnite/debugging-and-troubleshooting-in-verse), [Memory accounting](https://dev.epicgames.com/documentation/en-us/fortnite/memory-management-in-unreal-editor-for-fortnite), [Accolade calibration](https://dev.epicgames.com/documentation/en-us/fortnite/calibration)

**Exploits.** I did not verify a specific Fortnite exploit whose root cause can confidently be assigned to client simulation authority.

**Wildshard lesson:** Epic’s reward mediation is particularly relevant. Authors may define award conditions without owning the platform’s final XP valuation.

**2.8 Second Life — server-side stranger scripts, inside a shared spatial grid**

**Authority and scripting.** LSL scripts execute in region simulators. Linden’s Mono documentation describes the simulator retrieving and executing script bytecode. The documented Mono script-memory ceiling is **64 KiB**, compared with **16 KiB** for legacy LSO scripts. [Mono execution](https://wiki.secondlife.com/wiki/Mono), [Script limits](https://wiki.secondlife.com/wiki/Limit)

**Tick and interest management.** Linden’s statistics documentation gives **45 simulation/physics frames per second** when healthy. This is not a promise that each script runs 45 times per second. Simulator interest lists decide which objects and changes reach viewers, including cross-region visibility. Exact prediction and lag compensation are **unverified here**. [Simulator statistics](https://wiki.secondlife.com/wiki/Viewerhelp%3AStatistics), [Interest-list tests](https://wiki.secondlife.com/wiki/Interest_List_test)

**Scale.** Historical Linden documentation gives **100 avatars for a full region**, with smaller limits for lighter region products. Current product-specific limits and exceptions require separate checking. [Historical official region table](https://wiki.secondlife.com/wiki/Linden_Lab_Official%3APrivate_island_special_promotion)

**Exploits.** “Grey goo”—self-replicating objects—illustrates how permitted world APIs can become a denial-of-service mechanism without escaping the language sandbox. [Second Life’s definition](https://wiki.secondlife.com/wiki/Grey_Goo)

**Wildshard lesson:** meter world effects, object creation, and event cascades. A script-memory limit alone does not bound the work a script can induce.

**2.9 VRChat / Udon — client object ownership, not an authoritative MMO simulator**

**Authority.** Networked objects have player owners; only the owner’s synchronized state is authoritative for that object. Ownership may transfer. VRChat specifically recommends ownership checks instead of assuming the instance master is a permanent authority. [Object ownership](https://creators.vrchat.com/worlds/udon/networking/ownership/)

**Netcode.** Udon supports synchronized variables, network events, and interpolation. Documentation gives approximately **11 KB/s** for outgoing Udon script data. That is a bandwidth constraint, not a simulation tick. I did not verify a universal gameplay tick or server combat-rewind service. [Networking limits](https://creators.vrchat.com/worlds/udon/networking/network-details/), [Synchronization components](https://creators.vrchat.com/worlds/udon/networking/network-components/)

**Sandbox.** Udon is a VM; UdonSharp compiles a C#-style authoring language to that environment. This does not mean arbitrary CLR code is installed. Persistent player data can be stored by VRChat, but storage is not proof of authoritative gameplay. [Udon overview](https://creators.vrchat.com/worlds/udon/), [Persistence](https://creators.vrchat.com/worlds/udon/persistence/)

**Scale and exploits.** The exact current capacity ceiling was not independently established from a developer-authored technical source. Owner-fabricated game state is an architectural risk inferred from ownership semantics; I am not presenting an unverified exploit incident as fact.

**Wildshard lesson:** useful for social toys and cooperative interactions. Client-owned outcomes are unsuitable evidence for portable loot or competitive placement.

**2.10 Valheim — cooperative trust, with important verification limits**

**Authority and hosting.** Iron Gate documents player-hosted sessions, dedicated servers, and user-controlled world/character saves. Dedicated hosting provides persistence and availability; it does not by itself establish server ownership of every simulation decision. [Official FAQ](https://www.valheimgame.com/faq/), [Dedicated-server guide](https://www.valheimgame.com/support/a-guide-to-dedicated-servers/)

**Netcode.** The frequently repeated description of client-owned zones/entities is plausible and supported by community investigation, but I did not recover sufficient current primary documentation to verify its precise ownership-transfer, prediction, or AI-distribution rules. Exact tick and interest-management parameters are **unverified**.

**Scale and UGC.** Iron Gate’s 1.0 FAQ specifies **1–10 players** and no official mod support. It also documents cheat flags for characters, worlds, and spawned items, affecting achievement eligibility. [Valheim 1.0 FAQ](https://www.valheimgame.com/support/valheim-1-0-faq/)

**Exploits.** User-controlled saves create a different trust boundary from centrally issued MMO inventory. Whether every current cheat flag resists deliberate save/client tampering is **unverified**; the FAQ does not establish that guarantee.

**Wildshard lesson:** a friends’ cooperative survival world is not evidence that the same trust model protects a public, ranked, portable progression economy.

**2.11 Albion Online — unusually relevant architecture**

**Authority.** Albion’s CTO explicitly advocates absolute server authority, including limiting information revealed to clients. His 2016 presentation describes one serious cheat caused by trusting client data without adequate checking, alongside persistent botting problems. [Original technical presentation](https://davidsalz.de/wp-content/uploads/2016/06/Albion-Online-Quo-Vadis-2016-talk.pdf)

**Tick and netcode.** The disclosed architecture is event-driven: commands, timers, pathfinding results, and database results enter a single-threaded area simulation. Mobs schedule recurring timers; there is no universal `Update()` loop. Networking uses Photon’s basic reliable/unreliable UDP messaging and TCP for other services.

**Interest and scale.** The historical design uses spatial hashing and subscription hysteresis. It describes approximately 1 km² areas with up to **300 players**, around **500 mobs**, and over **10,000 interactive objects**. These are historical design figures, not current capacity guarantees.

**Authoring.** Unity serves as a rendering/editor front end; exported level data and gameplay operate independently. Public arbitrary-author server scripting is not part of the disclosed model. Exact modern prediction and hit compensation are **unverified**.

**Wildshard lesson:** this is a stronger architectural reference than “run the whole three.js game headlessly.” Build a compact simulation that consumes authored data.

**2.12 RuneScape / Old School RuneScape — authoritative browser-MMO precedent**

**Authority and tick.** Jagex explicitly describes server-controlled character/NPC movement. Its September 2026 technical article confirms **600 ms ticks for both RuneScape and OSRS**, covering input, simulation, and state updates. That is approximately **1.67 Hz**, not 0.6 Hz. [Movement architecture](https://secure.runescape.com/m=news/game-update-smooth-movement), [Current tick explanation](https://secure.runescape.com/m=news/tektalk---understanding-engine-updates)

**Netcode and scale.** Clients smooth/interpolate movement. The 2026 article discusses processing a player alongside up to **1,499 others** for RuneScape; I did not verify OSRS’s current cap from a comparable primary source. Exact modern visibility algorithms and lag-compensation internals are **unverified**.

**UGC.** Player housing and client extensions are not equivalent to authors uploading new authoritative server rules.

**Exploits.** A specific exploit attributable to the authority boundary was not established in this source set. Do not confuse legal optimization of tick-based mechanics with bypassing server authority.

**Wildshard lesson:** browser delivery does not require client authority. However, RuneScape’s slow, grid-based action model is a poor latency template for Wildshard’s first-person combat.

**2.13 Guild Wars 2 — map instances and relevance matter as much as realm scale**

**Authority and netcode.** ArenaNet describes clients sending movement and skill inputs and servers returning world state. This supports a centrally coordinated gameplay model, but exact movement acceptance and hit-resolution rules remain **unverified**. [ArenaNet networking explanation](https://help.guildwars2.com/hc/en-us/articles/17313149660691-Connectivity-and-Lag-Troubleshooting)

**Scale.** The megaserver system creates multiple copies of maps and assigns players using party, guild, language, and other affinities. “Megaserver” does not mean one giant simulation process. Current numerical map caps and tick rates are **unverified here**. [Megaserver design](https://www.guildwars2.com/en/news/introducing-the-megaserver-system/)

**Interest management.** ArenaNet’s historical culling system could omit combatants, creating invisible enemies. Its removal distinguishes network visibility from reduced-detail rendering. [End of culling](https://www.guildwars2.com/en/news/world-vs-worldthe-end-of-culling/)

**UGC and exploits.** There is no documented general player-script execution platform in these sources. ArenaNet’s karma-vendor exploit involved an underpriced item producing a huge economic distortion despite server-run transactions. [ArenaNet economic analysis](https://www.guildwars2.com/en/news/john-smith-on-the-state-of-the-guild-wars-2-economy/)

**Wildshard lesson:** never hide relevant threats merely to meet a rendering budget. Also, a server can authoritatively execute catastrophically wrong reward rules.

**2.14 Garry’s Mod — useful networking reference, weaker author-isolation precedent**

**Authority and netcode.** Garry’s Mod separates server, client, and menu Lua realms. Clients predict movement from commands; the server adjudicates gameplay. Its documented default tick interval is **15 ms**, approximately **66.7 Hz**. Exact weapon lag compensation depends on implementation; Source provides server-side historical hit compensation. [Realms](https://wiki.facepunch.com/gmod/States), [Movement prediction](https://wiki.facepunch.com/gmod/Game_Movement), [Tick rate](https://wiki.facepunch.com/gmod/GM%3ATick), [Valve lag-compensation implementation](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/server/player_lagcompensation.cpp)

**Sandbox.** Separate Lua realms are not per-addon security compartments. Facepunch permits manually installed native modules and explicitly prevents their installation through ordinary addons for safety. A comprehensive per-author CPU/memory isolation contract is **unverified**. [Native-module restrictions](https://wiki.facepunch.com/gmod/Global.require)

**Exploits.** Facepunch’s networking documentation gives a concrete insecure RPC example where any client could invoke a privileged ban action because the server omitted permission checks. [Net-library security](https://wiki.facepunch.com/gmod/Net_Library_Usage)

**Scale.** Operator-, mode-, and entity-dependent; a verified universal current capacity was not established.

**Wildshard lesson:** arbitrary author-defined RPC handlers would recreate a large, avoidable security burden. Prefer engine-owned verbs and validation.

**2.15 Screeps — the clearest precedent for metered hostile game code**

**Authority.** Player scripts execute on servers and issue commands; a separate processing stage applies those commands to the world. This separation between **untrusted decision-making and trusted rule execution** is directly relevant. [Screeps architecture](https://docs.screeps.com/architecture.html)

**Tick and scale.** Ticks are workload-dependent, not fixed-rate action-game frames. Work distributes across players and rooms; the published hardware topology is historical and should not be treated as a current capacity specification. There is no meaningful universal “players per room” limit comparable with a shooter lobby. [CPU and tick model](https://docs.screeps.com/cpu-limit.html)

**Sandbox and quotas.** The API exposes CPU budgets, a carryover bucket, runtime heap statistics, and restricted world visibility. The older architecture describes process termination when a script timeout cannot safely recover. Its current API also exposes isolated-VM behavior. [Runtime API](https://docs.screeps.com/api/)

**Exploits and limitations.** The documentation itself identifies excessive script execution as a shared-performance risk. A named sandbox escape was not verified here. Crucially, the older `node:vm` description is not sufficient security guidance today: Node explicitly says that module is not a security mechanism. [Node’s warning](https://nodejs.org/api/vm.html)

**Wildshard lesson:** borrow the command/effect boundary and explicit resource accounting. Do not copy the slow global-tick model or an old sandbox implementation verbatim.

**2.16 New World — a caution against diagnosing architecture from one exploit**

**Verified incident.** Amazon’s October 2021 patch notes explicitly confirm that dragging the game window could repeatedly trigger invincibility. [Official patch notes](https://www.newworld.com/en-us/news/articles/server-transfer-details)

**Authority.** This proves an exploitable interaction between client behavior and server-observed gameplay. It does **not** establish that all damage, inventory, or world simulation was client-authoritative. The original official forum explanation of authority was inaccessible during this research, so its precise account is **unverified here**.

**Netcode and scale.** Current tick, prediction, hit-rewind, and per-process capacity figures are **unverified**. Amazon later documented duplicated world segments called shards for population management. [Shard technology announcement](https://www.newworld.com/en-gb/news/articles/new-world-update-5-0-2)

**UGC.** It is not a general stranger-script platform comparable with Roblox or Second Life.

**Wildshard lesson:** formally declaring the server authoritative is insufficient. Client silence, stalls, reconnects, and interrupted actions must have server-owned outcomes and deadlines.

---

**3. What the UGC platforms actually teach**

There are two attackers in Wildshard:

1. A player controlling their client.
2. An author controlling a shard package.

They may be the same person. They may also collaborate.

A safe script sandbox protects the host from code. An authoritative simulation protects shared state from clients. Neither automatically protects the economy from an author’s deliberately easy content.

| Platform | Execution and API boundary | Metering and memory evidence | Determinism and Wildshard implication |
|---|---|---|---|
| **Roblox / Luau** | Server and client scripts use engine APIs; unsafe standard-library facilities are removed. | VM interruption and memory accounting exist; a universal per-author hard heap quota was not established. | Sandboxing alone does not make arbitrary scripts deterministic. Replay-compatible code has additional restrictions. |
| **Second Life / LSL** | Event-driven scripts run on simulators through LSL APIs and permissions. | Documented per-script memory limits; simulator scheduling and API-specific limits. | Not a general deterministic lockstep contract. Many small scripts can still induce large aggregate world costs. |
| **UEFN / Verse** | Platform-managed server execution and exposed devices/APIs; native client presentation systems. | Runaway execution errors; cooked-content memory budget; no verified public universal per-script heap cap. | Verse transactions are not proof of whole-world deterministic replay. Runtime resource monitoring remains necessary. |
| **VRChat / Udon** | Restricted client VM and supported components; network ownership determines replicated writes. | Network/persistence quotas are documented. A comprehensive CPU/heap isolation guarantee was not established. | Synchronization is not deterministic consensus or trusted adjudication. |
| **Garry’s Mod / Lua** | Client/server realms, broad game APIs, operator-installed addons. | No verified comprehensive per-addon isolation or resource quota. | Separation by realm does not isolate mutually hostile authors inside a realm. |
| **Screeps** | Server-executed player code produces commands for trusted processing. | Explicit CPU limits, bucket, heap reporting, and execution interruption. | This is the strongest conceptual match for author code that requests effects without owning rules. |

The underlying evidence is in the platforms’ [Luau sandbox/API documentation](https://luau.org/api/), [LSL limits](https://wiki.secondlife.com/wiki/Limit), [Verse runtime guidance](https://dev.epicgames.com/documentation/fortnite/debugging-and-troubleshooting-in-verse), [Udon networking limits](https://creators.vrchat.com/worlds/udon/networking/network-details/), [Garry’s Mod realms](https://wiki.facepunch.com/gmod/States), and [Screeps CPU model](https://docs.screeps.com/cpu-limit.html).

**The server-side containment contract Wildshard needs**

My recommendation is to make author behavior a bounded producer of **effect requests**:

- Read a scoped snapshot.
- Process declared events.
- Return bounded commands.
- Let trusted engine code validate and apply those commands.

An author script should not receive a database connection, server credentials, arbitrary network access, raw engine objects, or a general “award anything” function.

Resource accounting must include more than instructions:

| Resource | Abuse that instruction fuel alone misses |
|---|---|
| Physics | Creating dense overlapping bodies, expensive joints, or repeated collision queries |
| AI/pathfinding | Requesting many long or impossible paths |
| Events | Each event spawning several more events |
| Replication | Changing many properties or creating many relevant entities |
| Persistence | Producing repeated writes or oversized state |
| Assets | Huge decoded textures, complex collision meshes, expensive material graphs |

A single cheap host call can request expensive engine work. Charge that work to the shard and bound it independently.

**WASM is suitable, but it is not the whole sandbox**

Your newer requirements approve WASM behind a data-only API. That is technically defensible: WebAssembly imports define access to host capabilities, and runtimes such as Wasmtime provide memory isolation and execution interruption. Wasmtime distinguishes deterministic fuel from nondeterministic wall-time/epoch interruption. [Wasmtime security model](https://docs.wasmtime.dev/security.html), [Execution interruption](https://docs.wasmtime.dev/examples-interrupting-wasm.html)

The missing implementation contract is substantial:

- Validate and constrain imports, memories, tables, module size, and supported features.
- Meter execution **and host-call effects**.
- Give each shard isolated state.
- Bound compilation/instantiation costs as well as runtime costs.
- Define what happens when a plugin traps or exhausts its budget.
- Keep accounting and global progression outside the plugin’s authority.
- Enforce equivalent containment on the phone.

Do not assume a server runtime’s fuel setting automatically exists in Safari’s WebAssembly execution. Browser-side metering or a bounded interpreter requires its own implementation and verification.

A worker is useful for scheduling and termination, but it does not by itself establish the complete capability, memory, and resource contract above.

**Determinism is valuable, but narrower than “everything runs twice”**

Rapier’s JavaScript/WASM version documents cross-platform determinism with the same version, initialization, and insertion/removal order. It explicitly warns that nondeterministic initialization operations can defeat that property. [Rapier determinism](https://rapier.rs/docs/user_guides/javascript/determinism/)

Use determinism for prediction, reproducible failures, and replay. It does not require every phone to simulate every NPC or every neighboring shard. Nor does it make a client’s submitted transcript truthful.

---

**4. Audit of the candidate approaches for Wildshard**

The following ratings are architectural judgments, not measured Wildshard benchmarks.

“Strong” means strong protection against **fabricated client outcomes**, assuming a correct implementation. It does not mean immunity to bots, colluding accounts, exploitable content, or server bugs.

| Approach | Loot, titles, achievements, ranking | Server CPU per player | Mobile latency and device cost | Migration and author burden | Main failure mode |
|---|---|---|---|---|---|
| **1. Trusted server owns shared simulation** | Strong provenance; separate reward/ranking policy still required | Highest direct simulation workload; amortized across occupants | Good immediate feel with prediction; bounded replay costs | Substantial engine separation; authors use headless-compatible systems | Bad rules execute faithfully; overloaded rooms create corrections and delay |
| **2. Progress-only authority** | Database is protected, but reported achievements remain weakly evidenced | Low initially; rises as validation becomes more complete | Local PvE feels immediate; phone carries AI/physics | Easy for solo play, much harder for shared bosses and puzzles | Plausible fabricated histories earn rewards |
| **3. Client authority plus heuristics** | Stops blatant abuse; subtle farming remains an ongoing contest | Low–medium, plus detection and investigation | Responsive until checks reject legitimate activity | Smaller first port; large continuing anti-cheat burden | Attacks stay within tolerance, or exploit new mechanics |
| **4a. Player/author client hosts room** | Host can fabricate the whole encounter | Low platform simulation cost; relay costs remain | Host advantage; host phone/network limits everyone | Convenient early co-op; migration and reconnect complexity | Host cheating, collusion, departure, throttling |
| **4b. Trusted operator server hosts room** | Strong if operator controls executable and credentials | Same fundamental cost as 1 | Same as 1 | Same as 1 | Calling it “host authority” disguises that it is ordinary server authority |
| **5. Per-system hybrid** | Strong only if every input to rewarded outcomes has trusted provenance | Medium–high, depending on delegated work | Good with selective prediction | Explicit dependencies required; often complex to audit | Client-controlled movement or physics undermines server-controlled combat |
| **6. Client simulation with deterministic server replay** | Stronger than plausibility if complete, timely, and independently replayed | Verification can approach full simulation cost | Immediate local play; delayed rewards and dispute resolution | Requires deterministic simulation, input commitments, replay/version management | Valid fabricated or optimized transcripts; late verification; shared-state conflicts |

**Approach 1: the most defensible default**

The server should own the state that makes shared play coherent: creature health, threat, target selection, boss phases, interactable state, quest transitions, and consequential physics.

This need not mean expensive visual simulation. A boss can have a compact authoritative body and attack volumes while the client renders a detailed animated model. Decorative destruction can remain local; a falling object that blocks a door or damages a player cannot.

The migration cost is real. Wildshard needs a headless gameplay core, explicit input commands, serialized state, and presentation driven by simulation events. But those changes also improve uploadability, testing, and crash recovery.

**Approach 2: “progress-only” leaves the important evidence missing**

Consider a server checking that:

- A player entered a shard.
- Enough time elapsed.
- Their gear could theoretically kill the boss.
- They requested no more than one reward.

A modified client can satisfy all four without playing the fight. The server has established eligibility to make a plausible claim, not completion.

There is also a multiplayer problem independent of cheating: if two clients disagree about the boss’s health, target, phase, or death, somebody must resolve that disagreement. A server that merely validates the final reward does not provide that arbitration.

As validation adds movement history, attack timing, boss behavior, collision, and damage, it converges toward authoritative simulation—often with a second, less-tested implementation of the rules.

This approach is reasonable for isolated, low-stakes activities whose outcomes do not affect shared progression. It is a poor foundation for Wildshard’s public grid.

**Approach 3: heuristics are supplementary defenses**

Heuristics are valuable for detecting bots, suspicious travel, abnormal reward rates, and repeated protocol abuse.

They are weaker as the primary correctness mechanism. A speed tolerance must accommodate packet jitter, mounts, knockback, moving platforms, teleports, and new authored mechanics. Attackers can exploit the same allowances.

Wildcard authoring makes this worse: every new movement ability expands the validator’s accepted behavior unless the engine owns a precise mechanical definition.

**Approach 4: distinguish the room owner from the hosting operator**

A room keyed by shard ID is a routing choice. It says nothing about trust.

- A player’s browser hosting the room is untrusted.
- An author’s rented machine is untrusted unless Wildshard explicitly trusts that operator.
- A process deployed and controlled by Wildshard on rented infrastructure is trusted.
- A signed shard package proves which package was loaded; it does not prove that an author-controlled host executed it honestly.

A server-side signature on “boss killed” is worthless if the attacker controls the server that signs it.

Player hosting is viable for private cooperative play with isolated progression. It conflicts with globally meaningful rewards and ranking unless those outcomes receive independent verification.

**Approach 5: hybrid must follow dependencies**

“Movement client-authoritative, combat server-authoritative” is weaker than it sounds.

Movement determines range, line of sight, access to pickups, avoidance of attacks, travel time, and whether a puzzle was traversed. Trusting the position while checking damage leaves many ways to farm legitimately computed rewards from illegitimate locations.

A safer hybrid is:

| System | Recommended authority |
|---|---|
| Camera, UI, particles, cosmetic animation | Client |
| Player movement | Server; client predicts |
| Mount/vehicle movement affecting gameplay | Server; driver predicts |
| NPC AI, health, damage, boss phases | Server |
| Doors, pressure plates, consequential movable objects | Server |
| Quest conditions and shared puzzle state | Server |
| Loot rolls and portable inventory | Trusted reward service using authoritative events |
| Global titles and achievements | Platform eligibility rules |
| Shard-local badges | Author-defined, explicitly namespaced and attributed |
| Meaningful-activity score | Platform computes from trusted observations |
| Decorative physics with no gameplay influence | Client |

The boundary is **consequence**, not visual complexity.

**Approach 6: replay verification is a specialist tool**

A replay can verify that a sequence of inputs produces a legal outcome. It cannot automatically prove that a human supplied those inputs live, that the client did not search many possible runs, or that the author’s encounter was meaningful.

For solo time trials or puzzle challenges, replay verification may be useful. For a continuously shared boss fight with contested state and immediate rewards, an online authority is simpler to reason about.

Peer voting is not a substitute: several colluding accounts can agree on the same false event.

---

**5. Cost and phone performance: what can honestly be concluded**

**There is no defensible dollar-per-player estimate without a representative headless workload and occupancy distribution.** Copying a Rust hosting price or an Albion player count would manufacture precision.

Model the work first:

\[
\text{room CPU}
=
\text{movement/physics}
+\text{active AI}
+\text{script work}
+\text{relevance/serialization}
+\text{persistence overhead}
\]

Then:

\[
\text{compute cost per player-hour}
=
\frac{\text{provisioned compute cost per hour}}
{\text{average concurrent players}}
\]

Add bandwidth, storage, service overhead, idle capacity, and recovery capacity separately.

Important implications for Wildshard:

- **A room is not necessarily a machine.** Multiple bounded rooms can share a worker.
- **Sparse occupancy can dominate cost.** Twenty-five rooms with one player each amortize fixed costs poorly.
- **A 500 m cube is not a workload specification.** Active bodies, NPCs, contacts, paths, scripts, and replicated entities determine work.
- **Do not continuously simulate everything.** Sleep inactive entities; schedule AI decisions separately from movement; use timers where continuous integration is unnecessary.
- **Phone memory does not imply equal server memory.** Servers need gameplay representations, not textures, post-processing resources, or full render scenes.

Albion’s disclosed sleeping objects, event scheduling, and renderer-independent simulation provide concrete precedent for several of these choices. [Albion architecture](https://davidsalz.de/wp-content/uploads/2016/06/Albion-Online-Quo-Vadis-2016-talk.pdf)

**Authority does not require input lag**

For the phone:

- Predict local movement and immediate weapon presentation.
- Interpolate remote actors.
- Reconcile against authoritative state.
- Keep replay history bounded and restricted to relevant predicted state.
- Confirm irreversible outcomes—loot, death, completed achievements—from the server.

Do not predict the entire room merely because the simulation can run in the browser. That would unnecessarily retain much of the single-player AI/physics burden while adding networking and replay.

Mobile stalls need a defined policy. The server should not allow a stopped client to preserve invulnerability, avoid consequences, or later upload a burst of impossible elapsed actions. Conversely, a poor connection should not automatically become evidence of cheating.

**Tick-rate recommendation:** keep physics, AI, snapshots, and rendering separately configurable. Test candidate rates against actual movement and combat, then select them from measured responsiveness and cost. There is no evidence that Wildshard needs to copy Rust, Fortnite, or RuneScape’s rate.

---

**6. The activity ranking is a separate adversarial system**

For Wildshard, centre placement is a scarce reward even if loot cannot be traded.

There are three different attacks:

| Attack | Example | Main defense |
|---|---|---|
| Fabricated activity | A modified client reports nonexistent kills or puzzle completion | Authoritative gameplay events |
| Trivial authored activity | An author places effortless objectives beside spawn | Reward/ranking policy independent of authored labels |
| Manufactured participation | Bots or colluding accounts repeatedly play an easy shard | Account/relationship signals, contribution bounds, review, and ranking design |

The owner exclusion in the requirements is useful but insufficient. An alternate account or cooperating player can perform the same actions.

My recommendation:

- Compute ranking from engine-observed behavior; never accept `meaningfulActivity += n`.
- Do not give every author-created quest or achievement an equal fixed score.
- Bound the contribution of repeated actions, sessions, and related participants.
- Preserve reward/ranking history across revisions; publishing a new revision must not reset every allowance.
- Treat edits/uploads as author activity with limited influence, not an unlimited ranking faucet.
- Include voluntary return visits and independent participation as candidate signals, while recognizing that both can be manipulated.
- Keep ranking reversible and explainable enough to investigate abuse.

No formula proves that play is meaningful. The objective is to make manufactured ranking expensive and limited, while avoiding a system that punishes legitimate popular content.

Fortnite offers a directly relevant precedent: its accolade system calibrates award value and applies platform-controlled diminishing returns, including repeated actions. It does not simply accept the creator’s desired global XP amount. [Accolade rules](https://dev.epicgames.com/documentation/fortnite/using-accolades-devices-in-fortnite-creative)

**Portable items and titles need the same separation**

An author should be able to create an interesting sword or a named achievement. That does not require permitting arbitrary portable combat power or globally equivalent prestige.

Recommended distinction:

- **Shard-local rewards:** expressive, namespaced, attributed to the author and revision.
- **Global progression:** platform-defined eligibility, issuance, and power bounds.
- **Global prestige:** a platform-recognized achievement class, not merely an author-selected title string.

If arbitrary author-defined challenge completion grants scarce global value, no amount of authoritative physics can guarantee comparable difficulty.

---

**7. Recommendation and the first five decisions/builds**

Choose **trusted server authority over consequential shared simulation**, plus client prediction and client-only presentation.

Use the uploaded package as data and bounded behavior. Keep the platform’s reward rules outside author control. Start with one active authoritative owner for each room; do not introduce player hosting or distributed simulation inside a room to avoid the initial server work.

The following five items should come first.

**1. Define the authority and reward contract**

Write the executable rules for what each party may request and what only the platform may decide.

Resolve:

- Which state is shared, private, persistent, or cosmetic.
- Whether author-created items can leave their shard, and under what power limits.
- Which titles are local versus globally recognized.
- Which events qualify for progression and ranking.
- Whether all hosting operators are trusted.

**First deliverable:** a capability matrix and protocol where clients send commands such as “attempt attack,” and author logic requests bounded effects. Neither interface exposes “set inventory,” “award global title,” or “submit ranking score.”

**2. Extract and demonstrate the headless simulation**

Build one small representative encounter containing movement, a creature, an attack, a door/puzzle interaction, and a reward.

Run it from the same package on a trusted server with two clients. The server owns gameplay state; one client is deliberately modified to send invalid requests.

Use versioned simulation state, stable entity identifiers, explicit clocks/RNG, and a separation between gameplay effects and rendering.

**First deliverable:** shared play that remains consistent when a client lies, disconnects, or misses updates. This establishes the authority model before networking every existing shard.

**3. Build the runtime boundary for author behavior**

Implement the declarative interpreter/WASM host with:

- Scoped reads and validated effects.
- Fuel, memory, event, entity, query, and persistence budgets.
- Bounded host operations.
- Explicit trap and overload behavior.
- Client containment as well as server containment.

Budget values should come from supported workloads and measured capacity, not copied constants.

**First deliverable:** a hostile package cannot hang the room, allocate without bound, flood effects, access unrelated data, or directly issue global rewards.

**4. Build prediction, relevance, and a measured capacity envelope**

Prove local movement prediction and reconciliation on the target phone class under mobile-network conditions. Include moving platforms or mounts early if they are core mechanics.

Measure CPU per occupied room, active AI, physics workload, outgoing bytes, replay cost, and phone memory. Define a supported room capacity from those results.

Use three-dimensional relevance for tall shards. Preserve nearby gameplay threats even when their visual representation must become cheaper.

**First deliverable:** a measured room envelope and a responsive phone client. This is where tick/snapshot rates and author budgets become justified engineering choices.

**5. Build durable rewards and shard handoff as one correctness problem**

A player crossing a border must not briefly exist as two independently reward-bearing characters.

Use one current room-owner epoch/lease, reject stale owners, and make reward application idempotent using durable event identities. Record enough provenance to associate rewards with player, encounter, shard revision, and authoritative room execution.

Design crash/reconnect behavior and revision replacement before adding seamless traversal.

For the first grid, I recommend keeping combat encounters and their consequential objects inside one room, using the highway as a controlled transfer boundary. Cross-border combat can follow once authority transfer is proven.

**First deliverable:** two neighboring shards where crashes, retries, reconnects, and revision changes cannot duplicate inventory or repeat completed reward claims.

Star Citizen’s published work is a useful warning about scope: preparing for meshing required coordinated conversion to an authority API and separation of connection stages. A grid of rooms avoids some of that complexity only if cross-room interactions remain explicitly bounded. [Star Citizen authority and connection work](https://robertsspaceindustries.com/en/comm-link/transmission/17991-Alpha-312-Postmortem)

**The decisive tradeoff:** progress-only authority saves simulation work by declining to establish some gameplay facts. Wildshard’s portable progression, shared encounters, hostile authors, and scarce centre placement all depend on those facts. Build the trusted simulation once, keep it small, and put author freedom around a platform-owned core.