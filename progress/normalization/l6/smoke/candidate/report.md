# Parity b0edb0abb3335766faaf912d85e0be74be9981f3

Verdict: red

## driftwood-isle × phone

Verdict: red

| Field | Baseline | Now | Band | Verdict |
|---|---|---|---|---|
| boot.errors | [] | [] | [] | green |
| boot.renderer | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | ANGLE Metal | green |
| boot.scene.totals.batched | 2 | 2 | ≤ 2 (B15 ratchet) | green |
| budgets.pier.draws | 223 | 223 | ≤ 223 | green |
| budgets.pier.tris | 1125728 | 1125728 | ≤ 1125728 | green |
| budgets.pier.programs | 95 | 95 | ≤ 95 | green |
| budgets.pier.gpuMB | 219.43689823150635 | 219.43689823150635 | ≤ 219.43689823150635 | green |
| budgets.beach.draws | 217 | 217 | ≤ 217 | green |
| budgets.beach.tris | 1065774 | 1065774 | ≤ 1065774 | green |
| budgets.beach.programs | 95 | 95 | ≤ 95 | green |
| budgets.beach.gpuMB | 219.43689823150635 | 219.43689823150635 | ≤ 219.43689823150635 | green |
| budgets.wreck.draws | 167 | 167 | ≤ 167 | green |
| budgets.wreck.tris | 936154 | 936154 | ≤ 936154 | green |
| budgets.wreck.programs | 95 | 95 | ≤ 95 | green |
| budgets.wreck.gpuMB | 219.43689823150635 | 219.43689823150635 | ≤ 219.43689823150635 | green |
| boot.schema | 1 | 1 | exact | green |
| boot.lane | "m5" | "m5" | exact | green |
| boot.shard | "driftwood-isle" | "driftwood-isle" | exact | green |
| boot.tier | "phone" | "phone" | exact | green |
| boot.viewport.w | 390 | 390 | exact | green |
| boot.viewport.h | 844 | 844 | exact | green |
| boot.viewport.dpr | 3 | 3 | exact | green |
| boot.viewport.touch | true | true | exact | green |
| boot.steps | ["renderer","sky","terrain","cards","forest","physics","edge","grass","cabins","props","animals","weapon","menu","shaders","firstFrame","audio"] | ["renderer","sky","terrain","cards","forest","physics","edge","grass","cabins","props","animals","weapon","menu","shaders","firstFrame","audio"] | exact | green |
| boot.systems.input | ["engine.input.weapon","engine.input.contexts","engine.input.collect","engine.lockon.input","engine.player.input"] | ["engine.input.weapon","engine.input.contexts","engine.input.collect","engine.lockon.input","engine.player.input"] | exact | green |
| boot.systems.fixed.pre | ["physics.bodies.pre","physics.movers"] | ["physics.bodies.pre","physics.movers"] | exact | green |
| boot.systems.fixed.step | ["physics.step"] | ["physics.step"] | exact | green |
| boot.systems.fixed.post | ["physics.bodies.post","player.step","shard.driftwood.bridge.capture"] | ["physics.bodies.post","player.step","shard.driftwood.bridge.capture"] | exact | green |
| boot.systems.update | ["player.update","main.2","shard.driftwood.cover","shard.driftwood.blenderIsland","shard.driftwood.ocean","shard.driftwood.boat","shard.driftwood.palms","shard.driftwood.gulls","shard.driftwood.bridge.pose","shard.driftwood.seabed","shard.driftwood.cove","shard.driftwood.shrine","world.impacts","engine.player.for","training-arena","hud.perf","engine.effects","main.6","shard.driftwood.dusk","shard.driftwood.adventure","shard.driftwood-isle.installSpine","shard.driftwood-isle.installTrader","shard.driftwood.adventure.2","shard.driftwood-isle.installGullGuide","shard.driftwood-isle.installComplet | ["player.update","main.2","shard.driftwood.cover","shard.driftwood.blenderIsland","shard.driftwood.ocean","shard.driftwood.boat","shard.driftwood.palms","shard.driftwood.gulls","shard.driftwood.bridge.pose","shard.driftwood.seabed","shard.driftwood.cove","shard.driftwood.shrine","world.impacts","engine.player.for","training-arena","hud.perf","engine.effects","main.6","shard.driftwood.dusk","shard.driftwood.adventure","shard.driftwood-isle.installSpine","shard.driftwood-isle.installTrader","shard.driftwood.adventure.2","shard.driftwood-isle.installGullGuide","shard.driftwood-isle.installComplet | exact | green |
| boot.systems.late | ["engine.input.trace","engine.input.edges","engine.hud.pins"] | ["engine.input.trace","engine.input.edges","engine.hud.pins"] | exact | green |
| boot.appStates | ["boot","loading","play"] | ["boot","loading","play"] | exact | green |
| boot.registry | [{"id":"boat","category":"buildings","surface":"planks","floor":true,"solidFloor":true,"follows":true,"shapes":{"cuboid":5,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"bridge","category":"buildings","surface":"planks","floor":true,"solidFloor":true,"follows":false,"shapes":{"cuboid":14,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"bushes","category":"nature","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"cove","category":"nature","surface":"rock","floor": | [{"id":"boat","category":"buildings","surface":"planks","floor":true,"solidFloor":true,"follows":true,"shapes":{"cuboid":5,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"bridge","category":"buildings","surface":"planks","floor":true,"solidFloor":true,"follows":false,"shapes":{"cuboid":14,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"bushes","category":"nature","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"cove","category":"nature","surface":"rock","floor": | exact | green |
| boot.registryModels.models | 69 | 69 | exact | green |
| boot.registryModels.sets | 9 | 9 | exact | green |
| boot.physics.fixed | 2 | 2 | exact | green |
| boot.physics.kinematic | 2 | 2 | exact | green |
| boot.physics.dynamic | 26 | 26 | exact | green |
| boot.physics.colliders | 2195 | 2195 | exact | green |
| boot.scene.totals.mesh | 605 | 604 | exact | red |
| boot.scene.totals.instanced | 33 | 33 | exact | green |
| boot.scene.totals.instances | 254 | 254 | exact | green |
| boot.scene.totals.skinned | 37 | 37 | exact | green |
| boot.scene.totals.points | 7 | 7 | exact | green |
| boot.scene.totals.lines | 3 | 3 | exact | green |
| boot.scene.totals.sprites | 10 | 10 | exact | green |
| boot.scene.totals.lights | 9 | 9 | exact | green |
| boot.scene.named | [{"path":"animals","type":"Group","n":58},{"path":"animals/far-herd","type":"Group","n":0},{"path":"animals/herd-shadow","type":"Group","n":0},{"path":"blender-island","type":"Group","n":155},{"path":"blender-island/island-casters-10","type":"Mesh","n":0},{"path":"blender-island/island-casters-10-far","type":"Mesh","n":0},{"path":"blender-island/island-casters-12","type":"Mesh","n":0},{"path":"blender-island/island-casters-12-far","type":"Mesh","n":0},{"path":"blender-island/island-casters-13","type":"Mesh","n":0},{"path":"blender-island/island-casters-13-far","type":"Mesh","n":0},{"path":"ble | [{"path":"animals","type":"Group","n":58},{"path":"animals/far-herd","type":"Group","n":0},{"path":"animals/herd-shadow","type":"Group","n":0},{"path":"blender-island","type":"Group","n":155},{"path":"blender-island/island-casters-10","type":"Mesh","n":0},{"path":"blender-island/island-casters-10-far","type":"Mesh","n":0},{"path":"blender-island/island-casters-12","type":"Mesh","n":0},{"path":"blender-island/island-casters-12-far","type":"Mesh","n":0},{"path":"blender-island/island-casters-13","type":"Mesh","n":0},{"path":"blender-island/island-casters-13-far","type":"Mesh","n":0},{"path":"ble | exact | green |
| boot.render.programs | 95 | 95 | ± 0 | green |
| boot.render.programKeys | "9382ab7ca3c5ccadc18103c5cf3acebb8da386410179d89389ad346e16735e64" | "9382ab7ca3c5ccadc18103c5cf3acebb8da386410179d89389ad346e16735e64" | exact | green |
| boot.render.memory.geometries | 436 | 436 | ± 0 | green |
| boot.render.memory.textures | 83 | 83 | ± 0 | green |
| boot.gpuBytes.textures | 91509608 | 91509608 | ± 0 | green |
| boot.gpuBytes.renderbuffers | 10877184 | 10877184 | ± 0 | green |
| boot.gpuBytes.buffers | 127709473 | 127709473 | ± 0 | green |
| boot.gpuBytes.total | 230096265 | 230096265 | ± 0 | green |
| boot.audio.requests | ["/assets/music/folk/island-calm-d7d189f9.m4a","/assets/music/folk/island-tension-bb05ab64.m4a","/assets/music/folk/pine-calm-10905c79.m4a","/assets/music/folk/pine-tension-180bc197.m4a","/assets/music/folk/sting-chunk-31c10eaf.m4a","/assets/music/folk/sting-death-67f54fe8.m4a","/assets/music/folk/sting-pickup-332f81db.m4a","/assets/music/folk/title-50001128.m4a","/assets/music/orchestral/island-calm-27861d1b.m4a","/assets/music/orchestral/island-tension-73116f36.m4a","/assets/music/orchestral/pine-calm-fbc4a99e.m4a","/assets/music/orchestral/pine-tension-525d8c6d.m4a","/assets/music/orchestra | ["/assets/music/folk/island-calm-d7d189f9.m4a","/assets/music/folk/island-tension-bb05ab64.m4a","/assets/music/folk/pine-calm-10905c79.m4a","/assets/music/folk/pine-tension-180bc197.m4a","/assets/music/folk/sting-chunk-31c10eaf.m4a","/assets/music/folk/sting-death-67f54fe8.m4a","/assets/music/folk/sting-pickup-332f81db.m4a","/assets/music/folk/title-50001128.m4a","/assets/music/orchestral/island-calm-27861d1b.m4a","/assets/music/orchestral/island-tension-73116f36.m4a","/assets/music/orchestral/pine-calm-fbc4a99e.m4a","/assets/music/orchestral/pine-tension-525d8c6d.m4a","/assets/music/orchestra | exact | green |
| boot.audio.state.style | "piano" | "piano" | exact | green |
| boot.audio.state.set | "best" | "best" | exact | green |
| boot.audio.state.mood | "menu" | "menu" | exact | green |
| boot.audio.score | "score.driftwood" | "score.driftwood" | exact | green |
| boot.hud | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"","shown":true},{"cls":"ws-boss-bar-frame","spot":"","shown":true},{"cls":"ws-boss-bar-lag","spot":"","shown":true},{"cls":"ws-boss-bar-name","spot":"","shown":true},{"cls":"ws-boss-bar-notches","spot":"","shown":true},{"cls":"ws-boss-bar-shimmer","spot":"","shown":true},{"cls":"ws-boss- | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"","shown":true},{"cls":"ws-boss-bar-frame","spot":"","shown":true},{"cls":"ws-boss-bar-lag","spot":"","shown":true},{"cls":"ws-boss-bar-name","spot":"","shown":true},{"cls":"ws-boss-bar-notches","spot":"","shown":true},{"cls":"ws-boss-bar-shimmer","spot":"","shown":true},{"cls":"ws-boss- | exact | red |
| boot.saves.read | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.far-reach","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","local:wildshard.save.v2.sunscar-dunes","session:wildshard.save.v2.session"] | exact | red |
| boot.saves.written | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | exact | green |
| poses.pier.name | "pier" | "pier" | exact | green |
| poses.pier.pos | [0.000011088525659508353,2.0050033503763554,-193.99999452402338] | [0.000011088525659508353,2.0050033503763554,-193.99999452402338] | ± [0,0,0] | green |
| poses.pier.calls | 223 | 223 | ± 0 | green |
| poses.pier.tris | 1125728 | 1125728 | ± 0 | green |
| poses.pier.ssim | 1 | 0.9957950752941612 | ≥ 0.989320258927779 | green |
| poses.beach.name | "beach" | "beach" | exact | green |
| poses.beach.pos | [-9.99866775789701,1.507045904773258,-150.00086653002296] | [-9.99866775789701,1.507045904773258,-150.00086653002296] | ± [0,0,0] | green |
| poses.beach.calls | 217 | 217 | ± 0 | green |
| poses.beach.tris | 1065774 | 1065774 | ± 0 | green |
| poses.beach.ssim | 1 | 0.9939082708877498 | ≥ 0.9866078512924091 | green |
| poses.wreck.name | "wreck" | "wreck" | exact | green |
| poses.wreck.pos | [105.00040426866872,3.6318565603614887,-0.017621197486732854] | [105.00040426866872,3.6318565603614887,-0.017621197486732854] | ± [0,0,0] | green |
| poses.wreck.calls | 167 | 167 | ± 0 | green |
| poses.wreck.tris | 936154 | 936154 | ± 0 | green |
| poses.wreck.ssim | 1 | 0.9999335685038696 | ≥ 0.9899949985619074 | green |

## pine-hollow × phone

Verdict: red

| Field | Baseline | Now | Band | Verdict |
|---|---|---|---|---|
| boot.errors | [] | [] | [] | green |
| boot.renderer | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | ANGLE Metal | green |
| boot.scene.totals.batched | 8 | 8 | ≤ 8 (B15 ratchet) | green |
| budgets.gate.draws | 104 | 104 | ≤ 104 | green |
| budgets.gate.tris | 1152418 | 1152418 | ≤ 1152418 | green |
| budgets.gate.programs | 109 | 109 | ≤ 109 | green |
| budgets.gate.gpuMB | 583.8486213684082 | 587.1324214935303 | ≤ 583.8486213684082 | red |
| budgets.cabin.draws | 146 | 147 | ≤ 146 | red |
| budgets.cabin.tris | 1324294 | 1324374 | ≤ 1324294 | red |
| budgets.cabin.programs | 109 | 109 | ≤ 109 | green |
| budgets.cabin.gpuMB | 583.8486213684082 | 587.1324214935303 | ≤ 583.8486213684082 | red |
| budgets.pond.draws | 92 | 92 | ≤ 92 | green |
| budgets.pond.tris | 950098 | 950098 | ≤ 950098 | green |
| budgets.pond.programs | 109 | 109 | ≤ 109 | green |
| budgets.pond.gpuMB | 583.8486213684082 | 587.1324214935303 | ≤ 583.8486213684082 | red |
| boot.schema | 1 | 1 | exact | green |
| boot.lane | "m5" | "m5" | exact | green |
| boot.shard | "pine-hollow" | "pine-hollow" | exact | green |
| boot.tier | "phone" | "phone" | exact | green |
| boot.viewport.w | 390 | 390 | exact | green |
| boot.viewport.h | 844 | 844 | exact | green |
| boot.viewport.dpr | 3 | 3 | exact | green |
| boot.viewport.touch | true | true | exact | green |
| boot.steps | ["renderer","sky","terrain","cards","forest","physics","edge","grass","cabins","props","animals","weapon","menu","shaders","firstFrame","audio"] | ["renderer","sky","terrain","cards","forest","physics","edge","grass","cabins","props","animals","weapon","menu","shaders","firstFrame","audio"] | exact | green |
| boot.systems.input | ["engine.input.weapon","engine.input.contexts","engine.input.collect","engine.lockon.input","engine.player.input"] | ["engine.input.weapon","engine.input.contexts","engine.input.collect","engine.lockon.input","engine.player.input"] | exact | green |
| boot.systems.fixed.pre | ["physics.bodies.pre","physics.movers"] | ["physics.bodies.pre","physics.movers"] | exact | green |
| boot.systems.fixed.step | ["physics.step"] | ["physics.step"] | exact | green |
| boot.systems.fixed.post | ["physics.bodies.post","player.step"] | ["physics.bodies.post","player.step"] | exact | green |
| boot.systems.update | ["player.update","pine.landmarks","training-arena","hud.perf","engine.effects","main.6","engine.effects.debug","engine.player.for","world.impacts","elites","main.world","engine.creatures.update","main.equipment","engine.audio.listener","engine.compendium.installCompendium","quest.kit","quest.pool","quest.shelf","quest","hud.combat","audio","shard.pine.weather.state","shard.pine.weather","world.life","first hints","main.frame","engine.player.regen","engine.player.hud"] | ["player.update","pine.landmarks","training-arena","hud.perf","engine.effects","main.6","engine.effects.debug","engine.player.for","world.impacts","elites","main.world","engine.creatures.update","main.equipment","engine.audio.listener","engine.compendium.installCompendium","quest.kit","quest.pool","quest.shelf","quest","hud.combat","audio","shard.pine.weather.state","shard.pine.weather","world.life","first hints","main.frame","engine.player.regen","engine.player.hud"] | exact | green |
| boot.systems.late | ["engine.input.trace","engine.input.edges","engine.hud.pins"] | ["engine.input.trace","engine.input.edges","engine.hud.pins"] | exact | green |
| boot.appStates | ["boot","loading","play"] | ["boot","loading","play"] | exact | green |
| boot.registry | [{"id":"cabin-1","category":"buildings","surface":"wood","floor":true,"solidFloor":true,"follows":false,"shapes":{"cuboid":37,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"cabin-1-door","category":"buildings","surface":"wood","floor":false,"solidFloor":false,"follows":true,"shapes":{"cuboid":1,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"cabin-2","category":"buildings","surface":"wood","floor":true,"solidFloor":true,"follows":false,"shapes":{"cuboid":37,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"cabin-2-door","category":"buildings","sur | [{"id":"cabin-1","category":"buildings","surface":"wood","floor":true,"solidFloor":true,"follows":false,"shapes":{"cuboid":37,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"cabin-1-door","category":"buildings","surface":"wood","floor":false,"solidFloor":false,"follows":true,"shapes":{"cuboid":1,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"cabin-2","category":"buildings","surface":"wood","floor":true,"solidFloor":true,"follows":false,"shapes":{"cuboid":37,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"cabin-2-door","category":"buildings","sur | exact | green |
| boot.registryModels.models | 65 | 65 | exact | green |
| boot.registryModels.sets | 19 | 19 | exact | green |
| boot.physics.fixed | 0 | 0 | exact | green |
| boot.physics.kinematic | 10 | 10 | exact | green |
| boot.physics.dynamic | 0 | 0 | exact | green |
| boot.physics.colliders | 2417 | 2417 | exact | green |
| boot.scene.totals.mesh | 676 | 675 | exact | red |
| boot.scene.totals.instanced | 40 | 40 | exact | green |
| boot.scene.totals.instances | 20064 | 20064 | exact | green |
| boot.scene.totals.skinned | 170 | 170 | exact | green |
| boot.scene.totals.points | 9 | 9 | exact | green |
| boot.scene.totals.lines | 3 | 3 | exact | green |
| boot.scene.totals.sprites | 9 | 9 | exact | green |
| boot.scene.totals.lights | 7 | 7 | exact | green |
| boot.scene.named | [{"path":"animals","type":"Group","n":199},{"path":"animals/far-herd","type":"Group","n":0},{"path":"animals/herd-shadow","type":"Group","n":0},{"path":"antler-king-fog-wall","type":"Mesh","n":0},{"path":"beaver-pool","type":"Group","n":2},{"path":"beaver-pool/beaver-pool","type":"Mesh","n":0},{"path":"beaver-pool/beaver-pool-trickle","type":"Mesh","n":0},{"path":"cabin-cluster","type":"Group","n":43},{"path":"canoe-ride","type":"Mesh","n":0},{"path":"creek-footbridge","type":"Group","n":5},{"path":"creek-waterfall","type":"Mesh","n":0},{"path":"fire-lookout","type":"Group","n":6},{"path":"ham | [{"path":"animals","type":"Group","n":199},{"path":"animals/far-herd","type":"Group","n":0},{"path":"animals/herd-shadow","type":"Group","n":0},{"path":"antler-king-fog-wall","type":"Mesh","n":0},{"path":"beaver-pool","type":"Group","n":2},{"path":"beaver-pool/beaver-pool","type":"Mesh","n":0},{"path":"beaver-pool/beaver-pool-trickle","type":"Mesh","n":0},{"path":"cabin-cluster","type":"Group","n":43},{"path":"canoe-ride","type":"Mesh","n":0},{"path":"creek-footbridge","type":"Group","n":5},{"path":"creek-waterfall","type":"Mesh","n":0},{"path":"fire-lookout","type":"Group","n":6},{"path":"ham | exact | green |
| boot.render.programs | 109 | 109 | ± 0 | green |
| boot.render.programKeys | "49e662a54ce97fb1295643dfc26e344cf9580595499c3856b24d21f44f75478b" | "49e662a54ce97fb1295643dfc26e344cf9580595499c3856b24d21f44f75478b" | exact | green |
| boot.render.memory.geometries | 227 | 225 | ± 0 | red |
| boot.render.memory.textures | 404 | 410 | ± 0 | red |
| boot.gpuBytes.textures | 567729880 | 573326888 | ± 0 | red |
| boot.gpuBytes.renderbuffers | 0 | 0 | ± 0 | green |
| boot.gpuBytes.buffers | 41667444 | 42326078 | ± 0 | red |
| boot.gpuBytes.total | 609397324 | 615652966 | ± 0 | red |
| boot.audio.requests | ["/assets/music/folk/pine-calm-10905c79.m4a","/assets/music/folk/pine-tension-180bc197.m4a","/assets/music/folk/sting-chunk-31c10eaf.m4a","/assets/music/folk/sting-death-67f54fe8.m4a","/assets/music/folk/sting-pickup-332f81db.m4a","/assets/music/folk/title-50001128.m4a","/assets/music/orchestral/pine-calm-fbc4a99e.m4a","/assets/music/orchestral/pine-tension-525d8c6d.m4a","/assets/music/orchestral/sting-chunk-a639b19e.m4a","/assets/music/orchestral/sting-death-771d34f7.m4a","/assets/music/orchestral/sting-pickup-65f7ac5b.m4a","/assets/music/orchestral/title-b47c8a52.m4a","/assets/music/piano/pi | ["/assets/music/folk/pine-calm-10905c79.m4a","/assets/music/folk/pine-tension-180bc197.m4a","/assets/music/folk/sting-chunk-31c10eaf.m4a","/assets/music/folk/sting-death-67f54fe8.m4a","/assets/music/folk/sting-pickup-332f81db.m4a","/assets/music/folk/title-50001128.m4a","/assets/music/orchestral/pine-calm-fbc4a99e.m4a","/assets/music/orchestral/pine-tension-525d8c6d.m4a","/assets/music/orchestral/sting-chunk-a639b19e.m4a","/assets/music/orchestral/sting-death-771d34f7.m4a","/assets/music/orchestral/sting-pickup-65f7ac5b.m4a","/assets/music/orchestral/title-b47c8a52.m4a","/assets/music/piano/pi | exact | green |
| boot.audio.state.style | "piano" | "piano" | exact | green |
| boot.audio.state.set | "best" | "best" | exact | green |
| boot.audio.state.mood | "menu" | "menu" | exact | green |
| boot.audio.score | "score.pine" | "score.pine" | exact | green |
| boot.hud | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"","shown":true},{"cls":"ws-boss-bar-frame","spot":"","shown":true},{"cls":"ws-boss-bar-lag","spot":"","shown":true},{"cls":"ws-boss-bar-name","spot":"","shown":true},{"cls":"ws-boss-bar-notches","spot":"","shown":true},{"cls":"ws-boss-bar-shimmer","spot":"","shown":true},{"cls":"ws-boss- | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"","shown":true},{"cls":"ws-boss-bar-frame","spot":"","shown":true},{"cls":"ws-boss-bar-lag","spot":"","shown":true},{"cls":"ws-boss-bar-name","spot":"","shown":true},{"cls":"ws-boss-bar-notches","spot":"","shown":true},{"cls":"ws-boss-bar-shimmer","spot":"","shown":true},{"cls":"ws-boss- | exact | red |
| boot.saves.read | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.far-reach","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","local:wildshard.save.v2.sunscar-dunes","session:wildshard.save.v2.session"] | exact | red |
| boot.saves.written | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | exact | green |
| poses.gate.name | "gate" | "gate" | exact | green |
| poses.gate.pos | [0.00042710675837298595,0.160625102234917,-200.00202254598304] | [0.00042710675837298595,0.160625102234917,-200.00202254598304] | ± [0,0,0] | green |
| poses.gate.calls | 104 | 104 | ± 0 | green |
| poses.gate.tris | 1152418 | 1152418 | ± 0 | green |
| poses.gate.ssim | 1 | 0.9999969377259407 | ≥ 0.9899969377259407 | green |
| poses.cabin.name | "cabin" | "cabin" | exact | green |
| poses.cabin.pos | [-13.999616810298562,2.110364922306699,-61.99747638583813] | [-13.999616810298562,2.110364922306699,-61.99747638583813] | ± [0,0,0] | green |
| poses.cabin.calls | 146 | 147 | ± 0 | red |
| poses.cabin.tris | 1324294 | 1324374 | ± 0 | red |
| poses.cabin.ssim | 1 | 0.9999991978058957 | ≥ 0.9899991930096357 | green |
| poses.pond.name | "pond" | "pond" | exact | green |
| poses.pond.pos | [-55.99571526334148,-0.663952566653726,95.00517056575245] | [-55.99571526334148,-0.663952566653726,95.00517056575245] | ± [0,0,0] | green |
| poses.pond.calls | 92 | 92 | ± 0 | green |
| poses.pond.tris | 950098 | 950098 | ± 0 | green |
| poses.pond.ssim | 1 | 0.9996368024862005 | ≥ 0.9898655527588136 | green |

## nalati-grasslands × phone

Verdict: red

| Field | Baseline | Now | Band | Verdict |
|---|---|---|---|---|
| boot.errors | [] | [] | [] | green |
| boot.renderer | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | ANGLE Metal | green |
| boot.scene.totals.batched | 5 | 5 | ≤ 5 (B15 ratchet) | green |
| budgets.camp.draws | 79 | 79 | ≤ 79 | green |
| budgets.camp.tris | 1174948 | 1174948 | ≤ 1174948 | green |
| budgets.camp.programs | 102 | 98 | ≤ 102 | green |
| budgets.camp.gpuMB | 238.87819290161133 | 225.7965316772461 | ≤ 238.87819290161133 | green |
| budgets.bridge.draws | 90 | 90 | ≤ 90 | green |
| budgets.bridge.tris | 1279751 | 1279751 | ≤ 1279751 | green |
| budgets.bridge.programs | 102 | 98 | ≤ 102 | green |
| budgets.bridge.gpuMB | 238.87819290161133 | 225.7965316772461 | ≤ 238.87819290161133 | green |
| budgets.plains.draws | 108 | 108 | ≤ 108 | green |
| budgets.plains.tris | 1292909 | 1292909 | ≤ 1292909 | green |
| budgets.plains.programs | 102 | 98 | ≤ 102 | green |
| budgets.plains.gpuMB | 238.87819290161133 | 225.7965316772461 | ≤ 238.87819290161133 | green |
| boot.schema | 1 | 1 | exact | green |
| boot.lane | "m5" | "m5" | exact | green |
| boot.shard | "nalati-grasslands" | "nalati-grasslands" | exact | green |
| boot.tier | "phone" | "phone" | exact | green |
| boot.viewport.w | 390 | 390 | exact | green |
| boot.viewport.h | 844 | 844 | exact | green |
| boot.viewport.dpr | 3 | 3 | exact | green |
| boot.viewport.touch | true | true | exact | green |
| boot.steps | ["renderer","sky","terrain","cards","forest","physics","edge","grass","cabins","props","animals","weapon","menu","shaders","firstFrame","audio"] | ["renderer","sky","terrain","cards","forest","physics","edge","grass","cabins","props","animals","weapon","menu","shaders","firstFrame","audio"] | exact | green |
| boot.systems.input | ["engine.input.weapon","engine.input.contexts","engine.input.collect","engine.lockon.input","shard.nalati.stealth.crouch","shard.nalati.ride.input","engine.player.input"] | ["engine.input.weapon","engine.input.contexts","engine.input.collect","engine.lockon.input","shard.nalati.stealth.crouch","shard.nalati.ride.input","engine.player.input"] | exact | green |
| boot.systems.fixed.pre | ["physics.bodies.pre","physics.movers"] | ["physics.bodies.pre","physics.movers"] | exact | green |
| boot.systems.fixed.step | ["physics.step"] | ["physics.step"] | exact | green |
| boot.systems.fixed.post | ["physics.bodies.post","player.step"] | ["physics.bodies.post","player.step"] | exact | green |
| boot.systems.update | ["player.update","world.impacts","engine.player.for","training-arena","hud.perf","engine.effects","main.6","shard.nalati.quest","hud.combat","main.world","shard.nalati.painterly","shard.nalati.water","shard.nalati.pois","shard.nalati.dressing","shard.nalati.weather.fx","shard.nalati.titan","shard.nalati.look","shard.nalati.elites","shard.nalati.boss","shard.nalati.wildlife","shard.nalati.stealth","shard.nalati.night","shard.nalati.ride","shard.nalati.skins","shard.nalati.sound","engine.creatures.update","main.equipment","engine.audio.listener","shard.nalati-grasslands.bind","first hints","main | ["player.update","world.impacts","engine.player.for","training-arena","hud.perf","engine.effects","main.6","shard.nalati.quest","hud.combat","main.world","shard.nalati.painterly","shard.nalati.water","shard.nalati.pois","shard.nalati.dressing","shard.nalati.weather.fx","shard.nalati.titan","shard.nalati.look","shard.nalati.elites","shard.nalati.boss","shard.nalati.wildlife","shard.nalati.stealth","shard.nalati.night","shard.nalati.ride","shard.nalati.skins","shard.nalati.sound","engine.creatures.update","main.equipment","engine.audio.listener","shard.nalati-grasslands.bind","first hints","main | exact | green |
| boot.systems.late | ["engine.input.trace","engine.input.edges","shard.nalati.reins","engine.hud.pins"] | ["engine.input.trace","engine.input.edges","shard.nalati.reins","engine.hud.pins"] | exact | green |
| boot.appStates | ["boot","loading","play"] | ["boot","loading","play"] | exact | green |
| boot.registry | [{"id":"forest","category":"nature","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":155,"convex":0,"trimesh":0,"treads":0}},{"id":"model:nalati-grasslands/aqbars","category":"creatures","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"model:nalati-grasslands/ar-15","category":"gear","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"model | [{"id":"forest","category":"nature","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":155,"convex":0,"trimesh":0,"treads":0}},{"id":"model:nalati-grasslands/aqbars","category":"creatures","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"model:nalati-grasslands/ar-15","category":"gear","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"model | exact | green |
| boot.registryModels.models | 94 | 94 | exact | green |
| boot.registryModels.sets | 17 | 17 | exact | green |
| boot.physics.fixed | 0 | 0 | exact | green |
| boot.physics.kinematic | 14 | 14 | exact | green |
| boot.physics.dynamic | 0 | 0 | exact | green |
| boot.physics.colliders | 2772 | 2772 | exact | green |
| boot.scene.totals.mesh | 311 | 308 | exact | red |
| boot.scene.totals.instanced | 44 | 44 | exact | green |
| boot.scene.totals.instances | 1722 | 1722 | exact | green |
| boot.scene.totals.skinned | 36 | 36 | exact | green |
| boot.scene.totals.points | 12 | 12 | exact | green |
| boot.scene.totals.lines | 3 | 3 | exact | green |
| boot.scene.totals.sprites | 11 | 11 | exact | green |
| boot.scene.totals.lights | 5 | 5 | exact | green |
| boot.scene.named | [{"path":"animals","type":"Group","n":61},{"path":"animals/far-herd","type":"Group","n":0},{"path":"animals/herd-shadow","type":"Group","n":0},{"path":"cloud-sea","type":"Mesh","n":0},{"path":"HUD + Weapon Explorer · grid arena","type":"Group","n":9},{"path":"impacts","type":"Mesh","n":0},{"path":"kurgan-dungeon","type":"Group","n":34},{"path":"kurgan-dungeon/kurgan-interior","type":"Mesh","n":0},{"path":"light-pool","type":"Group","n":0},{"path":"marmots","type":"Mesh","n":0},{"path":"nalati-camp-people","type":"Group","n":2},{"path":"nalati-camp-people/nalati-camp-child","type":"Object3D","n | [{"path":"animals","type":"Group","n":61},{"path":"animals/far-herd","type":"Group","n":0},{"path":"animals/herd-shadow","type":"Group","n":0},{"path":"cloud-sea","type":"Mesh","n":0},{"path":"HUD + Weapon Explorer · grid arena","type":"Group","n":9},{"path":"impacts","type":"Mesh","n":0},{"path":"kurgan-dungeon","type":"Group","n":34},{"path":"kurgan-dungeon/kurgan-interior","type":"Mesh","n":0},{"path":"light-pool","type":"Group","n":0},{"path":"marmots","type":"Mesh","n":0},{"path":"nalati-camp-people","type":"Group","n":2},{"path":"nalati-camp-people/nalati-camp-child","type":"Object3D","n | exact | green |
| boot.render.programs | 98 | 98 | ± 0 | green |
| boot.render.programKeys | "6f1d571cef85e4eb8655b2e44a9b6e56c11dcbc3e872076e3036797d5dd815d2" | "6f1d571cef85e4eb8655b2e44a9b6e56c11dcbc3e872076e3036797d5dd815d2" | exact | green |
| boot.render.memory.geometries | 120 | 120 | ± 0 | green |
| boot.render.memory.textures | 125 | 125 | ± 0 | green |
| boot.gpuBytes.textures | 122485564 | 122485564 | ± 0 | green |
| boot.gpuBytes.renderbuffers | 41060224 | 41060224 | ± 0 | green |
| boot.gpuBytes.buffers | 73219036 | 73219036 | ± 0 | green |
| boot.gpuBytes.total | 236764824 | 236764824 | ± 0 | green |
| boot.audio.requests | ["/assets/music/folk/island-calm-d7d189f9.m4a","/assets/music/folk/island-tension-bb05ab64.m4a","/assets/music/folk/pine-calm-10905c79.m4a","/assets/music/folk/pine-tension-180bc197.m4a","/assets/music/folk/sting-chunk-31c10eaf.m4a","/assets/music/folk/sting-death-67f54fe8.m4a","/assets/music/folk/sting-pickup-332f81db.m4a","/assets/music/folk/title-50001128.m4a","/assets/music/nalati/steppe-grass-calm-68234a31.m4a","/assets/music/nalati/steppe-grass-tension-e7aa4970.m4a","/assets/music/nalati/steppe-king-calm-bbcfbe31.m4a","/assets/music/nalati/steppe-king-tension-9d5ec1d2.m4a","/assets/music | ["/assets/music/folk/island-calm-d7d189f9.m4a","/assets/music/folk/island-tension-bb05ab64.m4a","/assets/music/folk/pine-calm-10905c79.m4a","/assets/music/folk/pine-tension-180bc197.m4a","/assets/music/folk/sting-chunk-31c10eaf.m4a","/assets/music/folk/sting-death-67f54fe8.m4a","/assets/music/folk/sting-pickup-332f81db.m4a","/assets/music/folk/title-50001128.m4a","/assets/music/nalati/steppe-grass-calm-68234a31.m4a","/assets/music/nalati/steppe-grass-tension-e7aa4970.m4a","/assets/music/nalati/steppe-king-calm-bbcfbe31.m4a","/assets/music/nalati/steppe-king-tension-9d5ec1d2.m4a","/assets/music | exact | green |
| boot.audio.state.style | "piano" | "piano" | exact | green |
| boot.audio.state.set | "best" | "best" | exact | green |
| boot.audio.state.mood | "menu" | "menu" | exact | green |
| boot.audio.score | "score.nalati" | "score.nalati" | exact | green |
| boot.hud | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"" | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"" | exact | red |
| boot.saves.read | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.far-reach","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","local:wildshard.save.v2.sunscar-dunes","session:wildshard.save.v2.session"] | exact | red |
| boot.saves.written | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | exact | green |
| poses.camp.name | "camp" | "camp" | exact | green |
| poses.camp.pos | [59.99947876895317,-3.7006266364497113,213.99621591742562] | [59.99947876895317,-3.7006266364497113,213.99621591742562] | ± [0,0,0] | green |
| poses.camp.calls | 79 | 79 | ± 0 | green |
| poses.camp.tris | 1174948 | 1174948 | ± 0 | green |
| poses.camp.ssim | 1 | 0.9999999999999695 | ≥ 0.99 | green |
| poses.bridge.name | "bridge" | "bridge" | exact | green |
| poses.bridge.pos | [0.0007564408897913211,-0.17507298126656679,199.99711763348637] | [0.0007564408897913211,-0.17507298126656679,199.99711763348637] | ± [0,0,0] | green |
| poses.bridge.calls | 90 | 90 | ± 0 | green |
| poses.bridge.tris | 1279751 | 1279751 | ± 0 | green |
| poses.bridge.ssim | 1 | 0.9999995645352309 | ≥ 0.9899972009064647 | green |
| poses.plains.name | "plains" | "plains" | exact | green |
| poses.plains.pos | [64.99891837889504,25.94705453091556,-0.0011753477151614788] | [64.99891837889504,25.94705453091556,-0.0011753477151614788] | ± [0,0,0] | green |
| poses.plains.calls | 108 | 108 | ± 0 | green |
| poses.plains.tris | 1292909 | 1292909 | ± 0 | green |
| poses.plains.ssim | 1 | 0.99999552869755 | ≥ 0.9899857529995786 | green |

## nine-dragon-stack × phone

Verdict: red

| Field | Baseline | Now | Band | Verdict |
|---|---|---|---|---|
| boot.errors | [] | [] | [] | green |
| boot.renderer | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | ANGLE Metal | green |
| boot.scene.totals.batched | 0 | 0 | 0 (facade prohibition) | green |
| boot.facade | {"multiDraw":true,"batches":0,"instances":15319} | {"multiDraw":true,"batches":0,"instances":15319} | multiDraw available; 0 batches; >0 instances | green |
| budgets.spawn-rail.draws | 144 | 144 | ≤ 144 | green |
| budgets.spawn-rail.tris | 1427662 | 1427662 | ≤ 1427662 | green |
| budgets.spawn-rail.programs | 67 | 66 | ≤ 67 | green |
| budgets.spawn-rail.gpuMB | 254.9377202987671 | 253.6043882369995 | ≤ 254.9377202987671 | green |
| budgets.well-edge.draws | 128 | 128 | ≤ 128 | green |
| budgets.well-edge.tris | 1273139 | 1273139 | ≤ 1273139 | green |
| budgets.well-edge.programs | 67 | 66 | ≤ 67 | green |
| budgets.well-edge.gpuMB | 254.9377202987671 | 253.6043882369995 | ≤ 254.9377202987671 | green |
| budgets.stair-street.draws | 122 | 122 | ≤ 122 | green |
| budgets.stair-street.tris | 996042 | 996042 | ≤ 996042 | green |
| budgets.stair-street.programs | 67 | 66 | ≤ 67 | green |
| budgets.stair-street.gpuMB | 254.9377202987671 | 253.6043882369995 | ≤ 254.9377202987671 | green |
| budgets.D.draws | 109 | 109 | ≤ 109 | green |
| budgets.D.tris | 1039194 | 1039194 | ≤ 1039194 | green |
| budgets.D.programs | 67 | 66 | ≤ 67 | green |
| budgets.D.gpuMB | 272.77142238616943 | 271.43809032440186 | ≤ 272.77142238616943 | green |
| boot.schema | 1 | 1 | exact | green |
| boot.lane | "m5" | "m5" | exact | green |
| boot.shard | "nine-dragon-stack" | "nine-dragon-stack" | exact | green |
| boot.tier | "phone" | "phone" | exact | green |
| boot.viewport.w | 390 | 390 | exact | green |
| boot.viewport.h | 844 | 844 | exact | green |
| boot.viewport.dpr | 3 | 3 | exact | green |
| boot.viewport.touch | true | true | exact | green |
| boot.steps | ["renderer","sky","terrain","cards","forest","physics","edge","grass","cabins","props","animals","weapon","menu","shaders","firstFrame","audio"] | ["renderer","sky","terrain","cards","forest","physics","edge","grass","cabins","props","animals","weapon","menu","shaders","firstFrame","audio"] | exact | green |
| boot.systems.input | ["engine.input.weapon","engine.input.contexts","engine.input.collect","shard.nd.feizhua.input","engine.lockon.input","engine.player.input"] | ["engine.input.weapon","engine.input.contexts","engine.input.collect","shard.nd.feizhua.input","engine.lockon.input","engine.player.input"] | exact | green |
| boot.systems.fixed.pre | ["physics.bodies.pre","physics.movers"] | ["physics.bodies.pre","physics.movers"] | exact | green |
| boot.systems.fixed.step | ["physics.step"] | ["physics.step"] | exact | green |
| boot.systems.fixed.post | ["physics.bodies.post","player.step","fei-zhua.rope"] | ["physics.bodies.post","player.step","fei-zhua.rope"] | exact | green |
| boot.systems.update | ["player.update","shard.nd.world","shard.nd.audio","world.impacts","engine.player.for","training-arena","engine.effects","main.world","engine.creatures.update","main.equipment","engine.audio.listener","fei-zhua","hud.perf","engine.world.bounds","main.6","hud.combat","first hints","main.frame","engine.player.regen","engine.player.hud"] | ["player.update","shard.nd.world","shard.nd.audio","world.impacts","engine.player.for","training-arena","engine.effects","main.world","engine.creatures.update","main.equipment","engine.audio.listener","fei-zhua","hud.perf","engine.world.bounds","main.6","hud.combat","first hints","main.frame","engine.player.regen","engine.player.hud"] | exact | green |
| boot.systems.late | ["engine.input.trace","engine.input.edges","engine.hud.pins"] | ["engine.input.trace","engine.input.edges","engine.hud.pins"] | exact | green |
| boot.appStates | ["boot","loading","play"] | ["boot","loading","play"] | exact | green |
| boot.registry | [{"id":"model:nine-dragon-stack/fp-arms","category":"gear","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"model:shared/hoverboard","category":"gear","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"model:shared/training-dummy","category":"props","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id | [{"id":"model:nine-dragon-stack/fp-arms","category":"gear","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"model:shared/hoverboard","category":"gear","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id":"model:shared/training-dummy","category":"props","surface":"wood","floor":false,"solidFloor":false,"follows":false,"shapes":{"cuboid":0,"ball":0,"capsule":0,"convex":0,"trimesh":0,"treads":0}},{"id | exact | green |
| boot.registryModels.models | 60 | 60 | exact | green |
| boot.registryModels.sets | 6 | 6 | exact | green |
| boot.physics.fixed | 0 | 0 | exact | green |
| boot.physics.kinematic | 1 | 1 | exact | green |
| boot.physics.dynamic | 0 | 0 | exact | green |
| boot.physics.colliders | 525 | 525 | exact | green |
| boot.scene.totals.mesh | 224 | 224 | exact | green |
| boot.scene.totals.instanced | 71 | 71 | exact | green |
| boot.scene.totals.instances | 17487 | 17487 | exact | green |
| boot.scene.totals.skinned | 10 | 10 | exact | green |
| boot.scene.totals.points | 2 | 2 | exact | green |
| boot.scene.totals.lines | 3 | 3 | exact | green |
| boot.scene.totals.sprites | 9 | 9 | exact | green |
| boot.scene.totals.lights | 2 | 2 | exact | green |
| boot.scene.named | [{"path":"animals","type":"Group","n":24},{"path":"animals/far-herd","type":"Group","n":0},{"path":"animals/herd-shadow","type":"Group","n":0},{"path":"fei-zhua:bite-flash","type":"Mesh","n":0},{"path":"fei-zhua:bite-sparks","type":"Mesh","n":0},{"path":"fei-zhua:dock-flash","type":"Mesh","n":0},{"path":"fei-zhua:filament","type":"Mesh","n":0},{"path":"fei-zhua:flying-claw","type":"Group","n":5},{"path":"fei-zhua:lock-halo","type":"Mesh","n":0},{"path":"fei-zhua:muzzle-flash","type":"Mesh","n":0},{"path":"HUD + Weapon Explorer · grid arena","type":"Group","n":9},{"path":"impacts","type":"Mesh" | [{"path":"animals","type":"Group","n":24},{"path":"animals/far-herd","type":"Group","n":0},{"path":"animals/herd-shadow","type":"Group","n":0},{"path":"fei-zhua:bite-flash","type":"Mesh","n":0},{"path":"fei-zhua:bite-sparks","type":"Mesh","n":0},{"path":"fei-zhua:dock-flash","type":"Mesh","n":0},{"path":"fei-zhua:filament","type":"Mesh","n":0},{"path":"fei-zhua:flying-claw","type":"Group","n":5},{"path":"fei-zhua:lock-halo","type":"Mesh","n":0},{"path":"fei-zhua:muzzle-flash","type":"Mesh","n":0},{"path":"HUD + Weapon Explorer · grid arena","type":"Group","n":9},{"path":"impacts","type":"Mesh" | exact | green |
| boot.render.programs | 66 | 66 | ± 0 | green |
| boot.render.programKeys | "94f7445079966f7a8e9d342a3fc73835e00df6755f019f82aadbb8d914aba2a3" | "94f7445079966f7a8e9d342a3fc73835e00df6755f019f82aadbb8d914aba2a3" | exact | green |
| boot.render.memory.geometries | 135 | 135 | ± 0 | green |
| boot.render.memory.textures | 54 | 54 | ± 0 | green |
| boot.gpuBytes.textures | 130811123 | 130811123 | ± 0 | green |
| boot.gpuBytes.renderbuffers | 1572864 | 1572864 | ± 0 | green |
| boot.gpuBytes.buffers | 133539488 | 133539488 | ± 0 | green |
| boot.gpuBytes.total | 265923475 | 265923475 | ± 0 | green |
| boot.audio.requests | ["/assets/music/folk/title-50001128.m4a","/assets/music/nine-dragon-stack/nd-fight-calm-f81a3489.m4a","/assets/music/nine-dragon-stack/nd-fight-tension-56031d7b.m4a","/assets/music/nine-dragon-stack/nd-market-calm-4a5af233.m4a","/assets/music/nine-dragon-stack/nd-market-tension-5a01320f.m4a","/assets/music/nine-dragon-stack/nd-well-calm-4dcde431.m4a","/assets/music/nine-dragon-stack/nd-well-tension-b91dc9e0.m4a","/assets/music/nine-dragon-stack/sting-chunk-d9289a49.m4a","/assets/music/nine-dragon-stack/sting-death-bf5c76c6.m4a","/assets/music/nine-dragon-stack/sting-pickup-8516b7e3.m4a","/asse | ["/assets/music/folk/title-50001128.m4a","/assets/music/nine-dragon-stack/nd-fight-calm-f81a3489.m4a","/assets/music/nine-dragon-stack/nd-fight-tension-56031d7b.m4a","/assets/music/nine-dragon-stack/nd-market-calm-4a5af233.m4a","/assets/music/nine-dragon-stack/nd-market-tension-5a01320f.m4a","/assets/music/nine-dragon-stack/nd-well-calm-4dcde431.m4a","/assets/music/nine-dragon-stack/nd-well-tension-b91dc9e0.m4a","/assets/music/nine-dragon-stack/sting-chunk-d9289a49.m4a","/assets/music/nine-dragon-stack/sting-death-bf5c76c6.m4a","/assets/music/nine-dragon-stack/sting-pickup-8516b7e3.m4a","/asse | exact | green |
| boot.audio.state.style | "piano" | "piano" | exact | green |
| boot.audio.state.set | "best" | "best" | exact | green |
| boot.audio.state.mood | "menu" | "menu" | exact | green |
| boot.audio.beds | ["bed.nd.market","bed.nd.well"] | ["bed.nd.market","bed.nd.well"] | exact | green |
| boot.audio.score | "score.nd" | "score.nd" | exact | green |
| boot.hud | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-combat-death","spot":"","shown":false},{"cls":"ws-combat-death-card","spot":"","shown":true},{"cls":"ws-combat-death-cause","spot":"","shown":true},{"cls":"ws-combat-death-rule","spot":"","shown":true},{"cls":"ws-combat-death-where","spot":"","shown":true},{"cls":"ws-combat-float","spot":"","shown":false},{"cls":"ws-combat-float","spot":"","shown":false},{"cls":"ws-combat-float","spot":"","shown":false},{"cls":"ws-combat-float","spot":"","shown":false},{"cls":"ws-combat-float","spot":"","shown":false},{"cls":"ws-combat-float","spot":"","shown | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-combat-death","spot":"","shown":false},{"cls":"ws-combat-death-card","spot":"","shown":true},{"cls":"ws-combat-death-cause","spot":"","shown":true},{"cls":"ws-combat-death-rule","spot":"","shown":true},{"cls":"ws-combat-death-where","spot":"","shown":true},{"cls":"ws-combat-float","spot":"","shown":false},{"cls":"ws-combat-float","spot":"","shown":false},{"cls":"ws-combat-float","spot":"","shown":false},{"cls":"ws-combat-float","spot":"","shown":false},{"cls":"ws-combat-float","spot":"","shown":false},{"cls":"ws-combat-float","spot":"","shown | exact | red |
| boot.saves.read | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.far-reach","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","local:wildshard.save.v2.sunscar-dunes","session:wildshard.save.v2.session"] | exact | red |
| boot.saves.written | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | exact | green |
| poses.spawn-rail.name | "spawn-rail" | "spawn-rail" | exact | green |
| poses.spawn-rail.pos | [0.9500041000201145,125.01997932122322,7.500011153203284] | [0.9500041000201145,125.01997932122322,7.500011153203284] | ± [0,0,0] | green |
| poses.spawn-rail.calls | 144 | 144 | ± 0 | green |
| poses.spawn-rail.tris | 1427662 | 1427662 | ± 0 | green |
| poses.spawn-rail.ssim | 1 | 1 | ≥ 0.99 | green |
| poses.well-edge.name | "well-edge" | "well-edge" | exact | green |
| poses.well-edge.pos | [-19.49998902975687,125.02005193833247,13.300006270785072] | [-19.49998902975687,125.02005193833247,13.300006270785072] | ± [0,0,0] | green |
| poses.well-edge.calls | 128 | 128 | ± 0 | green |
| poses.well-edge.tris | 1273139 | 1273139 | ± 0 | green |
| poses.well-edge.ssim | 1 | 1 | ≥ 0.99 | green |
| poses.stair-street.name | "stair-street" | "stair-street" | exact | green |
| poses.stair-street.pos | [17.99998878440237,125.0199562292255,5.9999919782222815] | [17.99998878440237,125.0199562292255,5.9999919782222815] | ± [0,0,0] | green |
| poses.stair-street.calls | 122 | 122 | ± 0 | green |
| poses.stair-street.tris | 996042 | 996042 | ± 0 | green |
| poses.stair-street.ssim | 1 | 0.9992954676695148 | ≥ 0.98946083874236 | green |

## Budget derivation driftwood-isle × phone

| Pose | Metric | Observed | Derived target | Enforced ceiling | Formula / inputs |
|---|---|---|---|---|---|
| pier | draws | 223 | "—" | 223 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| pier | tris | 1125728 | "—" | 1125728 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| pier | programs | 95 | "—" | 95 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| pier | gpuMB | 219.43689823150635 | "—" | 219.43689823150635 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (pier): {"ceilings":{"phone":{"pier":{"draws":223,"tris":1125728,"programs":95,"gpuMB":219.43689823150635},"beach":{"draws":217,"tris":1065774,"programs":95,"gpuMB":219.43689823150635},"wreck":{"draws":167,"tris":936154,"programs":95,"gpuMB":219.43689823150635}},"desktop":{"pier":{"draws":945,"tris":3295289,"programs":108,"gpuMB":583.5372714996338},"beach":{"draws":566,"tris":2320154,"programs":108,"gpuMB":583.5372714996338},"wreck":{"draws":234,"tris":1456452,"programs":108,"gpuMB":583.5372714996338}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":30,"fixedSeconds":5.5,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

| beach | draws | 217 | "—" | 217 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| beach | tris | 1065774 | "—" | 1065774 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| beach | programs | 95 | "—" | 95 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| beach | gpuMB | 219.43689823150635 | "—" | 219.43689823150635 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (beach): {"ceilings":{"phone":{"pier":{"draws":223,"tris":1125728,"programs":95,"gpuMB":219.43689823150635},"beach":{"draws":217,"tris":1065774,"programs":95,"gpuMB":219.43689823150635},"wreck":{"draws":167,"tris":936154,"programs":95,"gpuMB":219.43689823150635}},"desktop":{"pier":{"draws":945,"tris":3295289,"programs":108,"gpuMB":583.5372714996338},"beach":{"draws":566,"tris":2320154,"programs":108,"gpuMB":583.5372714996338},"wreck":{"draws":234,"tris":1456452,"programs":108,"gpuMB":583.5372714996338}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":30,"fixedSeconds":5.5,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

| wreck | draws | 167 | "—" | 167 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| wreck | tris | 936154 | "—" | 936154 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| wreck | programs | 95 | "—" | 95 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| wreck | gpuMB | 219.43689823150635 | "—" | 219.43689823150635 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (wreck): {"ceilings":{"phone":{"pier":{"draws":223,"tris":1125728,"programs":95,"gpuMB":219.43689823150635},"beach":{"draws":217,"tris":1065774,"programs":95,"gpuMB":219.43689823150635},"wreck":{"draws":167,"tris":936154,"programs":95,"gpuMB":219.43689823150635}},"desktop":{"pier":{"draws":945,"tris":3295289,"programs":108,"gpuMB":583.5372714996338},"beach":{"draws":566,"tris":2320154,"programs":108,"gpuMB":583.5372714996338},"wreck":{"draws":234,"tris":1456452,"programs":108,"gpuMB":583.5372714996338}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":30,"fixedSeconds":5.5,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

## Budget derivation pine-hollow × phone

| Pose | Metric | Observed | Derived target | Enforced ceiling | Formula / inputs |
|---|---|---|---|---|---|
| gate | draws | 104 | "—" | 104 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| gate | tris | 1152418 | "—" | 1152418 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| gate | programs | 109 | "—" | 109 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| gate | gpuMB | 587.1324214935303 | "—" | 583.8486213684082 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (gate): {"ceilings":{"phone":{"gate":{"draws":104,"tris":1152418,"programs":109,"gpuMB":583.8486213684082},"cabin":{"draws":146,"tris":1324294,"programs":109,"gpuMB":583.8486213684082},"pond":{"draws":92,"tris":950098,"programs":109,"gpuMB":583.8486213684082}},"desktop":{"gate":{"draws":244,"tris":8432496,"programs":116,"gpuMB":1308.288724899292},"cabin":{"draws":276,"tris":7991860,"programs":116,"gpuMB":1308.288724899292},"pond":{"draws":184,"tris":5241776,"programs":116,"gpuMB":1308.288724899292}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":40,"fixedSeconds":3,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

| cabin | draws | 147 | "—" | 146 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| cabin | tris | 1324374 | "—" | 1324294 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| cabin | programs | 109 | "—" | 109 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| cabin | gpuMB | 587.1324214935303 | "—" | 583.8486213684082 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (cabin): {"ceilings":{"phone":{"gate":{"draws":104,"tris":1152418,"programs":109,"gpuMB":583.8486213684082},"cabin":{"draws":146,"tris":1324294,"programs":109,"gpuMB":583.8486213684082},"pond":{"draws":92,"tris":950098,"programs":109,"gpuMB":583.8486213684082}},"desktop":{"gate":{"draws":244,"tris":8432496,"programs":116,"gpuMB":1308.288724899292},"cabin":{"draws":276,"tris":7991860,"programs":116,"gpuMB":1308.288724899292},"pond":{"draws":184,"tris":5241776,"programs":116,"gpuMB":1308.288724899292}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":40,"fixedSeconds":3,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

| pond | draws | 92 | "—" | 92 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| pond | tris | 950098 | "—" | 950098 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| pond | programs | 109 | "—" | 109 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| pond | gpuMB | 587.1324214935303 | "—" | 583.8486213684082 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (pond): {"ceilings":{"phone":{"gate":{"draws":104,"tris":1152418,"programs":109,"gpuMB":583.8486213684082},"cabin":{"draws":146,"tris":1324294,"programs":109,"gpuMB":583.8486213684082},"pond":{"draws":92,"tris":950098,"programs":109,"gpuMB":583.8486213684082}},"desktop":{"gate":{"draws":244,"tris":8432496,"programs":116,"gpuMB":1308.288724899292},"cabin":{"draws":276,"tris":7991860,"programs":116,"gpuMB":1308.288724899292},"pond":{"draws":184,"tris":5241776,"programs":116,"gpuMB":1308.288724899292}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":40,"fixedSeconds":3,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

## Budget derivation nalati-grasslands × phone

| Pose | Metric | Observed | Derived target | Enforced ceiling | Formula / inputs |
|---|---|---|---|---|---|
| camp | draws | 79 | "—" | 79 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| camp | tris | 1174948 | "—" | 1174948 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| camp | programs | 98 | "—" | 102 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| camp | gpuMB | 225.7965316772461 | "—" | 238.87819290161133 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (camp): {"ceilings":{"phone":{"camp":{"draws":79,"tris":1174948,"programs":102,"gpuMB":238.87819290161133},"bridge":{"draws":90,"tris":1279751,"programs":102,"gpuMB":238.87819290161133},"plains":{"draws":108,"tris":1292909,"programs":102,"gpuMB":238.87819290161133}},"desktop":{"camp":{"draws":202,"tris":4900943,"programs":119,"gpuMB":601.0351619720459},"bridge":{"draws":468,"tris":6044582,"programs":119,"gpuMB":601.0351619720459},"plains":{"draws":311,"tris":6124688,"programs":119,"gpuMB":601.0351619720459}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":35.5,"fixedSeconds":5.2,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

| bridge | draws | 90 | "—" | 90 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| bridge | tris | 1279751 | "—" | 1279751 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| bridge | programs | 98 | "—" | 102 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| bridge | gpuMB | 225.7965316772461 | "—" | 238.87819290161133 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (bridge): {"ceilings":{"phone":{"camp":{"draws":79,"tris":1174948,"programs":102,"gpuMB":238.87819290161133},"bridge":{"draws":90,"tris":1279751,"programs":102,"gpuMB":238.87819290161133},"plains":{"draws":108,"tris":1292909,"programs":102,"gpuMB":238.87819290161133}},"desktop":{"camp":{"draws":202,"tris":4900943,"programs":119,"gpuMB":601.0351619720459},"bridge":{"draws":468,"tris":6044582,"programs":119,"gpuMB":601.0351619720459},"plains":{"draws":311,"tris":6124688,"programs":119,"gpuMB":601.0351619720459}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":35.5,"fixedSeconds":5.2,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

| plains | draws | 108 | "—" | 108 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| plains | tris | 1292909 | "—" | 1292909 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| plains | programs | 98 | "—" | 102 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| plains | gpuMB | 225.7965316772461 | "—" | 238.87819290161133 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (plains): {"ceilings":{"phone":{"camp":{"draws":79,"tris":1174948,"programs":102,"gpuMB":238.87819290161133},"bridge":{"draws":90,"tris":1279751,"programs":102,"gpuMB":238.87819290161133},"plains":{"draws":108,"tris":1292909,"programs":102,"gpuMB":238.87819290161133}},"desktop":{"camp":{"draws":202,"tris":4900943,"programs":119,"gpuMB":601.0351619720459},"bridge":{"draws":468,"tris":6044582,"programs":119,"gpuMB":601.0351619720459},"plains":{"draws":311,"tris":6124688,"programs":119,"gpuMB":601.0351619720459}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":35.5,"fixedSeconds":5.2,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

## Budget derivation nine-dragon-stack × phone

| Pose | Metric | Observed | Derived target | Enforced ceiling | Formula / inputs |
|---|---|---|---|---|---|
| spawn-rail | draws | 144 | "—" | 144 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| spawn-rail | tris | 1427662 | "—" | 1427662 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| spawn-rail | programs | 66 | "—" | 67 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| spawn-rail | gpuMB | 253.6043882369995 | "—" | 254.9377202987671 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (spawn-rail): {"ceilings":{"phone":{"spawn-rail":{"draws":144,"tris":1427662,"programs":67,"gpuMB":254.9377202987671},"well-edge":{"draws":128,"tris":1273139,"programs":67,"gpuMB":254.9377202987671},"stair-street":{"draws":122,"tris":996042,"programs":67,"gpuMB":254.9377202987671},"D":{"draws":109,"tris":1039194,"programs":67,"gpuMB":272.77142238616943}},"desktop":{"spawn-rail":{"draws":171,"tris":1653616,"programs":82,"gpuMB":575.5018644332886},"well-edge":{"draws":158,"tris":1375200,"programs":82,"gpuMB":575.5018644332886},"stair-street":{"draws":144,"tris":947634,"programs":82,"gpuMB":575.5018644332886},"D":{"draws":123,"tris":964738,"programs":82,"gpuMB":575.8172407150269}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":null,"fixedSeconds":0,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

| well-edge | draws | 128 | "—" | 128 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| well-edge | tris | 1273139 | "—" | 1273139 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| well-edge | programs | 66 | "—" | 67 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| well-edge | gpuMB | 253.6043882369995 | "—" | 254.9377202987671 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (well-edge): {"ceilings":{"phone":{"spawn-rail":{"draws":144,"tris":1427662,"programs":67,"gpuMB":254.9377202987671},"well-edge":{"draws":128,"tris":1273139,"programs":67,"gpuMB":254.9377202987671},"stair-street":{"draws":122,"tris":996042,"programs":67,"gpuMB":254.9377202987671},"D":{"draws":109,"tris":1039194,"programs":67,"gpuMB":272.77142238616943}},"desktop":{"spawn-rail":{"draws":171,"tris":1653616,"programs":82,"gpuMB":575.5018644332886},"well-edge":{"draws":158,"tris":1375200,"programs":82,"gpuMB":575.5018644332886},"stair-street":{"draws":144,"tris":947634,"programs":82,"gpuMB":575.5018644332886},"D":{"draws":123,"tris":964738,"programs":82,"gpuMB":575.8172407150269}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":null,"fixedSeconds":0,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

| stair-street | draws | 122 | "—" | 122 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| stair-street | tris | 996042 | "—" | 996042 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| stair-street | programs | 66 | "—" | 67 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| stair-street | gpuMB | 253.6043882369995 | "—" | 254.9377202987671 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (stair-street): {"ceilings":{"phone":{"spawn-rail":{"draws":144,"tris":1427662,"programs":67,"gpuMB":254.9377202987671},"well-edge":{"draws":128,"tris":1273139,"programs":67,"gpuMB":254.9377202987671},"stair-street":{"draws":122,"tris":996042,"programs":67,"gpuMB":254.9377202987671},"D":{"draws":109,"tris":1039194,"programs":67,"gpuMB":272.77142238616943}},"desktop":{"spawn-rail":{"draws":171,"tris":1653616,"programs":82,"gpuMB":575.5018644332886},"well-edge":{"draws":158,"tris":1375200,"programs":82,"gpuMB":575.5018644332886},"stair-street":{"draws":144,"tris":947634,"programs":82,"gpuMB":575.5018644332886},"D":{"draws":123,"tris":964738,"programs":82,"gpuMB":575.8172407150269}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":null,"fixedSeconds":0,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

| D | draws | 109 | "—" | 109 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| D | tris | 1039194 | "—" | 1039194 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| D | programs | 66 | "—" | 67 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |
| D | gpuMB | 271.43809032440186 | "—" | 272.77142238616943 | F2 baseline max(lanes) + recorded band; ratchet may only decrease |

Inputs (D): {"ceilings":{"phone":{"spawn-rail":{"draws":144,"tris":1427662,"programs":67,"gpuMB":254.9377202987671},"well-edge":{"draws":128,"tris":1273139,"programs":67,"gpuMB":254.9377202987671},"stair-street":{"draws":122,"tris":996042,"programs":67,"gpuMB":254.9377202987671},"D":{"draws":109,"tris":1039194,"programs":67,"gpuMB":272.77142238616943}},"desktop":{"spawn-rail":{"draws":171,"tris":1653616,"programs":82,"gpuMB":575.5018644332886},"well-edge":{"draws":158,"tris":1375200,"programs":82,"gpuMB":575.5018644332886},"stair-street":{"draws":144,"tris":947634,"programs":82,"gpuMB":575.5018644332886},"D":{"draws":123,"tris":964738,"programs":82,"gpuMB":575.8172407150269}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":null,"fixedSeconds":0,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: No published calibration; F2 ceilings until the quiet M5 publishing run
Assumption: Hot phone = M5 ×10 assumption (E283); current stable M5 calibration is not yet published

