# Host audit inventory

**Status:** unread · 2026-10-23 · HOST-AUDIT preparation

At `419cf542cd`: **114 groups, 310 selectors, 180 modules**. Jake approves each host individually. Recommended: **95 keep, 18 fold, 1 retire after legacy deletion**. This page changes no code, credit or zero lock.

**Evidence column:** HOST-BAR line · unique code lines in that group · documented adopters · recorded tests 2–6. Code lines exclude blanks/comments; overlapping groups cannot be summed. Their combined footprint is **18,721 lines**, not a chargeback or deletion estimate. Exact selectors are at the cited [HOST-BAR](../HOST-BAR.md) line; regenerate the list using this page’s commit body.

**Adopters:** P = Pine, DW = Driftwood, N = Nalati, 9 = Nine, Sky = Far Reach, Signal = Sunscar, T = Template. `—` means not recorded, not zero users. These are listing/R16 claims, not new live-user certification; fixtures and planned users never count as second users.

**Tests:** `1×5` / `6/6` are old listed scores, not rescored here; `coverage` has no five scores; `unscored` records none; `pending` explicitly awaits HOST-AUDIT. Existing selector/callback/pending-user/chargeback checks: **108 tests pass**. They test policy machinery, not every host’s semantic bar.

“Keep” retains the named capability, not every sibling in its file. “Fold” reuses an existing general host. The legacy water retirement waits for the separately authorized legacy deletion. Older “Still owed” entries and multiline kernel listings are included; folded painted-world/continuation notes inherit their existing host.

