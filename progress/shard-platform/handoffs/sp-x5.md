## Handoff (sp-x5)

SF54 active, non-graphical only. Landed router 1c83de900, bag a04ac6e7b,
effects binding e2b5f4cb5; JSON layer fix acc27dcd6 and bound-world docs 254b19fe9.
Audio slice: weapon voices and three unchanged recipe modules move into game
systems with SDK runtime facades; silent-score lifetime moves separately.
Far / Nalati / Pine / Sun imports only; no look, map input or sound parameter change.
Clean-export recipe / RNG / lifetime and full-suite proof reported to coordinator.

Effects-data candidate remains separate and unlanded in sf54/effect-data.patch;
rebuild from current HEAD before landing. Forest profile / wind remain kit pending
commons build data. Species data follows. lookApi and species-install remain live;
Opus owns rendering, weapon subclasses, models, viewmodel and HUD.
No browser / Simulator / preview owned. SF45 coverage / ABI is closed, full run
434: 948 files, 5419 tests pass, 14 skipped. Coordinator owns pushes and plans.
