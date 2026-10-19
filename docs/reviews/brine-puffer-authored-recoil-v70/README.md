# V70 authored recoil: actual runtime evidence

Source checkpoint `a617d3d718e34437104d28842f97d2d713772479`; clean engine baseline `c4339d90a93ccc289540e3a72c1e9cbf221d98fb`. The separate V57 live fallback and earlier failed V70 evidence remain preserved.

## Scoped result

Both fresh captures pass living world-floor clearance: minimum +4.000 mm above the actual collider and +34.000 mm above the actual visible floor. All 9,993 vertices, 3,331 triangles and seven native parts are audited against the captured runtime Float32 buffers, actual bone names/bind inverses, and actual bone world matrices. The actual registry collider top is 900 and rendered plane is 899.97. The attached skinning world transform cancels meshWorld with bindMatrixInverse; bindMatrix is identity. All samples are evaluated, including living hits, death and Retry.

Normal: 209 actual samples, 25 living-hit samples. Diagnostic: 930 actual samples, 52 living-hit samples. Living root pitch/roll stays zero while authored body recoil and hit flash remain visible in telemetry (maximum body pitch 0.04616 / 0.06930 rad; flash1). The new data policy removes only duplicate engine directional flinch tilt. No actor position or state is clamped.

Corpse/ragdoll contact is still unresolved: normal minimum -40.780 mm collider / -10.780 mm visible floor; diagnostic -41.647 / -11.647 mm. All-phase contact is false. The audit exits on its explicitly named living-contact result and retains dead-phase failures. Physical knockback code is unchanged; no captured row has hasImpulse=true, so the footage does not independently establish an impulse.

## Gameplay and mount

Both actual input-driven runs reduced enemy45 to zero, collected two local practice coins, and used the real Retry button to restore player100/enemy45. Local storage, session storage, cookies, Cache Storage, service workers and IndexedDB remain empty before/after combat/Retry. Runtime errors and HTTP errors are empty. Gameplay and pose payloads are unchanged; selected V70 look data gains rootFlinch=authored-pose.

The normal renderer retains all four passes and shadows. The diagnostic explicitly disables postprocessing/shadows for faster motion inspection and burns that label into its frames. Both cloud contexts are portrait390x844 at DPR1, not phone performance proof. Normal rendering is slow (about224ms median sample interval); encoded video frames are not additional unique render observations. Use the burned-in overlay t and the exact telemetry stage/clock, not video zero, for alignment. The normal hit HP boundaries are33.0508/34.1326/36.1118, death38.8587, Retry45.3296. Diagnostic boundaries30.3378/31.2545/31.8713, death32.5384, Retry35.2454.

Isolated exact `/puffer-engine/` mounted route QA passes actual Start, normal rendering, candidate/policy/buffer identity, prefix-contained resource requests, real Retry and empty persistence. This is not a published-Site test. No Site checkout was modified by this run.

## Reproduction and artifact scope

`build-receipt.json` pins source, app inventory and candidate tuple. Raw captures/videos stay in local capture storage with exact SHA256 in each receipt. Compact telemetry retains every sample and exact local bone values, removing only world matrices and large runtime geometry buffers. World audits are reproducible with Python/NumPy and the hash-pinned raw capture and weighted native, using `audit-runtime-skin.py.txt` (copy to `.py`). Capture scripts are portable copies of the executed scripts; the receipt distinguishes executed-source versus portable-source hashes. Set CHROMIUM_EXECUTABLE and run through the project's browser lane. Mounted QA runs against the unchanged built app in its separate staging route.

`normal-retry.webp` is the actual normal-look screenshot. All WebP conversions are lossless with exact RGB equality verified. Independent visual review is separate. No visual acceptance, collider tuning acceptance, all-phase contact, terrain/turning proof, phone performance proof, or published Site acceptance is implied.
