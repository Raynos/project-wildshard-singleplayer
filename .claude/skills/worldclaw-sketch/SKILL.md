---
name: worldclaw-sketch
description: OUTLINE (E359, not built; one of the three WorldClaw skills, D62). Build a shard's whole level fast in a deliberately super-stylized LOW-POLY sketch look, so Jake can steer the big picture (layout, routes, places, pacing, sightlines) in minutes per round instead of hours. Everything is code-built kit pieces and analytic terrain; no image-to-3D waits, no texture work. Use when Jake wants to try level ideas quickly. Not for final art (worldclaw-interactive / worldclaw-auto).
---

# WorldClaw, sketch: the big picture, fast (outline)

Jake (2026-10-01): "a super stylized low poly art style that is conducive to super fast real-time experimentation …
it has to look like a real game that can be played, but the faster we can get feedback on the big picture … the more
the steering and reviewing can happen faster and snappier." Nine Dragon's detail made every loop slow.

## First, every time: the start questions (06 §2)

The same P0 as worldclaw-interactive (follow-along, run scope). Recording is always on (R19); in the sketch flow
the time-lapse is cheap and telling: one frame per round shows the level converging.

## Where it sits now (06-shard-flow.md)

The sketch look and its kit are plan row **E8a**, and its builder is **T17**. worldclaw-interactive and worldclaw-auto already use them for the grey world
of the play gates (P8–P9). This skill is the same look run as a **standalone fast loop with Jake**: before any images
exist, or whenever the big picture (layout, routes, places, pacing) is in question.

## The idea

A round trip, from Jake's note to a playable portrait build, should take **minutes, not hours**. So the sketch flow
cuts every slow step:

| Slow step in the other flows | The sketch flow instead |
|---|---|
| Image-to-3D (~1 min per model + post + review) | a **sketch kit** of code models: parametric, flat-shaded, one shared palette material. Buildings from blocks + roofs + doors; trees from cones and blobs; rocks from low-poly hulls; bridges, stairs, walls, fences as code with exact colliders |
| A style pick and a LOOK-LOOP | **one fixed sketch look** shared by every sketch shard (seeded by the normalized manifest's `greybox` style, GAME-NORMALIZATION 01 §6): flat colour per region, a soft sun, ambient occlusion by vertex colour, outlines optional. Readable, cheap, never mistaken for final art |
| Codex compositions (~3 min each) | places laid out from the spec directly: the agent writes placements; no paint-then-lift |
| Long bakes | small grids where possible; the terrain bake and navmesh bake only when the layout settles |

**What stays:** `design.md` and `spec.json` (the twins), the layout map (schematic → regions), the Eq. 6 terrain,
routes and gates, the walk test, reach and sightlines, the grey content (P8), **and the model contract** (every kit piece is a
`defineModel`, every place a Set), so a sketch shard can be promoted piece by piece into worldclaw-interactive's final
look without re-laying it out.

## A round

1. Jake's note ("the lighthouse is too close to spawn", "make the ice wider").
2. The agent edits `spec.json` and the layout, and re-runs terrain + places.
3. Gates: walk test, reach, sightlines, budget (trivially under).
4. A portrait walk clip and a top-down map to Jake in one send (the map first, every image titled). Target: under ~10–15 minutes per round.

## Open questions (for the plan, later)

- The sketch kit's piece list (plan E8a fixes one look; whether Jake sees variants of it is open).
- Which harness makes a round fastest: a served build, rebuilt per round (~10 s), plus a capture script.
- Promotion rules: when a sketch pocket enters worldclaw-interactive, which kit pieces are replaced by final models.
- The fjord dry run's 3D blockout (T19) is close to a sketch round already: a sketch round can reuse it.
