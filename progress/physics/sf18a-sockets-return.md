# Regional socket return-trip check

Clean committed build: `72d82ee1c9759d7719a07a2c34ea443fba8a6c29`, build id `72d82ee-muu88jnd`.
Muted Chromium, iPhone 16 Pro portrait, phone tier, real fixed-step movement.

Command: `scripts/browser-lane.sh node scripts/physics-baseline.mjs --mode=grid --url=http://127.0.0.1:4472 --label=sf18a-sockets-return`.

**RED, default Driftwood hybrid row OFF.** At 15 m/s the route made all four expected frame transfers
(Driftwood → deck → template-4 → deck → Driftwood), with no admission issues or page errors. The final
return stuck at the Driftwood corner: x=-250.377284, z=-250.362864, y=-1.025757. The harness also detected
feet below its -0.25 m floor bound. It stopped before the 30 m/s run, as required on failure.
Full trace: [sf18a-sockets-return-72d82ee-muu88jnd.json](sf18a-sockets-return-72d82ee-muu88jnd.json).

The shore owner's separate OFF run in `d256709b8` reports the same corner/dike obstruction; its ON
run completed both speeds. This similarity is evidence for an existing OFF-path issue, not a passing
socket browser result. A same-build ON check is requested for attribution. No movement or seam
assertion was relaxed, and no shared motor behaviour changed.

The regional socket source (`17d6f6140`, retained by fix-forward `2ff91adb8`) separately passed 20/20
focused native tests. The real socket seam matrix retains both native resolutions (256/257), both
axes, 15/30 m/s, no falls/snags and the original 5 mm round-trip endpoint tolerance. The CI timeout-only
forward `4d618936c` passed the complete grid-simulation file with coverage, 13/13 in 12.78 s.

The test browser and owned preview were closed after the run. This receipt does not claim the live
return trip or the broader SF20a nothing-lost requirement complete.
