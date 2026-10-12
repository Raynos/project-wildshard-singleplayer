# W12: native spots timeout recovery, cause unresolved

The 87a214b36 local gate failed row-data plus the actual Driftwood and
Pine native spots subprocesses. Both subprocess errors were ETIMEDOUT
at their existing 20-second deadlines. The earlier broad timeout batch
also failed on a prefix before 87fa0b8a4; it cannot all be attributed to
that entry-floor landing.

The deterministic row-data export failure was introduced by 87fa0b8a4
and repaired by owner sp-x6 in fc3eab08b. The decoder became private;
actual author-loader admission still refuses malformed payloads. No
producer, payload, hash, deadline or gate was weakened for the timeouts.

An independent clean committed fc3 export ran the standard generation
and native checkpoint preparation, then all three failing files with
six local workers. All nine tests passed in 6.08 seconds. Driftwood
spots took 3.442 seconds and Pine 3.327 seconds. The complete detached
proof took 23 seconds; its temporary export was deleted afterward.
A direct Pine native producer check also passed in 3.47 seconds. The
shared-root Driftwood attempt lacked its intentionally unmaterialized
entryFloors.generated.json; this was not a committed source failure.

The normal pusher regenerated fc3 as 81640d17c and passed every complete
gate step in 199.55 seconds, then pushed it to origin. Its related
Vitest phase took 69 seconds, with zero failed tests in the JSON
report. Driftwood and Pine spots passed in 2.310 and 3.203 seconds,
respectively, at unchanged deadlines. The real node bake checks, root
and layer strict checks, typed lint, x64 digests and WebKit smoke also
passed. This is observed recovery, not proof of a timeout culprit.
Keep the intermittent timeout cause open if it recurs under contention.

The earlier missing-approval admission was restored by restarting the
coordinator's unchanged, already authorized narrow sweeper after its
three-hour lease expired. Both exact entry-floor debt rows were filed
by their owner and were verified in the central receipt before retry.
No policy allowance or central receipt was hand-edited by this lane.
