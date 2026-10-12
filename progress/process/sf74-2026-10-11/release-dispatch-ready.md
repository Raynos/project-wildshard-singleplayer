# Defer an older smoke's release attempt

The automatic dispatcher in ce0fed049c reserved the hourly slot before
checking whether a newer CI-green commit was still proving. The selector
then correctly failed closed. The dispatch preflight now uses that same
exact-SHA reader without waiting; pending proof leaves the hour available.
Actual releases still reselect, wait at most 15 minutes and enforce every
proof. A new candidate arriving after preflight can still require that wait.

| UTC, 2026-10-12 | Evidence |
|---|---|
| 00:16:19 | ee237da77 push CI succeeded; its smoke was queued |
| 00:18:47–00:18:56 | Older 6258 release job 114612951856 succeeded |
| 00:18:51 | Its live check read 5fc3423-mv4g37dy, targeting 6258 |
| 00:18:52 | The shared hourly slot was free |
| 00:18:54 | Automatic deploy 38187525864 was created |
| 00:19:28 | Read the deploy pin started |
| During the wait | Newer 19809d3e7 became CI-green; reader waited for it |
| 00:34:34 | Exact-SHA proof unresolved; selection refused |
| 00:36:01 | 19809d3e7 exact smoke became successful, 87 seconds later |
| 00:47:07 | Backstop respected the occupied shared hour |

The [older smoke release job](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38186882734/job/114612951856)
binds DEPLOY_SHA 6258db19869f4471a0b02039d48794cb31eaca8e to the
successful dispatch. The [failed release](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38187525864)
logs the exact unresolved 19809d3e78cf93d7cd36ed92f8b2b26b0cb3d68d.
The [newest smoke](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38187807591)
subsequently supplied that commit's successful status.

The readiness preflight covers automatic smoke-triggered dispatch and the
launchd backstop. It does not provide a release pin, bypass a proof, change
the selector deadline or exempt a failed release from the shared hour.
Other configured pin modes keep their existing release-job proof checks.
API errors and malformed readiness output refuse dispatch. Pending proof
returns a deferred result, so it consumes neither a dispatch nor the hour.

After the explicit SF57 cleanup release, 29 tests in the real shell
backstop and selector suites pass in 9.54 seconds wall time. Root and
scripts strict typechecks, touched type-aware lint and Bash syntax pass.
The actual private-index pre-commit and commit-msg hooks also pass.
Regressions cover an older completion while newer proof is pending, the
initial status-publication gap, later exact success, terminal fallback,
API failures, malformed proof and an ambiguous successful HTTP dispatch.