| Host | Evidence: line · code · users · tests | Recommended answer and why |
|---|---|---|
| H001 Post-graph look | L74 · 414 · N,9 · coverage | **keep** — shared composite and look rows |
| H002 Trample field/trail | L76 · 251 · P,N · coverage | **keep** — one shared grass interaction field |
| H003 Entry owner loans | L77 · 135 · P,DW · coverage | **keep** — finite scoped loan identities |
| H004 quest continuation | L78 · 43 · — · coverage | **keep** — native quest and save continuity |
| H005 page-mode policy | L79 · 12 · P · coverage | **keep** — standalone/grid data selection |
| H006 keyed-sky look | L80 · 370 · — · coverage | **keep** — declared sky and composite rows |
| H007 herd shelter | L81 · 134 · — · coverage | **keep** — shelter guest owns decisions |
| H008 grouped page actors | L82 · 40 · — · coverage | **keep** — ordered group identities and counts |
| H009 riding presentation | L83 · 342 · — · unscored | **keep** — profile-driven mount posing |
| H010 riding HUD | L84 · 205 · — · unscored | **keep** — baseline riding HUD ownership |
| H011 Legacy Pine water surface | L86 · 203 · P · unscored | **retire after legacy deletion** — legacy water copy ends with frozen Pine |
| H012 ranged page preparation | L94 · 11 · — · coverage | **keep** — existing ranged kit preparation |
| H013 creature install | L95 · 31 · — · coverage | **keep** — declared creature/model installation |
| H014 vertex wear | L96 · 35 · — · unscored | **fold into a general host** — combine with existing material attribute rows |
| H015 Fixed draws | L97 · 70 · — · 1×5 | **keep** — bounded geometry intake and ownership |
| H016 World assembly | L98 · 423 · — · coverage | **keep** — core model/set stage lifecycle |
| H017 Versioned script kernels | L100 · 357 · — · coverage | **keep** — bounded Wasm/query transactions |
| H018 derived species | L109 · 117 · P · unscored | **keep** — derived rigs from declared rows |
| H019 rope deck view | L110 · 30 · DW · unscored | **keep** — native rope interpolation is reusable |
| H020 rope deck | L111 · 30 · DW · unscored | **keep** — bounded native rope/deck geometry |
| H021 quest page views | L112 · 55 · P · unscored | **fold into a general host** — one-page view wiring belongs in view rows |
| H022 water level transition | L113 · 102 · P · unscored | **keep** — declared water-level easing |
| H023 island library | L114 · 82 · DW · unscored | **keep** — one admitted model-library owner |
| H024 View programs | L115 · 284 · DW,N · coverage | **keep** — shared AS view transport |
| H025 Aim ribbon | L116 · 40 · N · coverage | **keep** — native aim-trail presentation |
| H026 rope deck site | L117 · 67 · DW · unscored | **fold into a general host** — site orchestration over rope and placement |
| H027 boss creature card | L118 · 23 · P · unscored | **fold into a general host** — compose existing hull and card hosts |
| H028 quest figures | L119 · 86 · DW · unscored | **keep** — declared figure geometry and placement |
| H029 compiled page ownership | L121 · 44 · — · coverage | **keep** — compiled entry replaces subclass wiring |
| H030 World updates | L123 · 131 · — · 1×5 | **keep** — one ordered native frame registry |
| H031 Construction checkpoints | L126 · 40 · — · coverage | **keep** — construction yield/progress ownership |
| H032 quest entry prefix | L137 · 87 · — · coverage | **fold into a general host** — consolidate entry lifecycle adapters |
| H033 inventory reward rows | L139 · 4 · — · coverage | **keep** — native inventory admission preserved |
| H034 page boot | L143 · 45 · — · coverage | **fold into a general host** — boot policy already has declared rows |
| H035 entered claims | L145 · 20 · — · coverage | **keep** — one entered claims owner |
| H036 quest world facts | L147 · 9 · — · coverage | **keep** — strict entry-resource admission |
| H037 cold kit card | L149 · 31 · — · coverage | **keep** — cold cards retain their resources |
| H038 entered quest figures | L151 · 9 · — · coverage | **keep** — stable quest owner identity |
| H039 entered named places | L153 · 15 · — · coverage | **keep** — declared place membership binding |
| H040 native bake intake | L155 · 13 · P,DW · coverage | **keep** — strict native bake provenance |
| H041 bundled quest data | L157 · 18 · — · coverage | **keep** — bounded quest document admission |
| H042 declared biome queries | L159 · 18 · P · coverage | **keep** — fixed coordinate/channel laws |
| H043 Arena rooms/fire/encounter views | L165 · 1697 · — · 1×5 | **keep** — King and open room share lifecycle |
| H044 grapple traversal | L167 · 909 · — · unscored | **keep** — course/profile-driven traversal |
| H045 practice courses | L168 · 148 · N,9 · 6/6 | **keep** — Nine and Nalati course lifecycle |
| H046 Projected numeric continuation | L170 · 298 · N,9 · 6/6 | **keep** — shared projected state and continuation |
| H047 stealth | L175 · 141 · — · unscored | **keep** — AS detection with baseline HUD |
| H048 held weapons | L177 · 811 · — · unscored | **keep** — native weapon/contact projection |
| H049 walk-in portal rides | L179 · 276 · — · unscored | **keep** — row-driven portal transfers |
| H050 painterly look host | L180 · 391 · Sky,Signal · unscored | **keep** — shared painted material/ground rows |
| H051 audio patches | L181 · 101 · — · unscored | **keep** — declarative voice/bed scheduling |
| H052 audio scenes | L182 · 211 · — · unscored | **keep** — zone and cue audio director |
| H053 grass fields | L184 · 304 · — · unscored | **keep** — bounded field/ring presentation |
| H054 Panorama fog | L185 · 230 · N · unscored | **keep** — borrowed live panorama tint |
| H055 Figure groups/skins | L186 · 214 · N · unscored | **keep** — atlas/program-driven figure groups |
| H056 static captures | L187 · 178 · — · unscored | **keep** — bounded shadow/contact captures |
| H057 scatter projection | L188 · 93 · — · unscored | **keep** — numeric scatter and range ownership |
| H058 wing projection | L189 · 43 · — · unscored | **keep** — ambient wing pose projection |
| H059 loadout finishes | L191 · 230 · — · unscored | **keep** — declared cosmetic grants and saves |
| H060 declared runtime entry | L192 · 120 · — · unscored | **fold into a general host** — water/place setup uses existing core hosts |
| H061 Baked tile sets/lightmaps | L194 · 224 · DW,T · 6/6 | **keep** — shared tile/lightmap ownership |
| H062 world scene assembly | L195 · 367 · — · unscored | **keep** — core scatter/scene data intake |
| H063 declared page preparation | L197 · 99 · — · unscored | **fold into a general host** — finite preparation overlaps core stages |
| H064 game/riding/physics | L199 · 457 · — · unscored | **keep** — native reins/gait movement |
| H065 game/riding/taming | L200 · 107 · — · unscored | **keep** — admitted taming guest decisions |
| H066 game/riding/native | L201 · 239 · — · unscored | **keep** — single mounted-player authority |
| H067 game/riding/roster | L202 · 92 · — · unscored | **keep** — bonded mount/save identities |
| H068 game/riding/presentation | L203 · 23 · — · unscored | **keep** — numeric rig envelopes |
| H069 game/riding/nativeTaming | L204 · 152 · — · unscored | **keep** — native candidate/taming ownership |
| H070 game/riding/client | L205 · 367 · — · unscored | **keep** — entered riding service binding |
| H071 game/riding/nativePopulation | L206 · 324 · — · unscored | **keep** — native hunting/pasture state |
| H072 native body scripts | L221 · 24 · — · coverage | **keep** — body/quest AS continuation |
| H073 forest page features | L222 · 98 · P · coverage | **fold into a general host** — one-page feature composition |
| H074 world owner bindings | L224 · 89 · — · coverage | **keep** — concrete ownership and original frame slots |
| H075 entered ambient life | L225 · 17 · — · unscored | **fold into a general host** — ambient lifecycle already has core stages |
| H076 view module admission | L227 · 9 · — · coverage | **keep** — strict versioned Wasm admission |
| H077 concrete gameplay audio | L229 · 96 · — · coverage | **keep** — declared audio over native services |
| H078 entered audio loans | L231 · 17 · — · coverage | **keep** — typed audio loans retain ownership |
| H079 quest view entry | L233 · 7 · — · coverage | **fold into a general host** — reuse quest view installation |
| H080 declared hull-book kit | L235 · 20 · — · coverage | **fold into a general host** — hull preparation is existing kit lifecycle |
| H081 compiled island owners | L237 · 146 · — · coverage | **fold into a general host** — reuse core assembly and library admission |
| H082 explicit catalogue registration | L239 · 33 · — · coverage | **keep** — explicit finite catalogue registration |
| H083 Explorer catalogue | L241 · 30 · P,DW · 6/6 | **keep** — two real product catalogues |
| H084 entered hint and flag binding | L254 · 34 · — · coverage | **fold into a general host** — reuse chapter and hint lifecycle |
| H085 explicit entered Bag projection | L256 · 48 · — · coverage | **keep** — declared Bag projection |
| H086 Native world actions | L258 · 183 · — · 1×5 | **keep** — original native command dispatch |
| H087 Cell field | L260 · 105 · — · 1×5 | **keep** — one cell storage/update law |
| H088 Scalar channel | L262 · 15 · P,N · 1×5 | **keep** — exact typed scalar decoding |
| H089 Declared ground/basins | L264 · 40 · P,N · 1×5 | **keep** — declared ground and water bodies |
| H090 Scene texture loans | L266 · 31 · 9 · 1×5 | **keep** — scene-scoped texture ownership |
| H091 Held view | L268 · 207 · DW,9,T · 1×5 | **keep** — native held pose presentation |
| H092 Carried quest prop | L270 · 124 · — · 1×5 | **keep** — declared carried-prop lifecycle |
| H093 Height patch/GPU restore | L272 · 33 · — · 1×5 | **keep** — shared physics/GPU primitives |
| H094 Scalar lattice | L274 · 9 · P,N · 1×5 | **keep** — one bounded lattice sampler |
| H095 Practice controller | L276 · 109 · — · 1×5 | **keep** — shared native course controller |
| H096 Ground colour/surface | L278 · 11 · N · 1×5 | **keep** — fixed colour/surface sample laws |
| H097 Map colour | L280 · 5 · N · 1×5 | **keep** — declared map-colour samples |
| H098 World scenes/pools | L282 · 624 · — · 1×5 | **keep** — core resident scene/pool ownership |
| H099 Painted world stages | L284 · 94 · — · 1×5 | **fold into a general host** — painted setup is existing core assembly |
| H100 Elite entry/view | L286 · 756 · — · 1×5 | **keep** — generic elite presentation resources |
| H101 Elite roster/lifecycle | L287 · 624 · — · 1×5 | **keep** — AS-driven roster/continuation ownership |
| H102 Mounted/seated specimen | L289 · 69 · — · 1×5 | **keep** — row-driven riding specimens |
| H103 Timed slot/patrol encounters | L291 · 314 · — · 1×5 | **keep** — declared timed encounter lifecycles |
| H104 Runtime bounds | L293 · 18 · — · unscored | **keep** — finite bounds at existing hook |
| H105 Held slots/actor owners | L296 · 666 · DW,N,9 · coverage | **keep** — one held-slot/equipment authority |
| H106 Atlas figure skin | L298 · 27 · — · 1×5 | **keep** — shared atlas skin admission |
| H107 Finite actor projection | L301 · 335 · — · 1×5 | **keep** — finite native actor operation rows |
| H108 declared elite entry | L303 · 22 · — · coverage | **keep** — existing elite owner binding |
| H109 room and taming entry | L305 · 21 · — · coverage | **keep** — existing room/riding authorities |
| H110 Titan open-arena projection | L307 · 423 · N · pending | **fold into a general host** — boss-shaped capture/apply inside room host |
| H111 G667 case 3: crowd/species | L309 · 85 · N · pending | **fold into a general host** — compose existing species and crowd binders |
| H112 G667 case 1: herd/pack | L311 · 285 · N · pending | **keep** — one AS group/body lifecycle |
| H113 G667 case 2: native driver | L313 · 161 · N · pending | **keep** — one native roster and field authority |
| H114 G677 entered adapters | L315 · 118 · N · pending | **fold into a general host** — one-world entry adapter composition |

Scope: listed HOST-BAR groups. The wider pending-user/section-host registers remain HA1 discovery inputs, not certified users or passing scores. [HOST-AUDIT plan](../plans/HOST-AUDIT.md).
