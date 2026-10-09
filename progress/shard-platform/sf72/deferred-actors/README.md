# SF72 — deferred native actor lifecycle

The shared seam is implemented; Signal Dunes and Sky Reach still need their real runtime installers and passing
compatibility witnesses. This receipt does not mark either conversion or the SF72 row complete.

`SimHost.spawn(recipe)` copies a trusted deferred actor's data and owns its native motor / strike. `retire(id)` frees
those resources and cancels attacks targeting the retired identity; static level entities retain their old lifetime.
The existing adapter continuation seals the installed recipe. Missing actors, conflicting registrations and changed
recipes refuse exact restore. No snapshot wire version or static entity declaration changed.

The SDK installer receives `context.snapshot` only after strict native decoding. Its real keeper reinstalls the saved
roster before native restore and registers its clocks through `onStep`. It must not step or emit rewards during install.

Native witnesses checkpoint an actor in strike windup and a keeper in its deferred respawn wait. Restoring each
checkpoint preserves identities, seeds, birth ticks, native bytes, damage and every replay suffix tick. The same cases
run in the actual SDK worker without browser globals. Caller-scope disposal leaves the host's actor alive; retirement
returns native collider/body counts to baseline; static actors cannot be retired through this API. Missing rosters and
changed recipes are refused without mutating the original host. Existing recorded fights and the 10,000-tick static
route pass unchanged.

Validation: clean source candidate `f61e6b5a2098f69bc9aba50c1d4cc4a654b2500b`, parent
`5b2e86cf7a2ab065017b8b842e743793231906fc`; heavy-lane ticket531: **985 files / 5,507 tests PASS**, 106.15 s.
Full raw log is losslessly Brotli-compressed alongside this receipt. Strict TypeScript, root oxlint, ratchet and both
commit hooks pass. No new cross-layer import, graphical change, map input, browser or Simulator reading is involved.

Plan-State: unchanged
