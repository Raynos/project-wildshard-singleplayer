# E357 R5 — Pine and Driftwood phone sample-bed start

Root cause: X1 activation `fc043dfec376c58d94cde43275d7458a2cb0bfdf` replaced
TouchControls' USE synthetic `KeyE` with `app.input.press('use')`. The synthetic
keydown previously invoked the first-gesture callback before the interaction.
The direct action neither invokes that callback nor starts the mixer's sample bed.
The scoped audio migration is not the cause of this missing start.

Historical boundary and causal proof (m5, accelerated clock, phone):

| Export | Pine walk start count | Driftwood walk start count | Evidence |
|---|---:|---:|---|
| `46be3a46` | — | 1 | Earlier R5 opus capture; retained in its handoff |
| `478f6864` (before X1 consolidation) | 1 | — | `/private/tmp/e357-sol-r8/pre-x1` |
| `a811ace8` (activation parent) | no boot | — | `/private/tmp/e357-sol-r8/pre-fc`; pre-existing X1 recursive input predicate |
| `fc043dfe` | absent | absent | `/private/tmp/e357-sol-r8/before-causal` |
| `38c468ee` (fc + mouse guard experiment) | absent | absent | `/private/tmp/e357-sol-r8/causal`; rejected experiment |
| `f6f2b8ed` (fc + USE gesture bridge) | 1 | 1 | `/private/tmp/e357-sol-r8/use-gesture` |

The activation parent cannot be used as a good/bad runtime boundary because Pine
does not boot there. This is a source-boundary diagnosis plus a one-change causal
experiment, not a claim that an ordinary complete git bisection passed through
that broken commit. X1 consolidation prepares the TouchControls replacement;
fc043dfe activates the service and replaces the old gesture subscription.

Instrumented Pine trace (`trace-good` / `trace-bad` under the scratch directory):

- Good: MOVE, LOOK, DODGE, USE pointerdowns; USE dispatches `KeyE`; `audio.resume`
  sees `started=false`, then `startBed`, then `startSampleBed` for `forest`.
- Bad: the same four pointerdowns; no keydown or resume during the walk.

Minimal fix: `InputService.pressGesture(action)` invokes the existing first-gesture
callback, then the existing press path. Only TouchControls' USE bridge changes to
that method. No pointer listener is added, so MOVE and DODGE do not start audio
earlier. Audio synthesis, decoding, timer ownership, cue IDs/kinds, and RNG sources
are unchanged; unlock still precedes the interaction at the original USE tap.

The exact same narrow captures of fc and f6f2b8ed have empty `boot.errors` on both
shards. Their walk event maps differ only by `audio.startSampleBed: absent -> 1`;
combat event maps are identical and surviving event key order is identical in both
walk and combat. Neither run accepts/re-records a baseline or changes a pin.
The aggregate parity verdict remains red against pre-normalization baselines.
Gull counts belong to B78, not this fix.

Reproduce:

```sh
node scripts/parity.mjs --export=fc043dfec376c58d94cde43275d7458a2cb0bfdf --lane=m5 --shards=pine-hollow,driftwood-isle --tiers=phone --only=walk+combat+leak --retry=0 --out=/private/tmp/e357-sol-r8/before-causal
node scripts/parity.mjs --export=f6f2b8ed31815667186f776dae4dad015cbc00d1 --lane=m5 --shards=pine-hollow,driftwood-isle --tiers=phone --only=walk+combat+leak --retry=0 --out=/private/tmp/e357-sol-r8/use-gesture
```

The exact source diff and regression test were handed to sol-x1b, who owns
InputService and TouchControls. The test covers unlock before interaction, once,
no unlock from programmatic movement/dodge, and disposal of unused callbacks.
Its final integrated runtime must pass whole-tree oxlint, full vitest, and all
four phone boots before publication; that integration is tracked in E357's R5
handoff.
