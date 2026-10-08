# Built-dist boot release gate (E435 SF62)

The first three completed macOS push jobs showed why this proof belongs outside the push-CI critical path:

| Main pin | GitHub run | Queue | Job run |
| --- | --- | ---: | ---: |
| `139182ea5` | [37753188619](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/37753188619) | 398 s | 270 s |
| `2dad83b7e` | [37754535040](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/37754535040) | 5 s | 284 s |
| `a0b91cf68` | [37754747455](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/37754747455) | 134 s | 328 s |

All three built dist and reached standalone Driftwood gameplay. The Developer grid reached home gameplay too,
but an outbound `/api/errors` POST received HTTP 404 from the static preview, so all three proofs correctly failed.
Those older artifacts did not preserve the original ErrorPayload. Its cause remains **unclassified**; it is not
acknowledged, suppressed, or treated as harmless telemetry. The updated smoke records the original POST body.

The separate `boot-smoke` workflow follows successful main push CI and records its outcome on the exact tested SHA.
Scheduled/manual releases require both proofs. An explicit emergency rollback also accepts a SHA proven previously
live by a verified production status or an exact full pin and matching version in a successful historical release job.
A pin-history entry alone never proves a release. The existing 60-second gameplay budget and ten-frame witness remain.

Local diagnostic on the machine-queue candidate: standalone 3.656 s, grid 15.708 s, zero faults, no ErrorPayloads,
and ten advancing gameplay frames each. This does not classify the CI-only report. Browser and preview closed.
