# Nine Dragon partial-fragment safety audit

**Scope:** Lantern Square, its north street, the east stair, the south Well rim, and the crossing bridges in the P0 prototype. This audit describes what the current game actually collides with; it does not certify the planned full nine-stratum shard.

## Current containment

| Route out of the fragment | Current physical or recovery rule | Evidence |
| --- | --- | --- |
| Walk or jump off the square, street, or stair | Solid tower-front blocks and end walls; the square and stair have solid Rapier floors | `world/colliders.ts`; `scripts/physics-route.json` edge legs |
| Jump or hoverboard over the square and Well rim | Stone balustrade plus a 12 m Rapier cap, including a separately registered kinematic cap that opens only for a committed Fei Zhua pull | `world/colliders.ts`, `world/well.ts`, `index.ts`; jump, double-jump and hover edge legs |
| Fall between Well crossings or escape a wall | `ChunkDef.bounds` returns the player to the last registered safe floor, or the square spawn, below y = 25 or outside x = −36…90 / z = −130…28 | `def.ts`, `src/main.ts`; `net-well-fall` leg |

The latest committed 19-leg phone-tier physics run, `progress/physics/nd-f2-bdc1cab8-muimhsvg.json`, recorded zero stuck legs and zero boundary escapes. Its mid-Well fall reached y = 26.32 and returned to the rim at y = 125 on the next frame, 2.13 seconds after the leg began. That proves recovery for the tested fall; it is not a phone-browser crash or every possible traversal route test.

## Deliberate prototype limit and collision gap

The galleries, their little stair flights, and the decorative sagging nets are **drawn** but have no Rapier deck or net colliders. The physically walkable subset is the square, north street, east stair, south rim, and registered crossing bridges. A player walking from a bridge onto a visible gallery can fall through it and will be returned by the bound. Grapple landing selection uses the shared physics query, so it only targets registered floors. The name `net-well-fall` in the test is historical: the net does not catch the player.

This is safe from an unbounded fall, but it is not yet a finished traversal experience. Before opening the rest of the Well for play, register colliders beside each reachable gallery deck and stair, make the nets real catch surfaces with the planned bounce/landing behavior, add walk/fall legs for their connections, then re-run the phone draw/memory and physics budgets. The temporary walls and soft return can stay until the full shard's intended fences, nets, and fall rules replace them.
