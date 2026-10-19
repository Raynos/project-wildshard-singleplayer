# Conch motion5 complete upper-body source study

## Status

Candidate-only, unaccepted. The motion4 product, host and public Site are untouched.
No build, browser capture, performance measurement or five-point visual score has
been made for motion5. Root coordinates any next real capture after independent
source review. Source checks cannot establish a four-star result.

## Authored change

The complete living upper-body phrase now has a close fencing ready stance,
two-part anticipation, committed alignment, independently timed torso release,
weapon withdrawal, small follow-through reversal and settle. Ordinary and counter
preparations remain distinct. Shell/head motion participates in the action rather
than waiting through the entire sword hold. Shield guard at ordinary onset and the
guarded stage4-to-counter bridge retain the existing observed guard semantics.
Idle breathing remains. This is a complete candidate, not a hit coefficient patch.

The weapon's exact validated active pose and its windup−.10 to windup+.30 hold
remain. This is deliberately conservative: the existing 720 real-runner cases
include bounded behavior/runner skew at coarse steps. Shortening the hold without
new evidence would knowingly invalidate that coverage. Consequently a visibly held
sword may remain, even though torso release starts at windup+.10. Only real video
can judge the whole gesture.

A closer ready stance distributes turn between shoulder and forearm. On a hit,
actual admitted flinch drives return toward the defensive line. Attack contribution
outside the aligned weapon interval vanishes at full flinch. The former outward
forearm hit excursion is removed as part of this full stance/phrase rewrite.
No hidden state, elapsed-hit clock, visual root offsets or new frame fields exist.

## Feasibility and actual transitions

Stage2 resets clock every stunned tick, and stage4 clock stays zero during stun.
Motion5 therefore evaluates its hit bridge using actual flinch at clock zero.
Flinch decay tests supply exp(−5.5×elapsed), matching the engine presentation input;
the candidate itself does not manufacture elapsed time. Frame.attack is normalized
windup progress then −1 throughout active/recovery/stun, so it cannot supply a
missing authoritative recovery clock and is not repurposed as one.

Exact arbitrary continuity is still impossible for this stateless source contract:
many distinct incoming poses map to the same stage2/4, clock0, flinch1 inputs.
The candidate must not be promoted as a continuity solution. The 6,120 legal
interruption samples include equal-flinch and actual prehit→flinch1 transitions.
Ordinary windup routes to guarded stage4; unguarded ordinary tells are not invented.
Across this dense sampled set the largest local-axis jump is 0.5199568283rad,
compared with motion4's 0.55rad. This modest overall change must accompany any
narrower improvement claim. At counter clock .485, equal zero-flinch cancellation
is .26rad versus .48; equal full-flinch is .10 versus .52. Some incoming poses can
regress; neither the maxima nor the narrow cases imply uniform improvement.

Physical stagger and its intentional root displacement are untouched. So are all
AI/strike clocks, tactics, damage, guard multiplier, rewards, geometry, collider,
lower body and death. The original death onset/rigidity and unplanted foot-slide
limitations therefore remain. New living ready angles can change the visible jump
into the unchanged death pose; actual lethal interruption must be reviewed.

## Measured source evidence

- 4,815 living weighted snapshots, 7,338 vertices including 94 blended vertices.
- 5,300 root/lower-body/death parity snapshots against tested planted baseline;
  root/lower-body numeric bytecode equality is separately asserted.
- All 720 unchanged real-runner first-hit cases and 483 dense aligned-plateau cases.
- 2,231 blade edge/vertex versus conservative torso-box checks, not complete mesh
  self-collision proof. Floor minimum remains 3mm in the dense fixed-input grid.
- 54 independent gait/time/speed snapshots. These do not establish planted feet.
- 6,120 legal interrupted pose comparisons, 260 clock-zero flinch/repeated-hit
  snapshots and 20 two-sided authored-knot continuity checks.
- Strict numeric consumer, 26 programs with maximum 95 nodes, unchanged 128-node ceiling and input schema; extra
  pose-history fields and numeric locals are rejected.
- Exact native source/metadata/payload admission and mutation rejection pass.
- Isolated catalogue compares all gameplay/platform/non-pose entries with the
  tested baseline. Only pose bytes and candidate identity may differ.

All pose comparisons are evaluated source snapshots using fresh weighted transforms,
not encoded video or claimed rendered continuity. Runner tests preserve their bounded
structural actor/order/skew assumptions. Contact tests do not imply all terrain,
world transforms, triangle interiors, player-mesh contact or physical phone behavior.

## Reproduction and capture handoff

Use tests/conch-motion5-vitest.config.ts with the three explicit
conch-motion5-admission, conch-motion5-contact and conch-motion5-catalogue test files.
Native admission uses the existing conch-native-admission.test.mjs and
conch-readable-admission.test.mjs. Final receipts and SHA256 closure live beside the
candidate under art/driftwood-isle/approved-conch/motion5-study/.

The candidate factory is conchMotion5Preview.ts. It prepares the same isolated
catalogue through the real SDK and unchanged gameplay source; do not replace the
public motion4 factory or relax admission. Build preparation still needs a new
root-approved exact product/host closure and the shared heavy lane. The frozen
poses.json is an admitted numeric payload, not a built product.

Next capture must include complete ordinary/counter cycles, true early/late guarded
windup hits, active/recovery interruption, clock-zero stun and repeated hits, full
subsequent cycles, approach/stop/resume, lethal interruption/corpse, player defeat,
Retry and isolated persistence. Preserve every failed attempt. Record actual pose
inputs, real runner/behavior clocks, root/joint matrices and encoded/render cadence.
Independently review every encoded frame and weighted world contact. Do not rescore
static likeness from this study or silently claim unchanged death/grounding improved.

Final focused Vitest run passes 6/6 across three files; separate export rerun passes
3/3. Native admission passes 3/3. Final focused test lint has no diagnostics after
adding a strict local test tsconfig (root strict flags inherited, no schema or
consumer exception). The final test-only edits are whitespace and explanatory
Node-I/O/Vitest-export annotations, with no assertion or candidate-source change.
