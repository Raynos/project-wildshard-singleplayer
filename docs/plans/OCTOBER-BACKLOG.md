# Plan: OCTOBER-BACKLOG — the October backlog (E469)

**State:** `draft` 2026-10-10 — created at Jake's ask (E469): saga 1 (Fun) named, sagas 2 and 3 waiting on Jake; rows OB1 (low-poly player body) and OB2 (Debug third-person camera); unowned, nothing built.

## 0. Read this first

Jake, E469 (2026-10-10): *"New plan file called October backlog"*, then *"the character is floating arms and doesn't
have a body it needs a low poly body"* and *"add experimental debug third person camera view"*.

A home for October work that belongs to no other live plan. A row that fits a live plan goes there instead.

## 1. The sagas

Jake, 2026-10-10: *"I want to build three high level sagas for all the plans."* Each live plan and each backlog row
sits under one saga.

| Saga | Jake's words | Rows here |
|---|---|---|
| **1. Fun** | *"make the gameplay fun for the players of the mmo a shard should be fun. Controls should be fun. HUD should be fun"* | OB1, OB2 |
| **2.** | (Jake to name) | |
| **3.** | (Jake to name) | |

## Rows

| # | Row | What it is | Size | Ask |
|---|---|---|---|---|
| OB1 | **A low-poly player body** | The player is floating arms: the first-person viewmodels (weapons, `Hands.ts` swim gloves, Driftwood's castaway arm rig) hang off the camera, and the game has no body mesh (`src/game/cosmetics/cosmetics.ts`: worn cosmetics only cast a shadow where a body would be). Give the player a rigged low-poly body (torso, legs, feet, arms that line up with the viewmodel arms) that walks, runs, jumps, swims and rides on the player's state, casts the body shadow, and carries the Wardrobe's sockets. First person: legs and torso visible looking down, never clipping the camera. Per-shard style through the model contract (Driftwood toon, Nalati painterly, Pine Hollow PBR). A new look, so it lands behind Developer with the arms-only view kept as the Debug alternative until Jake picks. **Done when:** looking down on each shipping shard shows a body that animates with movement, its shadow matches, and the iPhone frame floor holds | M–L | E469 |
| OB2 | **Experimental Debug third-person camera** | One pause ▸ Settings ▸ Debug row, *Camera: first person / third person (experimental)*: a chase camera behind and above the player that collides with the world (physics queries, pulls in through walls) and shows OB1's body with the worn cosmetics in `visible` mode; touch controls and aim keep working; first person stays the default. Engine-wide registry row, no URL switch. **Done when:** the row toggles live on every shard without a reload, the camera never ends inside geometry on the physics walk spots, and first person is unchanged with the row off | M | E469 |
