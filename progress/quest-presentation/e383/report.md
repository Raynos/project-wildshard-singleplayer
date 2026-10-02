# Parity e5dbbe11b1d039729226b1d9ffe1eea36f69c508

Verdict: green

## driftwood-isle × phone

Verdict: green

| Field | Baseline | Now | Band | Verdict |
|---|---|---|---|---|
| leak.disposalErrors | [] | [] | no disposal failures | green |
| boot.errors | [] | [] | [] | green |
| boot.renderer | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | ANGLE Metal | green |
| boot.scene.totals.batched | 2 | 2 | ≤ 2 (B15 ratchet) | green |
| walk.stuck | 0 | 0 | 0 | green |
| walk.legs.pier.stuck | [] | [] | [] | green |
| walk.legs.pier.out | 0 | 0 | 0 | green |
| walk.legs.lookout.stuck | [] | [] | [] | green |
| walk.legs.lookout.out | 0 | 0 | 0 | green |
| walk.legs.cave.stuck | [] | [] | [] | green |
| walk.legs.cave.out | 0 | 0 | 0 | green |
| walk.touch | {"moved":15.100946929698013,"yawDelta":-1.1399999999999997,"dodged":true,"used":true} | {"moved":15.100946929698013,"yawDelta":-1.1399999999999997,"dodged":true,"used":true} | moved ≥2; yaw changed; dodge; use | green |
| combat.swing | {"weapon":"sword","target":"crab","hits":3,"hitWithinS":0.5693333333333044,"killed":true,"killWithinS":1.6759999999999167,"hitLimit":3,"killLimit":15} | {"weapon":"sword","target":"crab","hits":3,"hitWithinS":0.5693333333333044,"killed":true,"killWithinS":1.6759999999999167,"hitLimit":3,"killLimit":15} | hit and kill within limits | green |
| pauseResume | {"before":{"appState":"paused","clockNow":65.57599999999886,"player":{"pos":{"x":-7.872,"y":1.929,"z":-142.116},"yaw":-0.7380514260733101,"pitch":-0.7388837258157365,"vel":{"x":0,"y":0,"z":0},"health":100},"weapon":{"id":"sword","state":{"magazine":30,"reserve":0,"loaded":true,"reloading":false,"reloadProgress":0,"ads":false},"ammo":null},"creatures":[{"id":"bear:11","kind":"bear","pos":{"x":65.957,"y":6.127,"z":-80.921},"hp":320,"brain":"idle"},{"id":"bear:12","kind":"bear","pos":{"x":-119.539,"y":3.625,"z":-98.997},"hp":220,"brain":"idle"},{"id":"boar:0","kind":"boar","pos":{"x":69.034,"y":2 | {"before":{"appState":"paused","clockNow":65.57599999999886,"player":{"pos":{"x":-7.872,"y":1.929,"z":-142.116},"yaw":-0.7380514260733101,"pitch":-0.7388837258157365,"vel":{"x":0,"y":0,"z":0},"health":100},"weapon":{"id":"sword","state":{"magazine":30,"reserve":0,"loaded":true,"reloading":false,"reloadProgress":0,"ads":false},"ammo":null},"creatures":[{"id":"bear:11","kind":"bear","pos":{"x":65.957,"y":6.127,"z":-80.921},"hp":320,"brain":"idle"},{"id":"bear:12","kind":"bear","pos":{"x":-119.539,"y":3.625,"z":-98.997},"hp":220,"brain":"idle"},{"id":"boar:0","kind":"boar","pos":{"x":69.034,"y":2 | no state drift; resumed prior state | green |
| leak.geometries | 0 | 0 | B1 = B0 | green |
| leak.textures | 0 | 0 | B1 = B0 | green |
| leak.programs | 0 | 0 | B1 = B0 | green |
| leak.bodies | 0 | 0 | B1 = B0 | green |
| leak.colliders | 0 | 0 | B1 = B0 | green |
| leak.listeners.window | 0 | 0 | B1 = B0 | green |
| leak.listeners.document | 0 | 0 | B1 = B0 | green |
| leak.listeners.canvas | 0 | 0 | B1 = B0 | green |
| leak.listeners.other | 0 | 0 | B1 = B0 | green |
| leak.timers.timeouts | 0 | 0 | B1 = B0 | green |
| leak.timers.intervals | 0 | 0 | B1 = B0 | green |
| leak.timers.raf | 0 | 0 | B1 = B0 | green |
| leak.audio.activeVoices | 0 | 0 | B1 = B0 | green |
| leak.audio.beds | 0 | 0 | B1 = B0 | green |
| leak.audio.buses | 0 | 0 | B1 = B0 | green |
| leak.systems.input | 0 | 0 | B1 = B0 | green |
| leak.systems.fixed.pre | 0 | 0 | B1 = B0 | green |
| leak.systems.fixed.step | 0 | 0 | B1 = B0 | green |
| leak.systems.fixed.post | 0 | 0 | B1 = B0 | green |
| leak.systems.update | 0 | 0 | B1 = B0 | green |
| leak.systems.late | 0 | 0 | B1 = B0 | green |
| leak.systems.render | 0 | 0 | B1 = B0 | green |
| leak.events.listeners | 7 | 7 | B1 = B0 | green |
| leak.events.answerers | 5 | 5 | B1 = B0 | green |
| leak.dom.hud | 0 | 0 | B1 = B0 | green |
| leak.dom.body | 0 | 0 | B1 = B0 | green |
| leak.sceneObjects | 0 | 0 | B1 = B0 | green |
| budgets.pier.draws | 1174 | 223 | ≤ 1174 | green |
| budgets.pier.tris | 18779873 | 1125728 | ≤ 18779873 | green |
| budgets.pier.programs | 148 | 95 | ≤ 148 | green |
| budgets.pier.gpuMB | 219.43689823150635 | 219.43689823150635 | ≤ 219.43689823150635 | green |
| budgets.beach.draws | 1174 | 217 | ≤ 1174 | green |
| budgets.beach.tris | 18779873 | 1065774 | ≤ 18779873 | green |
| budgets.beach.programs | 148 | 95 | ≤ 148 | green |
| budgets.beach.gpuMB | 219.43689823150635 | 219.43689823150635 | ≤ 219.43689823150635 | green |
| budgets.wreck.draws | 1174 | 167 | ≤ 1174 | green |
| budgets.wreck.tris | 18779873 | 936154 | ≤ 18779873 | green |
| budgets.wreck.programs | 148 | 95 | ≤ 148 | green |
| budgets.wreck.gpuMB | 219.43689823150635 | 219.43689823150635 | ≤ 219.43689823150635 | green |
| walk.sounds.event | {"gullCallAt":14,"gullCall":14,"voices:step-planks":51,"splash":1,"land":1,"wadeStep":22,"voices:step-water":3,"waterExit":1,"voices:step-wetSand":13,"voices:step-sand":7,"dodge":1,"audio.startSampleBed":1,"voices:ui-chime":2} | {"gullCallAt":14,"gullCall":14,"voices:step-planks":51,"splash":1,"land":1,"wadeStep":22,"voices:step-water":3,"waterExit":1,"voices:step-wetSand":13,"voices:step-sand":7,"dodge":1,"audio.startSampleBed":1,"voices:ui-chime":2} | exact multiset | green |
| combat.sounds.event | {"lunge":1,"voices:whoosh":3,"animal:crab_click":3,"voices:impact-shell":3,"hitMarker":3,"voices:vocal-crab":1,"kill":1,"voices:ui-chime":1} | {"lunge":1,"voices:whoosh":3,"animal:crab_click":3,"voices:impact-shell":3,"hitMarker":3,"voices:vocal-crab":1,"kill":1,"voices:ui-chime":1} | exact multiset | green |
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
| boot.scene.totals.mesh | 604 | 604 | exact | green |
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
| boot.hud | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"","shown":true},{"cls":"ws-boss-bar-frame","spot":"","shown":true},{"cls":"ws-boss-bar-lag","spot":"","shown":true},{"cls":"ws-boss-bar-name","spot":"","shown":true},{"cls":"ws-boss-bar-notches","spot":"","shown":true},{"cls":"ws-boss-bar-shimmer","spot":"","shown":true},{"cls":"ws-boss- | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"","shown":true},{"cls":"ws-boss-bar-frame","spot":"","shown":true},{"cls":"ws-boss-bar-lag","spot":"","shown":true},{"cls":"ws-boss-bar-name","spot":"","shown":true},{"cls":"ws-boss-bar-notches","spot":"","shown":true},{"cls":"ws-boss-bar-shimmer","spot":"","shown":true},{"cls":"ws-boss- | exact | green |
| boot.saves.read | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.far-reach","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","local:wildshard.save.v2.sunscar-dunes","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.far-reach","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","local:wildshard.save.v2.sunscar-dunes","session:wildshard.save.v2.session"] | exact | green |
| boot.saves.written | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | exact | green |
| poses.pier.name | "pier" | "pier" | exact | green |
| poses.pier.pos | [0.000011088525659508353,2.0050033503763554,-193.99999452402338] | [0.000011088525659508353,2.0050033503763554,-193.99999452402338] | ± [0,0,0] | green |
| poses.pier.calls | 223 | 223 | ± 0 | green |
| poses.pier.tris | 1125728 | 1125728 | ± 0 | green |
| poses.pier.ssim | 1 | 0.9949634534289595 | ≥ 0.989287858088075 | green |
| poses.beach.name | "beach" | "beach" | exact | green |
| poses.beach.pos | [-9.99866775789701,1.507045904773258,-150.00086653002296] | [-9.99866775789701,1.507045904773258,-150.00086653002296] | ± [0,0,0] | green |
| poses.beach.calls | 217 | 217 | ± 0 | green |
| poses.beach.tris | 1065774 | 1065774 | ± 0 | green |
| poses.beach.ssim | 1 | 0.9903726534137393 | ≥ 0.9862041273651673 | green |
| poses.wreck.name | "wreck" | "wreck" | exact | green |
| poses.wreck.pos | [105.00040426866872,3.6318565603614887,-0.017621197486732854] | [105.00040426866872,3.6318565603614887,-0.017621197486732854] | ± [0,0,0] | green |
| poses.wreck.calls | 167 | 167 | ± 0 | green |
| poses.wreck.tris | 936154 | 936154 | ± 0 | green |
| poses.wreck.ssim | 1 | 0.9998642616962223 | ≥ 0.9899498816047897 | green |
| walk.legs.pier.name | "pier" | "pier" | exact | green |
| walk.legs.pier.end.x | -19.773 | -19.773 | ± 0 | green |
| walk.legs.pier.end.y | 1.339 | 1.339 | ± 0 | green |
| walk.legs.pier.end.z | -150.548 | -150.548 | ± 0 | green |
| walk.legs.pier.maxY | 2.033 | 2.033 | ± 0 | green |
| walk.legs.lookout.name | "lookout" | "lookout" | exact | green |
| walk.legs.lookout.end.x | 93.842 | 93.842 | ± 0 | green |
| walk.legs.lookout.end.y | 41.174 | 41.174 | ± 0 | green |
| walk.legs.lookout.end.z | 93.766 | 93.766 | ± 0 | green |
| walk.legs.lookout.maxY | 41.177 | 41.177 | ± 0 | green |
| walk.legs.cave.name | "cave" | "cave" | exact | green |
| walk.legs.cave.end.x | 142.004 | 142.004 | ± 0 | green |
| walk.legs.cave.end.y | 1.22 | 1.22 | ± 0 | green |
| walk.legs.cave.end.z | 18.686 | 18.686 | ± 0 | green |
| walk.legs.cave.maxY | 1.369 | 1.369 | ± 0 | green |
| walk.sounds.ambient | ["gulls.call","island.bird","island.drip","island.swell"] | ["gulls.call","island.bird","island.drip","island.swell"] | no baseline scheduler missing | green |
| combat.shot | "n/a" | "n/a" | exact | green |
| combat.shot2 | "n/a" | "n/a" | exact | green |
| combat.hitsToKill.swing | 3 | 3 | ± 0 | green |
| combat.kills | ["crab"] | ["crab"] | exact | green |
| combat.loot.written | ["local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.global"] | ["local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.global"] | exact | green |
| combat.sounds.ambient | ["island.bird","island.drip","island.swell"] | ["island.bird","island.drip","island.swell"] | no baseline scheduler missing | green |

## driftwood-isle × desktop

Verdict: green

| Field | Baseline | Now | Band | Verdict |
|---|---|---|---|---|
| leak.disposalErrors | [] | [] | no disposal failures | green |
| boot.errors | [] | [] | [] | green |
| boot.renderer | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | "ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)" | ANGLE Metal | green |
| boot.scene.totals.batched | 2 | 2 | ≤ 2 (B15 ratchet) | green |
| walk.stuck | 0 | 0 | 0 | green |
| walk.legs.pier.stuck | [] | [] | [] | green |
| walk.legs.pier.out | 0 | 0 | 0 | green |
| walk.legs.lookout.stuck | [] | [] | [] | green |
| walk.legs.lookout.out | 0 | 0 | 0 | green |
| walk.legs.cave.stuck | [] | [] | [] | green |
| walk.legs.cave.out | 0 | 0 | 0 | green |
| combat.swing | {"weapon":"sword","target":"crab","hits":3,"hitWithinS":0.5693333333333044,"killed":true,"killWithinS":1.6759999999999167,"hitLimit":3,"killLimit":15} | {"weapon":"sword","target":"crab","hits":3,"hitWithinS":0.5693333333333044,"killed":true,"killWithinS":1.6759999999999167,"hitLimit":3,"killLimit":15} | hit and kill within limits | green |
| pauseResume | {"before":{"appState":"paused","clockNow":62.942666666665666,"player":{"pos":{"x":-6.079,"y":1.901,"z":-142.113},"yaw":0.7438702881235283,"pitch":-0.7261053781376493,"vel":{"x":0,"y":0,"z":0},"health":100},"weapon":{"id":"sword","state":{"magazine":30,"reserve":0,"loaded":true,"reloading":false,"reloadProgress":0,"ads":false},"ammo":null},"creatures":[{"id":"bear:11","kind":"bear","pos":{"x":65.957,"y":6.127,"z":-80.921},"hp":320,"brain":"idle"},{"id":"bear:12","kind":"bear","pos":{"x":-119.539,"y":3.625,"z":-98.997},"hp":220,"brain":"idle"},{"id":"boar:0","kind":"boar","pos":{"x":69.034,"y":2 | {"before":{"appState":"paused","clockNow":62.942666666665666,"player":{"pos":{"x":-6.079,"y":1.901,"z":-142.113},"yaw":0.7438702881235283,"pitch":-0.7261053781376493,"vel":{"x":0,"y":0,"z":0},"health":100},"weapon":{"id":"sword","state":{"magazine":30,"reserve":0,"loaded":true,"reloading":false,"reloadProgress":0,"ads":false},"ammo":null},"creatures":[{"id":"bear:11","kind":"bear","pos":{"x":65.957,"y":6.127,"z":-80.921},"hp":320,"brain":"idle"},{"id":"bear:12","kind":"bear","pos":{"x":-119.539,"y":3.625,"z":-98.997},"hp":220,"brain":"idle"},{"id":"boar:0","kind":"boar","pos":{"x":69.034,"y":2 | no state drift; resumed prior state | green |
| leak.geometries | 0 | 0 | B1 = B0 | green |
| leak.textures | 0 | 0 | B1 = B0 | green |
| leak.programs | 0 | 0 | B1 = B0 | green |
| leak.bodies | 0 | 0 | B1 = B0 | green |
| leak.colliders | 0 | 0 | B1 = B0 | green |
| leak.listeners.window | 0 | 0 | B1 = B0 | green |
| leak.listeners.document | 0 | 0 | B1 = B0 | green |
| leak.listeners.canvas | 0 | 0 | B1 = B0 | green |
| leak.listeners.other | 0 | 0 | B1 = B0 | green |
| leak.timers.timeouts | 0 | 0 | B1 = B0 | green |
| leak.timers.intervals | 0 | 0 | B1 = B0 | green |
| leak.timers.raf | 0 | 0 | B1 = B0 | green |
| leak.audio.activeVoices | 0 | 0 | B1 = B0 | green |
| leak.audio.beds | 0 | 0 | B1 = B0 | green |
| leak.audio.buses | 0 | 0 | B1 = B0 | green |
| leak.systems.input | 0 | 0 | B1 = B0 | green |
| leak.systems.fixed.pre | 0 | 0 | B1 = B0 | green |
| leak.systems.fixed.step | 0 | 0 | B1 = B0 | green |
| leak.systems.fixed.post | 0 | 0 | B1 = B0 | green |
| leak.systems.update | 0 | 0 | B1 = B0 | green |
| leak.systems.late | 0 | 0 | B1 = B0 | green |
| leak.systems.render | 0 | 0 | B1 = B0 | green |
| leak.events.listeners | 7 | 7 | B1 = B0 | green |
| leak.events.answerers | 5 | 5 | B1 = B0 | green |
| leak.dom.hud | 0 | 0 | B1 = B0 | green |
| leak.dom.body | 0 | 0 | B1 = B0 | green |
| leak.sceneObjects | 0 | 0 | B1 = B0 | green |
| budgets.pier.draws | 3262 | 945 | ≤ 3262 | green |
| budgets.pier.tris | 52174145 | 3295289 | ≤ 52174145 | green |
| budgets.pier.programs | 826 | 108 | ≤ 826 | green |
| budgets.pier.gpuMB | 583.5372714996338 | 583.5372714996338 | ≤ 583.5372714996338 | green |
| budgets.beach.draws | 3262 | 566 | ≤ 3262 | green |
| budgets.beach.tris | 52174145 | 2320154 | ≤ 52174145 | green |
| budgets.beach.programs | 826 | 108 | ≤ 826 | green |
| budgets.beach.gpuMB | 583.5372714996338 | 583.5372714996338 | ≤ 583.5372714996338 | green |
| budgets.wreck.draws | 3262 | 234 | ≤ 3262 | green |
| budgets.wreck.tris | 52174145 | 1456452 | ≤ 52174145 | green |
| budgets.wreck.programs | 826 | 108 | ≤ 826 | green |
| budgets.wreck.gpuMB | 583.5372714996338 | 583.5372714996338 | ≤ 583.5372714996338 | green |
| walk.sounds.event | {"gullCallAt":10,"gullCall":10,"voices:step-planks":43,"splash":1,"land":1,"wadeStep":22,"voices:step-water":3,"waterExit":1,"voices:step-wetSand":13,"voices:step-sand":7} | {"gullCallAt":10,"gullCall":10,"voices:step-planks":43,"splash":1,"land":1,"wadeStep":22,"voices:step-water":3,"waterExit":1,"voices:step-wetSand":13,"voices:step-sand":7} | exact multiset | green |
| combat.sounds.event | {"audio.startSampleBed":1,"lunge":1,"voices:whoosh":3,"animal:crab_click":3,"voices:impact-shell":3,"hitMarker":3,"voices:vocal-crab":1,"kill":1,"voices:ui-chime":1} | {"audio.startSampleBed":1,"lunge":1,"voices:whoosh":3,"animal:crab_click":3,"voices:impact-shell":3,"hitMarker":3,"voices:vocal-crab":1,"kill":1,"voices:ui-chime":1} | exact multiset | green |
| boot.schema | 1 | 1 | exact | green |
| boot.lane | "m5" | "m5" | exact | green |
| boot.shard | "driftwood-isle" | "driftwood-isle" | exact | green |
| boot.tier | "desktop" | "desktop" | exact | green |
| boot.viewport.w | 1600 | 1600 | exact | green |
| boot.viewport.h | 900 | 900 | exact | green |
| boot.viewport.dpr | 1 | 1 | exact | green |
| boot.viewport.touch | false | false | exact | green |
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
| boot.physics.colliders | 2348 | 2348 | exact | green |
| boot.scene.totals.mesh | 991 | 991 | exact | green |
| boot.scene.totals.instanced | 33 | 33 | exact | green |
| boot.scene.totals.instances | 254 | 254 | exact | green |
| boot.scene.totals.skinned | 37 | 37 | exact | green |
| boot.scene.totals.points | 7 | 7 | exact | green |
| boot.scene.totals.lines | 3 | 3 | exact | green |
| boot.scene.totals.sprites | 10 | 10 | exact | green |
| boot.scene.totals.lights | 17 | 17 | exact | green |
| boot.scene.named | [{"path":"animals","type":"Group","n":58},{"path":"animals/far-herd","type":"Group","n":0},{"path":"animals/herd-shadow","type":"Group","n":0},{"path":"blender-island","type":"Group","n":499},{"path":"blender-island/island-casters-0","type":"Mesh","n":0},{"path":"blender-island/island-casters-0-far","type":"Mesh","n":0},{"path":"blender-island/island-casters-2","type":"Mesh","n":0},{"path":"blender-island/island-casters-2-far","type":"Mesh","n":0},{"path":"blender-island/island-casters-3","type":"Mesh","n":53},{"path":"blender-island/island-casters-3-far","type":"Mesh","n":53},{"path":"blender | [{"path":"animals","type":"Group","n":58},{"path":"animals/far-herd","type":"Group","n":0},{"path":"animals/herd-shadow","type":"Group","n":0},{"path":"blender-island","type":"Group","n":499},{"path":"blender-island/island-casters-0","type":"Mesh","n":0},{"path":"blender-island/island-casters-0-far","type":"Mesh","n":0},{"path":"blender-island/island-casters-2","type":"Mesh","n":0},{"path":"blender-island/island-casters-2-far","type":"Mesh","n":0},{"path":"blender-island/island-casters-3","type":"Mesh","n":53},{"path":"blender-island/island-casters-3-far","type":"Mesh","n":53},{"path":"blender | exact | green |
| boot.render.programs | 108 | 108 | ± 0 | green |
| boot.render.programKeys | "6f52c638c765f2d893c0e293769158c5f3d3676d099f437208b0bf7e66daae55" | "6f52c638c765f2d893c0e293769158c5f3d3676d099f437208b0bf7e66daae55" | exact | green |
| boot.render.memory.geometries | 757 | 757 | ± 0 | green |
| boot.render.memory.textures | 115 | 115 | ± 0 | green |
| boot.gpuBytes.textures | 356187208 | 356187208 | ± 0 | green |
| boot.gpuBytes.renderbuffers | 7544064 | 7544064 | ± 0 | green |
| boot.gpuBytes.buffers | 248151906 | 248151906 | ± 0 | green |
| boot.gpuBytes.total | 611883178 | 611883178 | ± 0 | green |
| boot.audio.requests | ["/assets/music/folk/island-calm-d7d189f9.m4a","/assets/music/folk/island-tension-bb05ab64.m4a","/assets/music/folk/pine-calm-10905c79.m4a","/assets/music/folk/pine-tension-180bc197.m4a","/assets/music/folk/sting-chunk-31c10eaf.m4a","/assets/music/folk/sting-death-67f54fe8.m4a","/assets/music/folk/sting-pickup-332f81db.m4a","/assets/music/folk/title-50001128.m4a","/assets/music/orchestral/island-calm-27861d1b.m4a","/assets/music/orchestral/island-tension-73116f36.m4a","/assets/music/orchestral/pine-calm-fbc4a99e.m4a","/assets/music/orchestral/pine-tension-525d8c6d.m4a","/assets/music/orchestra | ["/assets/music/folk/island-calm-d7d189f9.m4a","/assets/music/folk/island-tension-bb05ab64.m4a","/assets/music/folk/pine-calm-10905c79.m4a","/assets/music/folk/pine-tension-180bc197.m4a","/assets/music/folk/sting-chunk-31c10eaf.m4a","/assets/music/folk/sting-death-67f54fe8.m4a","/assets/music/folk/sting-pickup-332f81db.m4a","/assets/music/folk/title-50001128.m4a","/assets/music/orchestral/island-calm-27861d1b.m4a","/assets/music/orchestral/island-tension-73116f36.m4a","/assets/music/orchestral/pine-calm-fbc4a99e.m4a","/assets/music/orchestral/pine-tension-525d8c6d.m4a","/assets/music/orchestra | exact | green |
| boot.audio.state.style | "piano" | "piano" | exact | green |
| boot.audio.state.set | "best" | "best" | exact | green |
| boot.audio.state.mood | "menu" | "menu" | exact | green |
| boot.audio.score | "score.driftwood" | "score.driftwood" | exact | green |
| boot.hud | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"","shown":true},{"cls":"ws-boss-bar-frame","spot":"","shown":true},{"cls":"ws-boss-bar-lag","spot":"","shown":true},{"cls":"ws-boss-bar-name","spot":"","shown":true},{"cls":"ws-boss-bar-notches","spot":"","shown":true},{"cls":"ws-boss-bar-shimmer","spot":"","shown":true},{"cls":"ws-boss- | [{"cls":"ws-bar","spot":"","shown":true},{"cls":"ws-boss","spot":"","shown":true},{"cls":"ws-boss-bar","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-cap","spot":"","shown":true},{"cls":"ws-boss-bar-caption","spot":"","shown":true},{"cls":"ws-boss-bar-fill","spot":"","shown":true},{"cls":"ws-boss-bar-frame","spot":"","shown":true},{"cls":"ws-boss-bar-lag","spot":"","shown":true},{"cls":"ws-boss-bar-name","spot":"","shown":true},{"cls":"ws-boss-bar-notches","spot":"","shown":true},{"cls":"ws-boss-bar-shimmer","spot":"","shown":true},{"cls":"ws-boss- | exact | green |
| boot.saves.read | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.far-reach","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","local:wildshard.save.v2.sunscar-dunes","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.far-reach","local:wildshard.save.v2.global","local:wildshard.save.v2.nalati-grasslands","local:wildshard.save.v2.nine-dragon-stack","local:wildshard.save.v2.pine-hollow","local:wildshard.save.v2.sunscar-dunes","session:wildshard.save.v2.session"] | exact | green |
| boot.saves.written | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | ["local:wildshard.save.v2.device","local:wildshard.save.v2.global","session:wildshard.save.v2.session"] | exact | green |
| poses.pier.name | "pier" | "pier" | exact | green |
| poses.pier.pos | [0.000011088525659508353,2.0050033503763554,-193.99999452402338] | [0.000011088525659508353,2.0050033503763554,-193.99999452402338] | ± [0,0,0] | green |
| poses.pier.calls | 945 | 945 | ± 0 | green |
| poses.pier.tris | 3295289 | 3295289 | ± 0 | green |
| poses.pier.ssim | 1 | 1 | ≥ 0.99 | green |
| poses.beach.name | "beach" | "beach" | exact | green |
| poses.beach.pos | [-9.99866775789701,1.507045904773258,-150.00086653002296] | [-9.99866775789701,1.507045904773258,-150.00086653002296] | ± [0,0,0] | green |
| poses.beach.calls | 566 | 566 | ± 0 | green |
| poses.beach.tris | 2320154 | 2320154 | ± 0 | green |
| poses.beach.ssim | 1 | 0.999999822087373 | ≥ 0.99 | green |
| poses.wreck.name | "wreck" | "wreck" | exact | green |
| poses.wreck.pos | [105.00040426866872,3.6318565603614887,-0.017621197486732854] | [105.00040426866872,3.6318565603614887,-0.017621197486732854] | ± [0,0,0] | green |
| poses.wreck.calls | 234 | 234 | ± 0 | green |
| poses.wreck.tris | 1456452 | 1456452 | ± 0 | green |
| poses.wreck.ssim | 1 | 0.999999003789584 | ≥ 0.99 | green |
| walk.legs.pier.name | "pier" | "pier" | exact | green |
| walk.legs.pier.end.x | -19.773 | -19.773 | ± 0 | green |
| walk.legs.pier.end.y | 1.339 | 1.339 | ± 0 | green |
| walk.legs.pier.end.z | -150.548 | -150.548 | ± 0 | green |
| walk.legs.pier.maxY | 2.033 | 2.033 | ± 0 | green |
| walk.legs.lookout.name | "lookout" | "lookout" | exact | green |
| walk.legs.lookout.end.x | 93.842 | 93.842 | ± 0 | green |
| walk.legs.lookout.end.y | 41.174 | 41.174 | ± 0 | green |
| walk.legs.lookout.end.z | 93.766 | 93.766 | ± 0 | green |
| walk.legs.lookout.maxY | 41.177 | 41.177 | ± 0 | green |
| walk.legs.cave.name | "cave" | "cave" | exact | green |
| walk.legs.cave.end.x | 142.004 | 142.004 | ± 0 | green |
| walk.legs.cave.end.y | 1.22 | 1.22 | ± 0 | green |
| walk.legs.cave.end.z | 18.686 | 18.686 | ± 0 | green |
| walk.legs.cave.maxY | 1.369 | 1.369 | ± 0 | green |
| walk.sounds.ambient | ["gulls.call","island.bird","island.drip","island.swell"] | ["gulls.call","island.bird","island.drip","island.swell"] | no baseline scheduler missing | green |
| combat.shot | "n/a" | "n/a" | exact | green |
| combat.shot2 | "n/a" | "n/a" | exact | green |
| combat.hitsToKill.swing | 3 | 3 | ± 0 | green |
| combat.kills | ["crab"] | ["crab"] | exact | green |
| combat.loot.written | ["local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.global"] | ["local:wildshard.save.v2.driftwood-isle","local:wildshard.save.v2.global"] | exact | green |
| combat.sounds.ambient | ["island.bird","island.drip"] | ["island.bird","island.drip"] | no baseline scheduler missing | green |

## Budget derivation driftwood-isle × phone

| Pose | Metric | Observed | Derived target | Enforced ceiling | Formula / inputs |
|---|---|---|---|---|---|
| pier | draws | 223 | 1174 | 1174 | floor((9.6 - 4 - 0.6) / (0.0004257812537252903 × 10)) |
| pier | tris | 1125728 | 18779873 | 18779873 | floor(16.04102564102564 × 0.5 / (4.2708022548417234e-8 × 10)) |
| pier | programs | 95 | 148 | 148 | floor(1000 / (0.6720833336313565 × 10)) |
| pier | gpuMB | 219.43689823150635 | "—" | 219.43689823150635 | GL bytes retain measured baseline ceiling; native footprint is a separate Simulator gate |

Inputs (pier): {"ceilings":{"phone":{"beach":{"gpuMB":219.43689823150635},"pier":{"gpuMB":219.43689823150635},"wreck":{"gpuMB":219.43689823150635}},"desktop":{"beach":{"gpuMB":583.5372714996338},"pier":{"gpuMB":583.5372714996338},"wreck":{"gpuMB":583.5372714996338}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":30,"fixedSeconds":5.5,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: budgets/calibration.json (scripts/calibrate.mjs)
Assumption: ASSUMPTION: hot iPhone costs equal measured M5 costs × 10; no phone calibration was run (decision 99)

| beach | draws | 217 | 1174 | 1174 | floor((9.6 - 4 - 0.6) / (0.0004257812537252903 × 10)) |
| beach | tris | 1065774 | 18779873 | 18779873 | floor(16.04102564102564 × 0.5 / (4.2708022548417234e-8 × 10)) |
| beach | programs | 95 | 148 | 148 | floor(1000 / (0.6720833336313565 × 10)) |
| beach | gpuMB | 219.43689823150635 | "—" | 219.43689823150635 | GL bytes retain measured baseline ceiling; native footprint is a separate Simulator gate |

Inputs (beach): {"ceilings":{"phone":{"beach":{"gpuMB":219.43689823150635},"pier":{"gpuMB":219.43689823150635},"wreck":{"gpuMB":219.43689823150635}},"desktop":{"beach":{"gpuMB":583.5372714996338},"pier":{"gpuMB":583.5372714996338},"wreck":{"gpuMB":583.5372714996338}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":30,"fixedSeconds":5.5,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: budgets/calibration.json (scripts/calibrate.mjs)
Assumption: ASSUMPTION: hot iPhone costs equal measured M5 costs × 10; no phone calibration was run (decision 99)

| wreck | draws | 167 | 1174 | 1174 | floor((9.6 - 4 - 0.6) / (0.0004257812537252903 × 10)) |
| wreck | tris | 936154 | 18779873 | 18779873 | floor(16.04102564102564 × 0.5 / (4.2708022548417234e-8 × 10)) |
| wreck | programs | 95 | 148 | 148 | floor(1000 / (0.6720833336313565 × 10)) |
| wreck | gpuMB | 219.43689823150635 | "—" | 219.43689823150635 | GL bytes retain measured baseline ceiling; native footprint is a separate Simulator gate |

Inputs (wreck): {"ceilings":{"phone":{"beach":{"gpuMB":219.43689823150635},"pier":{"gpuMB":219.43689823150635},"wreck":{"gpuMB":219.43689823150635}},"desktop":{"beach":{"gpuMB":583.5372714996338},"pier":{"gpuMB":583.5372714996338},"wreck":{"gpuMB":583.5372714996338}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":30,"fixedSeconds":5.5,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: budgets/calibration.json (scripts/calibrate.mjs)
Assumption: ASSUMPTION: hot iPhone costs equal measured M5 costs × 10; no phone calibration was run (decision 99)

## Budget derivation driftwood-isle × desktop

| Pose | Metric | Observed | Derived target | Enforced ceiling | Formula / inputs |
|---|---|---|---|---|---|
| pier | draws | 945 | 3262 | 3262 | floor((4.8 - 2 - 0.3) / (0.0004257812537252903 × 1.7997299005092244)) |
| pier | tris | 3295289 | 52174145 | 52174145 | floor(8.02051282051282 × 0.5 / (4.2708022548417234e-8 × 1.7997299005092244)) |
| pier | programs | 108 | 826 | 826 | floor(1000 / (0.6720833336313565 × 1.7997299005092244)) |
| pier | gpuMB | 583.5372714996338 | "—" | 583.5372714996338 | GL bytes retain measured baseline ceiling; native footprint is a separate Simulator gate |

Inputs (pier): {"ceilings":{"phone":{"beach":{"gpuMB":219.43689823150635},"pier":{"gpuMB":219.43689823150635},"wreck":{"gpuMB":219.43689823150635}},"desktop":{"beach":{"gpuMB":583.5372714996338},"pier":{"gpuMB":583.5372714996338},"wreck":{"gpuMB":583.5372714996338}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":30,"fixedSeconds":5.5,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: https://browser.geekbench.com/opencl-benchmarks
Assumption: Projected RTX 3060 / M5 Max throughput = OpenCL 80711 / 145258; replace with measured rtx3060 costs when available

| beach | draws | 566 | 3262 | 3262 | floor((4.8 - 2 - 0.3) / (0.0004257812537252903 × 1.7997299005092244)) |
| beach | tris | 2320154 | 52174145 | 52174145 | floor(8.02051282051282 × 0.5 / (4.2708022548417234e-8 × 1.7997299005092244)) |
| beach | programs | 108 | 826 | 826 | floor(1000 / (0.6720833336313565 × 1.7997299005092244)) |
| beach | gpuMB | 583.5372714996338 | "—" | 583.5372714996338 | GL bytes retain measured baseline ceiling; native footprint is a separate Simulator gate |

Inputs (beach): {"ceilings":{"phone":{"beach":{"gpuMB":219.43689823150635},"pier":{"gpuMB":219.43689823150635},"wreck":{"gpuMB":219.43689823150635}},"desktop":{"beach":{"gpuMB":583.5372714996338},"pier":{"gpuMB":583.5372714996338},"wreck":{"gpuMB":583.5372714996338}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":30,"fixedSeconds":5.5,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: https://browser.geekbench.com/opencl-benchmarks
Assumption: Projected RTX 3060 / M5 Max throughput = OpenCL 80711 / 145258; replace with measured rtx3060 costs when available

| wreck | draws | 234 | 3262 | 3262 | floor((4.8 - 2 - 0.3) / (0.0004257812537252903 × 1.7997299005092244)) |
| wreck | tris | 1456452 | 52174145 | 52174145 | floor(8.02051282051282 × 0.5 / (4.2708022548417234e-8 × 1.7997299005092244)) |
| wreck | programs | 108 | 826 | 826 | floor(1000 / (0.6720833336313565 × 1.7997299005092244)) |
| wreck | gpuMB | 583.5372714996338 | "—" | 583.5372714996338 | GL bytes retain measured baseline ceiling; native footprint is a separate Simulator gate |

Inputs (wreck): {"ceilings":{"phone":{"beach":{"gpuMB":219.43689823150635},"pier":{"gpuMB":219.43689823150635},"wreck":{"gpuMB":219.43689823150635}},"desktop":{"beach":{"gpuMB":583.5372714996338},"pier":{"gpuMB":583.5372714996338},"wreck":{"gpuMB":583.5372714996338}}},"phone":{"fps":30,"variability":1.3,"cpuMs":9.6,"gcMs":0.6,"systems":{"physics":0.8,"ai":0.8,"animation":1,"player":0.4,"world":0.5,"hud":0.3,"audio":0.2},"vertexShare":0.5,"lanes":{"opaque":0.3125,"foliage":0.1875,"shadow":0.15625,"transparent":0.09375,"viewmodel":0.0625,"post":0.125,"reserve":0.0625},"linkMs":1000},"desktop":{"fps":60,"variability":1.3,"cpuMs":4.8,"gcMs":0.3,"systems":{"physics":0.4,"ai":0.4,"animation":0.5,"player":0.2,"world":0.25,"hud":0.15,"audio":0.1},"vertexShare":0.5,"lanes":{"opaque":0.5,"post":0.5},"linkMs":1000},"load":{"coldPlay4G":30,"fixedSeconds":5.5,"cpuRatio":2,"bytesPerSecond":1125000}}
Source: https://browser.geekbench.com/opencl-benchmarks
Assumption: Projected RTX 3060 / M5 Max throughput = OpenCL 80711 / 145258; replace with measured rtx3060 costs when available
