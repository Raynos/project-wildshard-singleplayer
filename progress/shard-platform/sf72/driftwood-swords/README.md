# SF72 Driftwood swords on the real tick inputs

The trusted runtime now reads the last player command's light press and held heavy. It drives the browser's
SweptMeleeCore: charge/release, combo timing, heavy damage, stagger and exact continuation. A named target supplies
the crosshair target without lock-on; the browser's cone, height, body-radius and range checks feed sweptLunge and
the real host.dashTo. The existing player.dodge event wakes aggressive/sensing native enemies once per accepted
press, including paused enemies; the captain remains on his self-thinking policy.

No engine/page code, map inputs or graph edges change. Remaining differences are explicit: camera-space blade
sweep targeting is represented by the named target, no lock-on, no contact hit-stop/clang presentation, player
push-out absent, native contact phase one tick later, and the ocean presentation clock is not the page's.

Proof: all 24 headless-runtime cases pass with coverage (113.57 s total). New cases: held heavy gives the exact
24-damage wood blow after one mid-charge restore (1.106 s), a 3.8 m lunge gives one 12-damage blow and exact dash
suffix (1.074 s), cone refusal plus real paused-enemy dodge wake (0.054 s), and last-command/unaimed-heavy fences
(0.118 s). The unchanged combo gives 12/12/16. All cases remain below one third of their deadlines under coverage.
Full clean ticket1039: 1,060 files /5,866 passed/14 skipped in117.93s. Root strict, all touched typed lint, coupling and ratchet pass. The first full run caught a fixture treating the per-frame brain marker as cumulative; the corrected assertion proves one accepted dodge event and return to the paused marker, then the full suite passes. Private hooks checked at landing.

Next: the canonical loaded-input-hashed gameplay/checkpoint, captain replay and gameplay ledger witness.
