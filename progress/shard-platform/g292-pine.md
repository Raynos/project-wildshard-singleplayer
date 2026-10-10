# G292 Pine producer rollout

All 13 Pine entry points are declared: 33 outputs remain committed. This is report-only; deletion waits for the
coordinator’s gate and Linux CI evidence. Darwin arm64 cold/warm/forced cache output hashes match exactly for every job.

Node runs copy each declared source closure into an immutable temporary tree and verify its input hashes before
generation. Browser captures use the immutable preview export at `1090df8a2b5b6b65b251922068c5d9fdd9ea66b9`; its build
and Chromium binary are fenced. No original output is overwritten.

| Producer | Outputs | Cold ms | Warm ms | Forced ms | Cache key |
| --- | ---: | ---: | ---: | ---: | --- |
| pine-beaver-pool | 1 | 2035.742 | 0.484 | 1887.085 | `47bc4f082e7ca9ce7fc0f5c2b4b03c9cf8f4112a182a86cf9235819c34307ffb` |
| pine-cabins | 2 | 3233.752 | 8.505 | 6522.569 | `ca8ffca8e0145365e132c9dde4c3896e4959e1720bde1a7d9f4d03cdae29b162` |
| pine-crags | 3 | 4002.613 | 9.374 | 4562.491 | `5fb5d1378da2496e47b679fd5d470d6db634701b980c7878fdfe3fa638ea4300` |
| pine-king-collision | 1 | 2589.970 | 0.655 | 1790.089 | `47c9d322d7b8d8ac4cee7c3699e6f89ba9c1a9cc3ff27080971554d8f5140acb` |
| pine-lookout | 2 | 3313.566 | 0.757 | 2829.572 | `3ec0dbd8b1d2a34f319c7550fe2cb600dd6548a7e7032e9f389bf9f8fc193f34` |
| pine-props | 1 | 5455.417 | 1.078 | 5365.365 | `ed947fb20e8bdeb49d745450ab1f98e3dad0cf40131333006093981ee722a8ac` |
| pine-site-timbers | 2 | 4258.640 | 0.962 | 6811.656 | `28aac276f2df1192cb9f9fd4d2a6292ec664dcf920b2be36e1831e5cc429f9c7` |
| pine-streams | 2 | 1957.080 | 0.604 | 2517.816 | `3657fc65d1e4f1e74ca84c873a4dee7cfd597bae480da80f92eb783030b7d933` |
| pine-undergrowth | 1 | 1481.124 | 0.463 | 1604.552 | `c6435e5fc28e9f3cff0ce62ac5eaa60f6e5ad363f645ff58bfa7d88854b5a0c4` |
| pine-wildlife | 2 | 4489.865 | 0.972 | 2352.053 | `03b4e2e29047dfe7469f95d030825a104e0cfe0bf8420c4cc2d01b7b3c2a179c` |
| pine-hdri-keys | 14 | 15356.771 | 42.666 | 13782.766 | `e542b645fac46bb4fc54c17587ed564a45a4c5e46fa2d4dfa5b10bbc39d15ed5` |
| pine-physics | 1 | 29600.583 | 2.965 | 27963.450 | `6eae81915ce37903147241e482abf3629c56b68c9bc0f024c2eabc328e7ca6f9` |
| pine-spots | 1 | 28744.898 | 0.891 | 28271.655 | `e9459c1ecd57debba1f1d00346e60af81094afb18213a486419eff9d69e1f38f` |

Cold/forced includes full output provenance. Committed comparison is byte-exact for the ten ordinary node jobs;
the King table uses the already-registered exclusion of its top-level input hashes only. Browser capture comparison
excludes only top-level revision/build/inputs where present. Every nested actor, clock, collider, prompt and gameplay
field stays exact. Pine spots has no input-hash header; the cache still keys its complete conservative source closure.

The sky-key job pins all seven Poly Haven HDRI source URLs and SHA256s in the sidecar and hashes the ImageMagick
executable and version output. Raw inputs use the same shared cache, never an unkeyed OS temp cache. All 14 image
outputs exactly reproduce committed bytes. No raw HDRI is added to git. Source-download time precedes the producer
timer; the displayed backend timer also excludes initial input collection/key verification.

Early attempts correctly refused: isolated node bakes lacked the manifest composition root (including one preload
argument-order attempt), and the older spots header lacked inputs. The defining fixes explicitly install only the
real shard manifest and allow absent provenance, rather than weakening payload comparison. These failures are not
successful proof samples. The final two proof batches passed; all capture browsers and leases closed.

Validation: 13 focused runner/source/capture tests, strict including the real preload and its ambient declarations,
and touched-file lint green. No full suite, runtime/collider change, witness refresh, or Linux portability claim.
The runner/backend API consumed by the witness cache remains unchanged.
