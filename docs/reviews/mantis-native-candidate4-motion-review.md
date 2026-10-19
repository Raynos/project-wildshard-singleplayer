# Mantis native22 candidate4: independent motion review

2026-10-19. **Usable as an explicitly labeled WIP playable candidate. Not quality-complete or production visually admitted.** The recorded corpse penetration defect is repaired. The complete encoded collapse, long settled hold and death-to-Retry transition are present. Weak walking support, restrained/held attacks and overlapping folded anatomy remain visual-quality work. This is a narrower WIP usability decision than candidate3's failed full visual admission, not a claim that all its quality blockers vanished. Static V7 likeness **3.6025/5 remains unchanged**.

## Exact evidence and scope

Reviewed `public/review-evidence/mantis-v7-candidate4/live-observer.mp4`, SHA256 `2bf1755eb44815720131ed2b0afde107210202bbfa600ef114c443fd5907b88c`: **1,383 encoded frames, 25fps, 55.32s**. Independently decoded and inspected every encoded frame 0–1382 in order on 29 numbered contact sheets, including repeats. Subject crops cover (70,290)–(320,580); full-frame checks confirm labels and corpse framing. Some antenna tips extend beyond these review crops; the original full-frame recording remains authoritative. Large temporary sheets stay outside the published source inventory. Small scripts, index and numerical receipts are in `art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate4/independent-review/`.

Capture-closure SHA256 `333c168f88ead84112193c14db4051adf1ee67a01261ecef49c4b2a19b3f2a99`; source-closure SHA256 `0b9a31b042ecceddbe55b10bab620ae05a478bf09f16a7f9b0ac37dc407372d0`. Independently verified every file hash in capture closure, source closure and admission. Tested product source hash `8ffdee515e3426653e8ebc74f8ccefc229f35ceb00c869e743615e27b792b89c` belongs to the original captured **137-file host build**. The later PracticeCreature event-drain change was made after capture and is **not validated by this evidence**. This review made no source edits and ran no browser, build or new gameplay test.

Actual cloud Chromium arena, portrait 402×874, with a render-only diagnostic observer camera and logged player placements. This is actual AI/combat capture under diagnostic observation, not a normal first-person human playtest. Recorded sample cadence: 469 consecutive trace frames 5–473; wall intervals min 5.6ms, median 97.85ms, max 354ms. Encoded 25fps repeats do not prove 25fps simulation or physical-phone performance.

## Encoded coverage boundaries

Directly read the burned-in HUD around transition frames; raw OCR contains numeral errors and is retained only as an unvalidated aid. All ranges below are zero-based inclusive and together cover all1,383 frames:

- Startup/front view0–106; observer approach107–282.
- First windup283–305; active306–359; recovery360–366; return idle367–372.
- Second windup373–380; active381–416; recovery417–453.
- Stationary recovery454–512; resume/reset/subsequent hits513–751.
- Kill/collapse752–781; corpse settling782–876; stationary corpse tail877–1068.
- Retry and fresh bout1069–1382.

Trace and video are different samples: first encoded active is HUD78 rather than77; second encoded windup starts101 rather than100; last encoded corpse is351 rather than352. The continuous recorded intervals contain every **encoded** frame, not every rendered trace pose or every authored phase value.

## Independent world geometry

Reconstructed all 469 poses using NumPy: exact native rigid vertices, absolute bind-translation subtraction, hierarchical local xyz/quaternion xyzw matrices, and the complete recorded column-major mesh world matrix. Floor Y=900. No collider conclusion is inferred from mesh vertices.

- Living minimum: **+0.0006728281m**.
- All 129 dead samples: minimum **+0.0136223861m**.
- No recorded pose has vertices below the floor, including collapse and settled tail. This repairs candidate3's independently measured corpse minimum **−0.1448217846m**.
- Final six game seconds, trace276–352: 77 samples; all 16 world-matrix components are exactly constant. Minimum is **+0.0136271551m** throughout, with exactly eight body vertices within 2cm of the floor.
- Root still settles to Y899.85986328125. Clearance comes from anatomy, not lifting the physical root. The near-floor vertices are body vertices, not proof of planted feet or a supporting contact polygon.

