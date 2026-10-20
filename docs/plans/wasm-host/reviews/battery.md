# WASM-HOST council: the scenario battery (only grows)

Walk each through docs/plans/WASM-HOST.md. A step the plan doesn't answer is a finding.

1. **Nine's Jian combo in pure AS.** A three-hit combo with ~100 ms input windows, hit-stop and a contact sweep: which
   lane, what rate, what the guest reads and writes per step, how the swing looks smooth at 60 fps on desktop.
2. **A moving platform the player rides** (a Sky/Signal-style mover) on v2: rate, contact, interpolation, save/load
   mid-ride, the same result on iPhone and desktop.
3. **An outside author uploads a shard** whose script has an infinite loop, writes NaN into a pose, floods commands,
   and tries to read another shard's memory.
4. **Nalati's weather storm**: the state machine (sim) plus per-frame light easing (view) at 30 fps on the phone in Low
   Power Mode, with the phone throttled 2×.
5. **A crowd of 40 animals with AS brains** at 10 Hz plus view-lane pose smoothing: the per-frame budget on the phone
   and what happens when it's over.
6. **Porting today's scripts**: all 2,791 lines of AS (Nalati 1,346, Pine 501, …), every v0 ScriptHost user and every ReturnProgram family move to v2 in
   one wave, with saves made before the wave loading after it.
7. **A desktop save loaded on the phone** mid-fight: does the fight continue identically (W6)?
8. **H0 on Jake's phone**: what exactly he taps, what it measures, where the numbers land, and how the plan changes
   if Wasm→JS turns out cheap on JavaScriptCore.
