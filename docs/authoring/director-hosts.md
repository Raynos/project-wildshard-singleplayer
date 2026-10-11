# Director rows and their hosts (OS-G3)

A valid row declares an action, not authority to perform it. `Director.dataHostIssues()` explains whether the stock data-only host can execute the row before a product proof. `wildshard validate` still performs native binding admission.

| Host | Observations | Actions | AS handler |
|---|---|---|---|
| Stock data-only shard | Declared quest `flag:` and bounded `day:` from the look clock | `flag` on a declared quest flag | None; a non-null stage `script` refuses |
| Explicit trusted director host | Its native flag/actor/zone/event/day observations | Only actions its publish port resolves: spawn, despawn, flag, score, weather, toast, reward, emit | Optional typed admitted module installed by that owner |
| Scripted boss adapter | Its native eligibility/phase observations | The adapter's named zero-valued `emit` events | Its explicitly installed handler, if declared |

`emit` is a typed director output for an existing subscriber. It does **not** send an event to an arbitrary AssemblyScript module. Declaring an emit row, an AS hash or an event input does not create that subscriber. The data-only host refuses each unsupported action with its stage and action name. An undeclared quest flag also refuses.

The executed `beaconRequestExample` in `scripts/docs/authoring/directors.ts` uses day → declared request flag → quest completion → gameplay fact. The real host test observes the request on the next stage tick and the reactive quest completion in that same tick, exactly once. This is a quest-owned handoff. For a scripted quest, use its admitted state/interaction binding and typed ABI; a director emit is not an AS input. Stage conditions remain boolean, without author-side time arithmetic.

Native shard directors retain their explicit owner bindings and traces. This check does not admit new actions, install missing owners or close witness gaps.
