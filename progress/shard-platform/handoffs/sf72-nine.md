# Handoff (sf72-nine) — 2026-10-09, SF72 Nine Dragon Stack headless, parts 4–5

Coordinator `wildshard-new` pushes. Nine's canonical witness (`test/proof/nine-dragon-stack/`) passes on its trusted
renderer-free entry `runtime/headless.ts`: `compatible: true`, still declared **transitional**; `open` now lists only
"Jian contacts on real targets" (Nine has no creature). Identical output in two independent native processes.

## Landed (this commit: sf72-nine4's Fei Zhua split + sf72-nine5's finish)

- `grapple/sim.ts`: the Fei Zhua's law renderer-free (targeting by the view's projection, reach, sight past the Well's
  rail, landing test, fire → bite → lift → zip → vault → settle / miss → reel → dock, snapshot / restore).
  `grapple/FeiZhua.ts` drives it on the page (input, HUD, rope, markers, FX); `grapple/course.ts` gained the ports.
- `runtime/grapple.ts`: the headless grapple (LOCK and aim pitch as script commands, JUMP from the player command, the
  phone's portrait camera as the aim); the Well safety cap's baked colliders are off exactly while a lifting crossing
  flies. `runtime/headless.ts` installs it on the 31 baked hooks.
- `seePastWellRail` reads both owner shapes: the page tags colliders with the piece object, the host with the piece id
  string (snapshot-safe). Before this, the host could never see a hook past the rail. Unit test for both shapes:
  `test/shards/nine-dragon-stack/grapple-see-past.test.ts`.
- Physics bake records `hooks` (from the page's `nd.grapple` debug expose), rebaked on candidate `001589c30`; inputs
  unchanged since.
- Witness tape (1084 ticks): the walk + two rides, 21 Jian taps, a 40-tick HEAVY hold (22 swings), then 6 m south along
  the square's west balustrade, a running JUMP over it onto the Well's south rim, and the Fei Zhua's lifting crossing at
  the hook (−8.2, 121.37, −18.49): phases idle → fire → bite → lift → zip → vault → settle → idle, cap open 151 ticks,
  landed (−8.53, 119.09, −20.67). Replay checkpoint still tick 400 (mid-swing, mid-ride), suffix 684 ticks.
- `headless-runtime.test.ts`: east tower zip from the spawn with a mid-zip restore; Well crossing with a mid-crossing
  restore (cap open on the fresh host, closed on both after the settle).
- Ceilings approved by the coordinator: graph nine → engine 185 → 188; `lint/shard-coupling.json` Nine
  `context.debug` 1 → 2 (FeiZhua's `nd.grapple` expose, which the physics bake reads the hooks from).

## Next

1. If the hooks can be derived from the course data in Node (the world ctx's hook placement made renderer-free), bake
   them without the page and drop the `nd.grapple` debug expose (coupling back to 1).
2. `transitional`: nothing else renderer-bound decides an outcome in the fragment (crowd, movers, lights and FX are
   decorative); the plan's owner can drop it. Jian contacts on real targets stay open until Nine has a creature.

Plan-State: unchanged.
