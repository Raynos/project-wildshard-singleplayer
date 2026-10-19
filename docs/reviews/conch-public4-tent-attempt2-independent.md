# Conch4 tent attempt2: independent evidence review

2026-10-19. **Keep UNACCEPTED/WIP. Do not promote tent as a proven visual upgrade.**
The supported lifecycle evidence verifies, but neither the images nor the remaining
coverage justify visual acceptance. Tent can remain available as an explicitly
labelled experimental WIP comparison; I do not recommend replacing PCF on this evidence.

## What was actually reviewed

No build, browser, game execution, rendering change, source edit, Git operation or
Mac action was performed. Read AGENTS.md, GIT.md, STORAGE.md and the attempt2 brief.
Ran the existing read-only `verify-capture.mjs`: exit 0, verified true, acceptance
false, host SHA `c192731fde7eeac383f72230ceb45a1e650a919f6992d856c8827c0689fb4595`.
Its printed count is 27 cycle checks; the capture report has 31 true checks including
reload/reentry checks. This is independent execution of the existing checker, not
an independently authored proof of every checker assumption.

Original movies retained unchanged:
- PCF: `capture/control/video/page@6fcd9c2c3bb1f03833e81b9472c0e3b5.webm`
- Tent: `capture/tent/video/page@4165aed0f9136059e644fdee053ea3db.webm`

Paths here are relative to `tmp/conch-public4-tent-attempt2/` unless stated otherwise.
FFmpeg streamed every decoded RGB frame, without an fps/select filter, to Pillow.
Every frame was included once in chronological, numbered, uncropped contact sheets:
PCF **0–451 inclusive (452/452)**; tent **0–3806 inclusive (3807/3807)**.
I inspected all 44 overview sheets. Each cell preserves the entire portrait frame
at 100×218; the original is 402×874. This is exhaustive **overview frame-map coverage**,
not exhaustive native-resolution inspection, and not real-time movie playback.
No frames were skipped as duplicates. Small artifacts and micro-contact cannot be
cleared by these reduced overviews.

I additionally inspected all 120 native-resolution tent frames in these inclusive
ranges, arranged six per sheet without resizing/cropping, using original-detail views:
- 230–271: approach → thrust windup → active/player damage → recovery
- 1218–1241: guard-counter sequence, counter windup/active/recovery
- 2118–2141: lethal hit → death fall → reward collection begins
- 3777–3806: post-reload attack and final held movie image

Also inspected all six original PCF/tent approach, attack-recovery and post-strike
rest JPEGs at full resolution. These captures are not deterministic pose/time
matches, so apparent small pixel differences are not an isolated filter experiment.
Scripts, all numbered sheets, manifests and verifier receipt are retained under
`independent-review/`. This review added approximately **33.25 MiB**, below 96 MiB;
using the parent's conservative 47.94 MB initial-output accounting, combined evidence
remains well below 192 MiB. No thousands-of-PNG dump or additional movie was created.

## Visual result and limits

**No convincing visible tent benefit at this portrait scale.** PCF and tent retain
the same strong orange/cream silhouette, angular shell, dark red limbs and bright
eyes. A subtle shadow-edge difference may exist, but the available non-synchronized
views do not establish a meaningful reduction in distracting artifacts. I cannot
recommend tent as the prettier winner from these captures. Successful shader linkage
and geometry parity are technical facts, not likeness or visual-quality scores.

- The creature remains recognizable and intact throughout the overview sequence.
  No gross exploding mesh, missing shell, detached limb or persistent material loss
  is visible. White/pink damage flashes recur and return to the normal material;
  they temporarily erase surface detail and should not be called tent failures.
- Grounding remains weak. Feet and the lower body read as suspended against a nearly
  featureless dark floor; an anchoring contact shadow is not clearly readable. The
  diagnostic follow camera keeps the actor nearly stationary on screen while the
  grid moves. This limits stride/translation assessment and makes the approach read
  like gliding. It does not prove a collision error or quantify foot penetration.
  Contact/sliding are **not cleared** by this review.
- Thrust anticipation exists: shield lifts, stance widens, sword moves inward/upward
  (tent 234–248). But the attack silhouette remains close to neutral/guard and its
  weapon overlaps the shield/body; damage feedback is clearer than the attack's
  reach. Counter anticipation has a more visible lateral blade movement at 1222,
  then compresses back into the front silhouette. Telegraph readability is WIP.
- Death does visibly transition through a lean/fall (2121 onward) to a persistent
  side pose, rather than immediately vanishing. Reward and retry are visible later
  in the overview. The floor still provides little contact evidence for the corpse.
