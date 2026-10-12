# SF60 and SF74: recovery release receipt

Production independently serves **19809d3-mv4kjgy9**, built at
**2026-10-12 01:24:03.058 UTC**, from exact source
19809d3e78cf93d7cd36ed92f8b2b26b0cb3d68d.

- Push CI 38187419631 is green on that exact SHA.
- Exact boot/HOVER smoke 38187807591 published success at 00:36:01.
- Recovery release 38191453436, created 01:19:42, succeeded.
- The delayed scheduled release 38191732005, created 01:24:01,
  succeeded as an already-live no-op; verification/deploy was skipped.

The earlier automatic attempt 38187525864 failed at the 15-minute
selection deadline, 87 seconds before the newest exact proof completed.
It still consumed its shared hour. The recovery began only after the
slot explicitly returned free, newest readiness returned that exact
proven SHA, and an independent version check still saw the old build.
No unproven commit, extra dispatch or weaker proof supplied recovery.

Root dispatch repair **5f2d57a76** (culprit ce0fed049c, owner sp-x7)
preflights the newest candidate before automatic/backstop dispatch.
Pending proof leaves the hour free. Its 29 focused tests and strict/lint
checks pass; the full local gate passed in 518.76 seconds and pushed it.
Linux push CI 38191601577 is green. Exact boot/HOVER 38192101110
published success at 01:38:53. The updated automatic release job
114628662637 selected that SHA at 01:39:07, then refused another
dispatch because the scheduled run still occupied the shared hour.
This source is outside the live pin.
The delayed schedule counts in the shared slot too, so no further hand
dispatch is permitted before 02:24:01 or while any release is active.

This is one recovery, not a one-day within-one-hour production proof.
The 12-hour speed targets remain unmet. SF60's current daily card,
every-entry playtest, footage and feedback rows remain separate plan
work. No phone chore is assigned to Jake. The Linux Driftwood restore
field diagnosis also remains open: these green runs do not identify a
culprit for the earlier intermittent mismatch or prove a Node pin.
