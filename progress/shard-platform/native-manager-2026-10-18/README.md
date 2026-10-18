# Native manager: Nalati and Driftwood

Status: continuation landed; admission/placement cut in progress, sp-x1,
2026-10-18. The prerequisite
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

## Step two boundary

Existing actors and dynamic admissions now join the same native intake as
Driftwood. The existing identity owner holds the allocator; the Nalati
adapter preserves its scalar `nextId` wire. Retirement rows keep the
original native/memory release order and retained herd references.

This is a prerequisite for the next whole headless owner deletion. Boot
and dynamic bodies now share `intake.byId`, `intake.identities` and actual
host attach/materialize/retire operations. The next phase/pack/bond owner
consumes these identities and event projection without migrating the actor
allocator again. This small boundary currently grows combined runtime code;
it does not close the headless or keeper row. Row NM2 remains open until
host test six passes and the combined runtime net turns negative.

The event-only admission guest owns free-spot retry acceptance, herd coat
and foal/stallion placement order, pack capacity and bond admission. It uses
the original placement stream, including rejected candidates and the
post-spawn foal offsets. `wildPlacement.ts` is removed; the existing page
and native adapters supply live terrain and body observations. The guest arrives
through the existing admitted boot blob, never a runtime build-source import.

What stays counted: headlessCreatures.ts still owns pack/bond continuation
and the Wildlife/ride/raid phase ordering, and the group/sheepdog/native
body callbacks. Their concrete service owners are not complete. Native
nearby decisions remain 20 Hz; G503 prevents replacing that cadence with
AS polling. Qyran keeps its existing wrapper: directly unwrapping it would
introduce callback crossings until its data-only owner is ready. Flock GPU
pose/shader presentation remains unchanged and counted.

The extended native intake scores **5/6** against HOST-BAR: two real
users (Nalati runtime/headlessCreatures.ts:176 and Driftwood sim/keeper.ts:185),
no shard branches, rows for differing recipe/floor/release behavior, native
server-safe bodies, and independent continued use by Driftwood. Test six
fails: homeKeeper.ts:214-220 accepts a structural hunt service, and
homeKeeper.ts:266-270 accepts hunt/pose ports; its refill and retarget
allocator callbacks at homeKeeper.ts:393 and homeKeeper.ts:422 also remain.
These are existing service calls, but the API does not enforce built-in
owners. The remaining NativeManager owner/phase
work must admit concrete built-in services and allocator data before
claiming 6/6; live queue row NM2, owner sp-x1, recheck when that owner
lands. No new callback port
or pending-user exception is introduced by this cut.

No look, gameplay, save version or checkpoint expectation changes. No new
platform pending-user tag. Source-only map input handoff is Nalati's new
admission generator, generators/output.ts, shard.config.ts script cost and
the admitted AS source; the canonical map lane owns its refresh after the
coordinator-ordered source landing. Script memory/wire declarations derive from both
programs; host caps and AS ceilings stay unchanged.

## Proof

For each landing: native boot and gameplay replay, exact actor ids and RNG
states, old-envelope continuation, focused tests, all 17 headless cases,
root/layer types, typed lint and all ten products. Measure source custom/AS
and platform deltas in the mirror. Give all six host-bar scores with source
line evidence. Check the landed build muted at iPhone 16 Pro size. Map inputs
are sent to sp-x10 by SHA for canonical source-only refresh. The first cut
touches the declared map input `models/creatures.ts`; no builder bakes maps.

Step-two prerequisite final proof: private tree `1f3a59b3c` on `433e9322f`
passed all ten products, root/layer types, typed lint and 24 focused tests
(including all 17 shard-headless cases). DW strict replay including
worker/victory and Pine replay exactly match their retained native
witnesses. Nalati codec/boot and taming continuation exactly match the
landed chapter `023c33833` witnesses; whole-shard coverage remains partial.
Ten actual ordered admission states (boot, pack, elite, bond,
bond/elite retirement, parked pack, next bond, Kokbori spawn/retirement)
match the exact `f50f5fe28` parent; digest
`61c155b84d0e587b447eb9985572764f54752eb4579304a0dad707ad2334f157`.

The measured prerequisite cut is Nalati 18,760 -> 18,738 custom lines,
AS 240 -> 283 (ceiling 2,837), platform +20, combined runtime +41.
Every other shard is unchanged; Pine/DW stay under 20 percent and
Sky/Signal stay at zero. The final composed proof
`20261018T141202-sp-x1-native-final19-60646` passed. Its full source ruler,
platform totals and replay receipts are retained under `.git/proofs/`
with the landed SHA. The exact landed phone check follows source landing
and is reported directly to the coordinator. The canonical map lane
owns the strict refreshed map proof for the nineteenth window.