- Repeated combat, damage flashes, pause/return, fresh bouts, death/reward, defeat
  and reload entry are represented across the complete frame map. The perspective,
  diagnostic placements, hidden viewmodel and automated inputs are not ordinary
  first-person play. No judgment of touch handling, real player reactions or phone
  smoothness is established.

### Additional movie-versus-trace gap

The reload begins visually at tent encoded frame 3656; the model returns at 3718.
The final movie frames show the reload overlay held at **engine frame 19,
0.815 s, active/0.000**. Native-resolution inspection of 3777–3806 confirms it.
The reload JSON continues through engine frame 29; frames 20–29 report player HP86
and the event stream records 14 damage. Thus reload combat is supported by verified
telemetry, but **the movie does not visibly show that final post-reload damage or
recovery**. Reviewing every encoded frame cannot recover missing rendered content.
Do not describe this as complete visual corroboration of the reload combat ending.

## Functional evidence

The read-only verifier recomputed capture integrity, actual current-runtime geometry
and rig comparison, all four native skin weights, attached binding transforms,
first-use/live shader and cadence evidence, lifecycle checks and reload evidence.
The binding maximum error is 2.2737367544323206e-13 against 1e-8 tolerance (122 control,
1217 candidate checks). It establishes same-current-runtime PCF/tent parity in the
stated scope, not whole-runtime parity with the retained historical original4 host.

Supported records include actual damage both ways, windup/active/recovery, guard,
counter, pause/resume, death/settled death, reward uniqueness, no post-death strike,
defeat/blocked defeated attack, retry, fresh reentry/reload and empty persistence.
I checked the interruption observations and reload trace directly as well as running
the verifier. The five trial names do not describe where damage actually landed:
- Intended idle: actual windup, elapsed 0.2167; 3 damage
- Intended early-windup: actual active, elapsed 0.1000; 12 damage
- Intended late-windup: actual recovery, elapsed 0.3833; 12 damage
- Intended active: actual recovery, elapsed 0.4667; 12 damage
- Intended recovery: actual strike idle, elapsed 0; 12 damage

All five intended-boundary acceptance flags are false. Their damage observations
are useful, but none closes its intended boundary. Ordinary sustained disengaged
idle also remains unsupported/unproven. The stationary post-strike rest receipts
cover control engine frames54–59 (0.4836 simulation seconds) and tent66–71 (0.4825 s),
not ordinary idle. The JPEG filenames do not substitute for those exact windows.

Cloud delivered-engine cadence: PCF 8.24 frames/wall-second; tent 8.37; reload7.98.
Encoded video is 25fps with repeated images. Neither these small differences nor
encoded counts establish a causal filter speedup, real-time animation smoothness,
or any iPhone performance claim.

## Separate provisional ratings (out of 5)

These rate only the observed practice presentation; they are not release scores.
- **Animation: 2/5.** Coherent attack/hit/death states; weak planted contact,
  compressed attack silhouettes and limited evidence of convincing locomotion.
- **Combat readability: 2.5/5.** Strong color/silhouette and clear hit flashes;
  windup, guard and reach need clearer separation. Diagnostic text is not a telegraph.
- **Graphics: 3/5.** Appealing faceted character and color contrast; weak grounding
  in this dark arena. No established tent uplift. Reference likeness was not rescored.
- **AI behavior: 2.5/5.** Pursuit, attack, guard/counter and lifecycle work in the
  recorded scenario; repetitive loop and no ordinary disengaged idle demonstration.
- **Gameplay: 2.5/5, provisional.** Damage, counter, reward and retry make a functioning
  practice loop. Normal first-person/touch responsiveness remains untested.
- **Balance: untested.** Diagnostic placements and scripted inputs cannot establish
  fairness, difficulty, dodge windows or sustainable player strategy.
- **Variety: 2/5 for this encounter only.** Thrust plus counter/guard is a small
  repertoire. Wider game/enemy/content variety is untested.
- **Estimated fun: 2.5/5, low confidence.** A recognizable duel loop with feedback;
  repeated motions and weak readable contact limit likely satisfaction. No human
  playtest or normal-camera session supports a stronger claim.

## Recommendation

Retain the current PCF option and keep tent explicitly UNACCEPTED/WIP if offered for
comparison. Do not promote, declare animation/contact fixed, mark all boundaries
covered, or claim a likeness/performance gain. Acceptance remains false. The next
review decision should prioritize readable grounding and telegraphs plus honest
closure of the six open behavioral requirements; this review did not authorize or
perform another attempt.
