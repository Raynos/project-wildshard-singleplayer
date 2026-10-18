# Native manager: Nalati and Driftwood

Status: first continuation/flock cut, sp-x1, 2026-10-18. The prerequisite
taming fixture repair landed in `8efba3196`.

## Ownership

Extend the existing native creature intake and actor owner. The first cut
owns hunting clock, noise, sight and memory/herd continuation; ordered ids
resolve against the actual host. Recipe admission, floor sampling,
retirement and contact remain with the existing intake and adapters until
their complete data-driven owners are ready. Inputs are rows and concrete
built-in services; it accepts no shard callback, resolver or reflected member
path. Authored decisions use AS programs through the existing return/spawn
owners. A service id must resolve to a built-in owner, never a shard function.

Nalati and Driftwood adopt each shared operation in the same landing. Pine's
existing population v3 remains a compatibility case, not a claimed new user.
There are no new pending-user tags. Driftwood does not currently use the rain
shelter: that feature remains Pine's until another shard really adopts it.

## Continuations and order

Keep Nalati's current creature envelope and separate taming v1, Pine v3 and
Driftwood v8 byte-for-byte behind their adapters. Do not add a save version
to simplify the host. Preserve adapter insertion order and the native actor
recipe adapters, including actors allocated after their manager installed.

Nalati's order is wildlife observation, flock movement, marmot alarm,
stampede effects, taming, raid, then manager thinking. A body's own act runs
before its native motion; charge contact runs after that body, before the
next one. Dynamic raid packs, elite packs and bonded horses share the original
allocator and creature stream. Reinstall sorts their recipes by allocation
identity, restores their group order independently, and retains dead corpses,
dormant raiders and hidden-but-living tamed stallions as distinct states.

Driftwood preserves fauna adoption checkpoints, 34 initial slots, the reserved
captain position, and append-only ecology returns. Practice replacement keeps
its slot but takes a new identity and herd. The manager's tick remains coconut
post, hunt clock, perception/decisions, coconut contact, coconut pre, ecology,
then practice return. Per-body order remains act, motion, pose/root transition,
charge contact and body clear. Coconut bodies reconnect by native handle.

## Whole-module landings

1. Admit the shared manager's actual rows with both native users. Remove a
   complete migrated runtime module in the same commit as its data path;
   do not move old TS wholesale into a different runtime file.
2. Move unique allocation/return policy into AS/data and remove the Nalati
   creature adapter and Driftwood keeper only when their complete reachable
   behavior has owners. Keep small save-boundary adapters explicit.
3. Evaluate flock/body presentation separately. Per-frame root integration,
   rig transforms and shader presentation remain counted where a shared
   exact host does not fit. No gameplay or appearance cuts.

The first landing removes `runtime/flockSchema.ts`: authored flock rows use
the identical public SDK parser. The unused local flock AI is deleted after
the Explorer specimen adopts the same declared policy as the page. The
redundant type-only elite alias is removed too. What stays: headless creature
allocation, pack/bond ownership and native phase bindings, since their
ordered policies still need AS/data owners; flock GPU pose/shader work,
since it is per-frame presentation. Neither keeper row is closed yet.

## Proof

For each landing: native boot and gameplay replay, exact actor ids and RNG
states, old-envelope continuation, focused tests, all 17 headless cases,
root/layer types, typed lint and all ten products. Measure source custom/AS
and platform deltas in the mirror. Give all six host-bar scores with source
line evidence. Check the landed build muted at iPhone 16 Pro size. Map inputs
are sent to sp-x10 by SHA for canonical source-only refresh. The first cut
touches the declared map input `models/creatures.ts`; no builder bakes maps.
