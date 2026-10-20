# Independent native prototype source review

2026-10-20. Reviewed the frozen default-off source slice and its focused tests.
No implementation changes, app build, browser capture, gate changes, commit or
publication were performed by this reviewer. This review is not admission.

## P1: refused hit pose leaves committed damage without combat receipts

**Reproduced**, using the real `AnimalSim`, `NativeCreaturePose`,
`numericCreaturePose`, `Events` and `CombatPipeline`, with a two-joint diagnostic
rig. This is not a complete Conch animation or browser reproduction.

- `src/engine/entities/AnimalSim.ts:254-266` mutates HP, flinch and lethal state
  before invoking the newly added synchronous `publishAppliedHit`.
- `src/game/plugin/animation.ts:685-694` changes entry/ordinal/kind, then invokes
  the numeric evaluator before publishing. There is no failure transaction.
- `src/game/plugin/channels.ts:103` rejects an intermediate result over `1e12`.
- `src/engine/combat/pipeline.ts:157-160` queues damage and death receipts only
  after `applyDamage` returns successfully.
- `src/game/practice/PracticeCreature.ts:237-244` depends on those receipts for
  damage presentation, death presentation and loot.

An admitted DAG can pass initial evaluation yet fail only on an applied hit.
The exact input below computes `transition.kind * 1e12`. Its initial kind is 0,
but a lethal hit supplies kind 2. Both the constant and DAG are admitted; the
result is refused during lethal damage application.

Observed result after catching the thrown hit and flushing update events:

```json
{"error":"Non-finite or excessive client expression","alive":false,"hp":0,"receipts":0,"deaths":0,"ordinal":1,"headX":0}
```

The head retains its living publication while the actor is dead. Retrying a hit
does not repair the missing receipt: `CombatPipeline.hit` rejects dead targets
at line 143. Existing tests cover successful hit/death publications, not an
admitted program that fails at the transition boundary.

The numeric evaluator's refusal behavior predates this slice. The regression
is inserting that potentially throwing evaluation into `applyFinalDamage`
after damage mutation and before receipt creation.

### Smallest coherent boundary

Prepare the prospective hit/death observation and evaluate a complete candidate
pose/history in detached scratch state before committing actor HP/death,
transition history and publication. Only after preparation succeeds should
those owners commit and combat receipts be queued. A refused candidate must
leave the actor, pose, ordinal and receipt queue unchanged. This needs no
whole-arena save/restore authority.

Do not merely catch and ignore the evaluator error after HP mutation: that
would retain the living-pose/dead-actor mismatch. Testing only a few sample
states at admission is also insufficient for expressions depending on elapsed
time, entry values or motion. Add nonlethal and lethal refusal tests, followed
by a valid hit, to prove no lost or duplicate event and no consumed ordinal.

### Exact lightweight reproduction

Run from the repository root with its installed dependencies. This uses Vite's
in-memory module loader in middleware mode, with dependency discovery disabled;
it does not listen on a game port or build the app. No test/source file is
written.

```js
// node --input-type=module, supplying this script on stdin
import { createServer } from 'vite';
const s = await createServer({
  configFile: false, server: { middlewareMode: true, watch: null },
  appType: 'custom', optimizeDeps: { noDiscovery: true },
  ssr: { noExternal: [/^@wildshard\//], optimizeDeps: { noDiscovery: true } },
});
try {
  const [
    { AnimalSim }, { NativeCreaturePose }, { numericCreaturePose },
    { CombatPipeline }, { Events }, { Scope }, { Vector3 },
  ] = await Promise.all([
    '/src/engine/entities/AnimalSim.ts',
    '/src/game/plugin/animation.ts',
    '/src/game/plugin/channelPrograms.ts',
    '/src/engine/combat/pipeline.ts',
    '/src/engine/events/events.ts',
    '/src/engine/app/scope.ts',
  ].map(path => s.ssrLoadModule(path)).concat(import('three')));
  const actor = new AnimalSim({
    kind: 'proof', label: 'proof', variant: 'base', rarity: 0,
    hp: 100, aggressive: false,
    dims: { bodyRadius: 1, bodyHalfLen: 1, bodyY: 1, headRadius: 1 },
    mods: { damageTaken: 1 },
  }, 1, 1, 'proof', { now: () => 0, heightAt: () => 0, random: () => 0.5 });
  const animate = numericCreaturePose({
    practiceTransition: { owner: 'isolated-practice', joints: ['body', 'head'] },
    group: 'proof',
    programs: [{
      id: 'proof.failure', reads: ['kind'],
      nodes: [
        { op: 'read', index: 0 }, { op: 'constant', value: 1e12 },
        { op: 'mul', a: 0, b: 1 },
      ],
      channels: [{ property: 'x', value: 2 }],
      numeric: {
        group: 'proof',
        inputs: [{ input: 'kind', owner: 'transition', path: ['kind'] }],
        outputs: [{ property: 'x', target: 'joint.head', path: ['position', 'x'] }],
        restoreOnly: [],
      },
    }],
  });
  const pose = new NativeCreaturePose(actor, {
    practice: true, custom: true,
    joints: [
      { name: 'body', parent: -1, position: [0, 0, 0], order: 'XYZ', scale: [1, 1, 1] },
      { name: 'head', parent: 0, position: [0, 1, 0], order: 'XYZ', scale: [1, 1, 1] },
    ],
  }, animate);
  actor.bindVolumes(pose);
  pose.initializePractice();
  const scope = new Scope('proof'), events = new Events();
  const combat = new CombatPipeline(events, scope);
  let receipts = 0, deaths = 0, error;
  events.on('damage.dealt', () => receipts++, scope);
  events.on('actor.died', () => deaths++, scope);
  try {
    combat.hit({
      source: 'env', sourceTags: ['dmg.melee'], target: actor.combatActor(),
      amount: 10000, point: new Vector3(), dir: new Vector3(1, 0, 0),
    });
  } catch (failure) { error = failure.message; }
  events.flush('update');
  console.log(JSON.stringify({
    error, alive: actor.alive, hp: actor.hp, receipts, deaths,
    ordinal: pose.context.transition.ordinal, headX: pose.bones.head.position.x,
  }));
  scope.dispose();
} finally { await s.close(); }
```

## Admission gaps, not additional reproduced defects

The focused fixture constructs the owner and view directly and manually invokes
physics/native/player ticks (`test/practice-native-fixture.ts:99-112`). It does
not exercise `PracticeCreature.enterNative`, the actual demo scheduler, target
routing, loot, defeat and retry together. In particular,
`startPracticeDemo.ts:130-135` adds real scheduler slots whose end-to-end ordering
is not established by the read-cadence test. The prototype report accurately
disclaims browser integration; keep that distinction in any acceptance claim.

Whole-bout historical continuation is explicitly deferred and is not certified
by the pose-envelope round trip. This is a declared scope boundary, not a new
finding of a broken promised save API. Complete animation/contact acceptance
and phone performance likewise remain unestablished.

## Verdict

Preserve as default-off source-stage work, with the P1 recorded as open.
Do not promote to an admitted native practice composition until the synchronous
hit failure boundary is coherent and the integrated bout path has its own
evidence. No other concrete correctness defect was established in this pass.
