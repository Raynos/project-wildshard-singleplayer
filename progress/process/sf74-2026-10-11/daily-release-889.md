# SF60 and SF74: hourly release and exact proof receipt

Production serves **8891780f1-mv4mxtt3**, built at
**2026-10-12 02:31:10.494 UTC**, from exact source
8891780f198024937bdfc7e065c50e74e248a3d2. Release verification matched
that pin at 02:32:02.013 UTC; an independent version reading agrees.

- Exact push CI 38193988948 passed at 02:06:48 UTC.
- Exact boot/HOVER 38194514814 published success at 02:18:43 UTC.
- Hourly manual release 38195880335 started at 02:27:52 UTC and passed
  at 02:32:06 UTC. Its workflow head was 5d63aaa7e; its actual selected
  and verified DEPLOY_SHA was the full 8891780f1 SHA above.

Before dispatch the real release-slot command proved no release had
started in the last hour and none was active, release-ready proved the
newest CI-green candidate's exact smoke, and version.json still served
19809d3-mv4kjgy9. The delayed 01:24:01 schedule occupied the hour until
02:24:01; this dispatch followed that boundary. No duplicate dispatch,
unproven candidate or weaker proof supplied the release.

Exact commit creation was 01:52:50 UTC: creation to verified production
was 39 minutes 12 seconds; CI green to verification was 25 minutes
14 seconds, and exact smoke success to verification 13 minutes
19 seconds. This one pin satisfies an hour; it does not prove a full
day of all candidates shipping within an hour.

The live build includes dispatch-readiness repair 5f2d57a76. Later
81640d17c push CI 38196076328 also passed, and its exact boot smoke
38196544774 published success at 02:50:26. The shared hour prevents a
second manual dispatch before 03:27:52, even if a newer proof finishes.
A scheduled release or active run must be checked again then.

SF60's coordinator-owned daily card, every-entry playtest, milestone
footage and feedback rows remain separate plan work. The shipping proof
records automated title/gameplay/HOVER smoke; it does not substitute
for the daily every-entry playtest or the current card. No phone chore
is assigned to Jake. The intermittent Linux Driftwood restore diagnosis
remains open; a green run does not establish its earlier culprit.
