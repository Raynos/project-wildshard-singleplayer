# Native practice: integrated lifecycle source proof

2026-10-20. This follows the bounded next test requested by
[REPAIR-REVIEW.md](REPAIR-REVIEW.md). The prototype remains opt-in and default
off. This slice adds tests, not production wiring, admission, geometry or clips.

## Executed composition

`test/practice-demo-native.test.ts` calls the real `startPracticeDemo` with one
explicit native selection in the verified Conch fixture product. It executes
the real Game constructor and frame loop, TrainingArena, PracticeCreature
create/enter/update/exit/retry, Physics, Player, EquipmentService, Sword,
local CombatPipeline/Events, admitted decision guest, native actor/motor/pose,
query hitboxes, PracticePlayer and PracticeLoot.

The retained canonical15 packed creature rig and the real product species,
decision, strikes, old view pose and loot table are loaded. The extra native
pose remains the existing test-only transition witness, not an accepted Conch
animation. An additional admitted numeric row, `transition.kind * 1e12`,
refuses the lethal observation without changing the production product.

The headless boundary is explicit:

- `practice-demo-headless.ts` replaces GPU context acquisition, renderer output,
  KTX GPU setup, sky drawing and composer output. It does not replace Game's
  scheduler or its fault isolation.
- Browser-frame delivery and the page Clock delta are controlled. Real browser
  frames continue to be delivered while asynchronous admitted-memory preparation
  awaits paint. Native clocks, physics and decisions are not simulated by the
  fixture.
- The held viewmodel is a small declared test rig. Sword uses the real starter
  profile, move timing, sweep, arena raycasts, cover checks and combat route.
  This tests actual weapon integration, not canonical held-arm geometry or
  visual contact acceptance.
- Observation spies call the original gameplay methods. There are no module
  mocks, production test callbacks, new exemptions or alternate damage laws.
  Node's streaming WASM compiler receives the same bytes through ordinary
  instantiation because happy-dom's Response has a different realm identity.

## Five executable scenarios

1. **Actual scheduler order.** A zero-fixed frame runs arena publication,
   weapon update, then final native publication. A normal frame runs one
   physics step, one Player step and one native step before those update slots.
   A catch-up frame runs the same fixed sequence twice, not another physics or
   player clock inside the native owner. The zero-fixed frame leaves the
   actor/control/RNG/event/pose diagnostic continuation identical.
2. **Real late weapon damage and lifecycle.** A Sword sweep hits through the
   real arena queries on a frame with zero fixed ticks. Applied hit publication
   consumes ordinal 1 immediately, without pose advance, clock advance or early
   event delivery. A later lethal swing publishes the dead endpoint and ordinal
   2, then delivers exactly two damage receipts and one death. The authored
   three coins collect once into the local receipt; later publication and
   frames do not duplicate them. Retry rebuilds a fresh bout, and actual
   reselection calls create again. Both reset pose/control/history/health/loot.
3. **Refusal reaches the real caller.** The deliberate lethal overflow travels
   from Sword through the global exact-target route and local CombatPipeline.
   At the routed call boundary, the actor, pose, published FK, native/control
   diagnostic and queued events are identical before/after refusal. The
   exception is rethrown to Game, which reports `demo.weapon` with verdict
   `retry`. The loop stays alive and equipment stays enabled. A subsequent
   valid swing succeeds through the same path, consuming ordinal 1 and one
   receipt. Existing authored guard damage is preserved rather than exempted.
4. **Actual enemy decisions defeat the local player.** The admitted guest and
   real strike runner damage the local PlayerHealth, retain its incoming cap,
   reach zero, carry/disable the player and make bout targets unavailable.
   Further frames do not repeat damage/death. Retry disposes that bout and
   restores full local health, enabled equipment and an empty transition history.
5. **Default-off composition.** Omitting the selection boots the existing real
   PracticeCreature owner and original product view pose. Native fixed and
   NativeCreaturePose advance are never called.

Disposal checks capture the actual motor and query-body owners. They observe
collider removal at the disposal boundary, before Rapier can reuse numeric
slots for a new bout; require the old exact combat route and target to be gone;
require the old view to be hidden/detached; and require zero old scope census
and local event listeners/answerers. Calling the retired native fixed method
cannot advance its actor, and its diagnostic snapshot rejects retirement.

Every scenario also retains an unrelated actual AnimalSim, world PlayerHealth
at 37 HP, world combat-event listeners and a storage sentinel. They stay
unchanged, no localStorage write occurs, and the actual demo save environment
remains nonpersistent with null shard storage. This is isolation evidence, not
installation or acceptance of persistent world quest/reward systems.

## Reproduction and gates

The focused integration file passes **5/5**. The combined regression passes
**10 files / 47 tests** in 35.89 seconds: the new five scenarios plus all 42
prior focused tests. Strict focused TypeScript and type-aware oxlint pass on
the exact frozen source. `git diff --check` is clean for the changed paths.

The combined command uses installed binaries, without an app build:

```sh
node_modules/.bin/vitest run \
  test/practice-demo-native.test.ts \
  test/practice-native-actor.test.ts \
  test/native-creature-pose.test.ts \
  test/creature-numeric-clips.test.ts \
  test/practice-pose-ownership-boundary.test.ts \
  test/practice-pose-event-boundary.test.ts \
  test/practice-combat-route.test.ts \
  test/practice-player-loot.test.ts \
  test/practice-demo-entry.test.ts \
  test/practice-root-flinch.test.ts
```

Type-aware oxlint selects the three changed test/helper files. Focused
TypeScript uses the repository's strict configuration with those entrypoints,
`src/**/*.d.ts` and `src/engine/boot/shardPrefetch.ts`; its temporary config is
not a deliverable.

## Limits unchanged

This closes the bounded **headless composition/lifecycle** gap, not the browser
or public-admission gate. No app build, browser rendering, portrait phone
capture, phone performance result, complete-animation/contact judgment,
runtime pin or public selection change is included.

Fresh Retry, actual reselection and fresh test-page construction are **resets**,
not restoration of a historical mid-bout checkpoint. The embedded-world
snapshot guard is intact; no actor/control/motor/events/player/loot rewind
authority is added. The tested single numeric fault uses the existing retry
policy. It does not promise recovery after repeated faults have disabled a
system under the engine's existing fault policy.
