# Local simulation frames

`@wildshard/game/grid/live` defines `LiveGridHost` for an already-running page. The page lends its home physics and
logical checkpoint owner. The registry reserves that home's sim claim, its owned permanent highway, and each admitted
neighbour through the same allocator. Neighbours are owned, bodyless `SimHost`s. The home counts toward the four-shard
safety limit; the highway does not. Automatic prefetch selects the nearest available shard slots by distance and stable
instance id, so a wide cold-download bound cannot cause repeated eviction and reconstruction while stationary.

The live traveller port is a mutable motor bridge over the existing page player's position, health and trusted owner
object. `bindFrame` synchronously assigns the page's physics, calls `Player.bindFrame`, and changes its render origin.
It must be an infallible prepared assignment. `beforeFixed` requests neighbours and synchronizes the current world's
readiness walls before movement. The page advances physics and its player once; `afterPlayerStep` advances only the
active owned region's local clock and systems through `SimHost.stepExternal`. Its borrowed home callback is optional:
an existing home driver can instead be gated by its own `setActive` port, without a second callback registration.

`ready` means collider, sim and runtime-module admission. `gameplayReady` is a separate entered-hook fence: parsing a
trusted hybrid module may happen near the strip, but its world/kit/play hooks start only on actual cell entry. The page
holds gameplay input while those hooks install; regional systems remain frozen until the hook owner reports ready.
Inactive neighbours never step. `checkpoint` temporarily lends the traveller motor for owned-region snapshot encoding
and releases it even when saving fails. Failed durability prevents unload. Disposal returns the traveller to the borrowed
home before freeing owned worlds. `state` supplies crossing transitions, global feet, pending requests and admission
failures to the production grid readout. Native live/template and hybrid fixtures prove these contracts; the render
composition and real browser crossing remain separate acceptance work.

`@wildshard/game/grid/simulation` defines `GridSimulation`. A session supplies its highway host, an admitted whole-shard
loader, stable-instance snapshot storage and the one allocator's `reserve(instance, bytes)` adapter. `residentBytes`
reads the admitted sim budget before construction. A refused reservation defers admission through the crossing/readiness
fence. No loader reserves the sim a second time. Library, commons and render claims remain with their respective owners.

`prefetch` sorts and deduplicates instance ids, then initializes whole simulations sequentially. A neighbour keeps its
local physics world, authored colliders and creatures for projections, but detaches its player capsule and does not step.
The default safety count is four resident sims; the shared allocator remains the byte limit. `retain(instance, needed,
distance)` protects readiness-required residents and updates allocator eviction inputs. Active and prepared destinations
are also protected.

`current`, `target`, `prepare`, `ready` and `checkpoint` match SF20a's crossing port. Target selection is pure: enter a
cell's sim within 6 m outside its edge, leave after 10 m, both inside the 20 m strip. The crossing coordinator checkpoints
local wallets and the source host before committing. `prepare` admits the destination and builds disabled replacement
motors. The fixed-step commit refreshes the moving source pose and motor filters, transfers rider and optional mount
together and retires the source controllers. The mount's gameplay owner retains its identity, velocity and continuation;
its scoped SF20d passage suspends home confinement while ridden. Neither source pose nor motor changes on cancellation.

`step` advances only the current host. `beforeMove(instance, host)` synchronizes WORLD readiness walls before that tick's
capsule move; the extra `admitted(instance)` fence can read collider/sim/runtime completion from `TraversalReadiness`.
`worldFeet` derives global rendering coordinates from the current local pose. Global placement is never passed to an
authored sim or stored in its snapshot. Highway hosts are owned independently from the existing standalone client world;
the old borrowed-world snapshot rejection remains in force.

`checkpoint` captures the complete same-engine continuation. A frozen resident keeps its last active checkpoint.
`prepareUnload` performs the fallible durable save and locks that resident; `abort` retains it, while `commit` retires the
world and releases its allocator lease. Cleanup failures are exposed through `disposalIssues` for the session owner to
surface. A loader restores through `restoreSimHost` and `bindShardfileSim(..., { restoring: true })`; its platform collider
adapter must reinstall the current placement's shared meshes if placement or neighbour edge data changed.

`@wildshard/engine/sim/strips` is pure numeric data. `generateStrip` uses two 129-sample profiles in positive lateral
order, a 15 m deck and two 20 m easing strips. Both hysteresis boundaries are explicit vertices. `generateCrossroads`
joins four corner values to the same easing field. `generatePlatform` builds every corridor and crossroads plus the
explicit empty-neighbour perimeter. Its primary meshes belong to the highway world; its translated duplicates are
installed in adjacent local worlds through `@wildshard/engine/physics/stripColliders`. Rendering consumes these same
positions, indices and colours. Adjacent edge/corner samples must agree before generation; a failed seam never becomes
an invisible collider mismatch.

Collider metadata remains a `WeakMap` keyed by Rapier's canonical world-local collider wrappers. `Physics.dispose`
untags only that world. `clearTags` is a global test reset, never a shard unload operation. `regionalState` combines the
logical continuation and canonical authored collision/motion state. It excludes opaque Rapier allocation details,
traveller/profile state and platform seams/borders/readiness walls. Hashing this string gives placement-independent
authored state; full checkpoints still contain the complete physics continuation.

Verification: `test/grid-strips.test.ts`, `test/grid-simulation.test.ts` and the strict native
`test/fixtures/grid/run.mjs` cover deterministic meshes, exact seam colours/heights, equal handles across worlds,
placement-independent real-template state, frozen neighbours, door/creature restore, allocator leases, two-phase
eviction, rider/mount transfer and real 15/30 m/s capsule crossings in both directions. The EXPERIMENTAL Wildshard client
owner, crossroads portrait board and grid-mode browser physics baseline are subsequent integration proofs; these Node
checks do not claim those browser results.