These are sampled vertex clearances in one captured arena, not continuous-time collision guarantees, contact-force evidence, universal terrain acceptance or collider acceptance. The settled body is about 1.36cm clear of the mathematical floor; “near-floor” is more accurate than claiming literal mesh contact.

## Collapse, settle and Retry

The fifth sword hit kills the actor at trace224/game19.3782. Encoded752 begins the last bright hit flash; subsequent frames show the body lowering, legs curling and the sickles folding. The full transformation is retained, including its overlapping middle poses. It reaches a recognizable folded insect corpse, then continues its physical settle before the long stationary hold. The final corpse is compact and crowded: the raised sickle crosses the body/leaf cluster, and the tucked limbs lose separation. This remains a polish issue, but no gross dislocation, disappearance, persistent jitter or obvious floor slicing blocks labeled WIP use in this capture.

Encoded1068 still shows the corpse; **1069 at42.76s shows the fresh living actor**, corresponding to the trace death-to-live transition353. The remaining footage shows renewed approach and both attacks. The final full-frame image shows HUD frame465/game39.30, “Fresh practice bout,” and a living actor. **465 is the final encoded HUD state, not the Retry transition frame.** Telemetry continues through473; those last eight renders must not be claimed as encoded.

## Living motion and tactical readability

Direct comparison of candidate3 `mantisPhaseClips.ts` and candidate4 `mantisFoldedClips.ts` finds only naming plus four death-only changes: body roll .60→.40, abdomen pitch −.15→.05, elbow pitch .4→.8, and transient knee curl side×2×smoothedDeath×(1−smoothedDeath). Living terms and body translation are unchanged. Admission verifies the same tactical and phase-observation source hashes. This repair did not improve the existing gait or change tactical timings.

The first complete attack pair is trace69–99 and100–130:

- First: windup69–76; actual active77–96; recovery97–98; idle99.
- Second: windup100–103; actual active104–117; recovery118–129; idle130.
- Recovery/standing follows, then resumed travel and turning before the diagnostic bout reset. Gait wraps26→41 and41→57 bracket two complete approach cycles before attack69.
- Hits187,195,205,214,224 reduce HP55→43→31→19→7→0. Bright flashes clearly communicate hits, but obscure the small geometric recoil.

Both sickles distinguish anticipation and cut, with no prolonged false return-to-guard during actual active phases. Long active periods still read as largely held poses while translating. Walking remains small alternating paddles beneath a stable upper body; floor anchoring is unconvincing, especially without local contact shadows and with a tracking observer camera. No new living-motion regression is evident, but this is not convincing planted locomotion.

There are **15 trace boundary mismatches** between authoritative strike phase and observed pose phase:69,77,97,99,100,104,130,182,391,418,419,420,421,443,456. The unchanged10Hz observer and .10s active blend retain brief onset/cancellation lag. Do not claim frame-exact synchronization.

Candidate3's separate held-simulation idle diagnostic remains historical, isolated authored-pose evidence. Candidate4 recorded no new isolated idle clip. Live stationary recovery is present; it does not establish sustained live-AI idle behavior. Candidate3's corrected top-source/native views likewise remain separate evidence.

## Gameplay corroboration and decision

The captured report's 11 checks are true: only Mantis, both strikes, actual player damage, enemy damage, enemy death, no post-death strike, three bout-local coins, Retry, empty browser storage, unchanged empty SaveStore and no page errors. Independently read snapshots corroborate health loss100→91.5868 during defense; enemy55→0 after sword hits; a dead corpse; fresh enemy55/player100 after Retry; empty local/session storage at all four checkpoints; and identical empty SaveStore documents/shard/generation. The corpse video HUD says “Collected 3 local practice coins.” These corroborate the captured run; this reviewer did not independently rerun the gameplay script.

**Recommendation:** retain this exact candidate as labeled, unaccepted WIP playable work. The fresh corpse-clearance repair is supported independently and the combat/reward/Retry loop is observable. Keep full-quality acceptance open for grounded walking, more forceful attack motion with better boundary synchronization, and a clearer supported corpse silhouette. No new static-art score, physical-phone performance, human fun, production deployment or later-host validation is claimed.
