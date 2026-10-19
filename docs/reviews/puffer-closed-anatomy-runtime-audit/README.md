# Selected closed-anatomy Puffer: source-to-runtime audit

2026-10-19. Read-only source/host audit on `gamedev-dot`; checkout HEAD at start
`2b57bb831bcaa0be89bcad22eedea31f4e9da309`. **Do not build or promote this source
unchanged.** The bind skeleton is exactly compatible with public V70, but its
fin skin is not compatible with the attachment contract that makes gait5 usable.
A narrowly bounded, geometry-preserving rig1 weight derivative is the next useful
source-only step. No new animation channel is demonstrated necessary yet.

This is not new model likeness progress. The selected geometry is unchanged:
fresh independent score **4.005/5**, earlier separate judgment **3.6375/5**.
Both remain visible; neither is averaged or rounded. New complete assembly
**3.88/5** remains rejected. Passing this audit's measurement test is not an art,
rig, animation, physics, gameplay or runtime-admission pass.

## Protected current public product

Inspected the coordinator-identified **current Site77 retained `puffer-engine`
host**, not the historical recovery checkout. `source-and-host-audit.json`
recomputes every hash: **50/50 shared-arena Puffer file pins and 137/137 gray-v2
app inventory entries match**, zero missing files or mismatches. The shared host's
`practice/shared-arena/content.ts` explicitly uses the same `pufferPose` wrapper
and carries `rootFlinch` through the normal species look. This is local-current-
copy verification, not a new network or browser check.

- Original V70 native: `3d0606971754f7788e899fe31214748fd38f43b38b363f2d2b291be588de48dc`
- Public weighted native: `b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762`
- Public packed geometry: `2ffa9b3db66bb27a6a4b9a75abee22569b8aeab0e5e8a6fb5d68e38e5474ea15`
- Public product sourceHash: `80e39ff9f9af3b1e0bcaf3565e9282aa042a33af32298850c6085be7396cf895`
- Actual public pose blob: `cf98695e901d32720a0434084c553b4f91ac2b01e58c0a0b224105ee10dfed17`
- Base pose source: `2936bdd0072f05b2d41785333719fd9a9f1237d1fbf182d953d395bfa403bac0`
- Gait source: `501c9c6a16fa29a7f87780e263cb4ed1df9c9c2ac53077455f6a2eee08fdb4f0`
- Gait5 wrapper: `54662e9d697533877bb2c7cbe0a29ae415769416d6db3223558a1ab67feeb15d`
- Gray-v2 lighting: `b0871ebc6bb4b1584cc3b970861dd9d577dd1d6f03c59b752f4d937571c29101`

Authored-pose recoil, neutral-gray-v2, contact-v1, all current host files, public
source and admissions remain exact. No model, runtime, product or Site edit.

## What is actually compatible

Selected source is
`art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study/closed-anatomy-native.json`,
SHA-256 `98c4855852fc77ef385b0998e98dc5bdbabf40bb32b815f598c9a922525e5006`.
It contains seven parts, eight bones, **3,486 triangles / 10,458 vertices** versus
public V70's 3,331 / 9,993. Both use x-right, y-up, z-forward native coordinates,
identity-oriented absolute bind pivots, linear skinning and the same part ordering.

The entire ordered bone records are exactly equal, not merely names. Root body
and belly are at Y `0.6000000238418579`; belly is under body, head under belly.
Tail absolute Z is `-0.5174999833106995`; head absolute position is
`[0, 0.8299999833106995, 0.5]`. Front/rear fin absolute pivots are
`[±0.4300000071525574, 0.5, 0.1599999964237213]` and
`[±0.4300000071525574, 0.5, -0.36000001430511475]`, all under body.
All eight inverse bind matrices computed from actual decoded native bones compare
exactly equal; the receipt retains every matrix and absolute bone record.

All four fin parts have **exactly equal position arrays, triangle ordering,
linear paint and fur arrays** to public V70. The body, head/palate and tail parts
are different, so no whole-model rest-equivalence claim is available. Head stays
pure head-weighted and inherits belly scale; body remains pure belly-weighted;
tail remains pure tail-weighted. Same head radius is not proof that the head mesh
is unchanged. The new tail extends another 25 mm backward.

## Consequential incompatibility: fin skin

Selected has pure fin weights on every vertex of all four fins. Public V70 rig1
has, **per fin**, 66 belly-only root-cap triangle vertices and 72 vertices weighted
0.8 fin / 0.2 belly; all other distal weights remain pure fin. These are exactly
138 changed weight rows / 24 distinct coordinates per fin: **552 weight rows**
across the four parts. The 12 top-cap coordinates per fin have the same positions,
multiplicities and oriented triangles in selected and public because the complete
ordered fin position arrays match. This permits an exact correspondence recipe;
it does not permit bypassing source admission. The existing V70 transfer correctly
refuses selected's source hash.

`runtime-audit.test.ts` calls the existing Python native validator/packer in memory,
the actual `packedCreatureBodies` decoder, the actual numeric evaluator, the
unchanged gait5 wrapper, and `SkinnedMesh.applyBoneTransform` with actual decoded
float32 positions/weights. The motion programs are read from the exact public
product; deep equality against `pufferNativeGait4Clips()` is asserted. The public
codec repack reproduces the exact public packed hash. No hand-written animation
formula or invented rig acceptance substitutes for these consumers.

For each source: three static poses plus **1,068 sequence frames**, four time steps
(1/60, 1/30, 0.1, 0.2 seconds), stop/resume, attack entry, hit and keyframed death.
These are controlled scalar inputs, not a real AI simulation or motion capture.
Death uses real stage5 rather than leaving the attack scalar active. Every native
vertex is skinned. Root-cap comparison uses the same existing test's Y>0.4 cap
region; all selected cap stations are 0.48/0.492 m, next stations <=0.18 m.

- Selected gait/transition cap-to-belly displacement: **122.789643 mm** maximum.
- Selected static 1.05 inflation: **27.839339 mm** cap displacement.
- Selected static 1.10 inflation: **55.678678 mm** cap displacement.
- Public V70 corresponding maximum: <= **2.23e-13 mm**, floating-point roundoff.
- Both sources' sampled sequence minimum local Y: **+4.000000 mm**.
- Selected static 1.10 minimum Y: **+2.265662 mm**, on the inflated hull.
- Minimum fin triangle area ratio over sequences: approximately **0.6** in both.

Positive local floor and nonzero triangle area do not fix root detachment or prove
absence of intersections. The 122.8 mm value is displacement from the corresponding
belly-attached rest point, not a rendered hole width or signed hull-distance test.
Exact witnesses, per-part minima and all sampled envelopes are in the JSON.
No new root lift, clearance padding, callback, contact exception or tolerance was
introduced. The existing gait5 wrapper's visual continuation remains unchanged;
its foot compensation is not a new correction authorized by this audit.

## Dimensions and collision consequences

Fresh existing `measure(..., weighted=True)` results, in metres:

| Quantity | Selected original pure-fin source | Public V70 rig1 |
|---|---:|---:|
| bodyY | 0.600000023842 | 0.600000023842 |
| bodyHalfLen | 0.506497664169 | 0.459094882011 |
| bodyRadius | 0.963145520796 | 0.869332205309 |
| headRadius | 0.532192366496 | 0.532192366496 |
| geometric legLen | 0.596000023652 | 0.596000023652 |
| calibrated phase legLen | 0.340643705003 | 0.340643705003 |
| halfWidth | 0.978999972343 | 0.978999972343 |

Selected all-part rest bounds before packing:
`[-0.978999972343, 0.004000000190, -1.1825]` to
`[0.978999972343, 1.560845486502, 1.012995328338]`.
Public bounds:
`[-0.978999972343, 0.004000000190, -1.157500028610]` to
`[0.978999972343, 1.455999970436, 0.958145499229]`.

The existing measurement function's body/head radius includes its documented
1 mm conservative margin; it was not added here, not used as floor tolerance,
and is not accepted collision tuning. Unpadded selected hull distance to its
measured body segment is 0.962145520796 m. With the *old* V70 segment and radius,
**20 selected body/belly-weighted triangle vertices lie outside**, worst
**92.813315 mm**. Old dimensions cannot be silently inherited.

Positive-influence foot AABB centres change when the selected cap is pure fin:
front `±0.579499989748, 0.521572750062`, rear
`±0.523699998856, -0.049711585045`. Public rig1 centres are front
`±0.639499992132, 0.629072755575`, rear
`±0.551949992776, -0.046749070287`. Re-measure the derivative after any weight
transfer, rather than using this unweighted-source measurement receipt. These
centres are measurement inputs, not verified terrain contact points. Preserve the
existing independent phase calibration `.24 / (2 * sin(.36))`; do not disguise
phase calibration as a new leg geometry or floor offset.

## Unchanged runtime obligations

Current public product strike is 0.9 s windup + 0.1 s active + 1.1 s recovery =
**2.1 s**, ring outer/range2.2, damage12; movement is ground stalk0.7, standOff2.0.
`brinePuffer.as` uses normal scheduled decision ticks, `puffer-st` and
`regular-clock`: approach stage0, stop/strike stage1 at distance<=2.1, stage2
recovery2.4 s, stage5 death; hit callback does not create a new clock.
Keep all of this exact. The existing gait sampler consumes frame phase/speed,
flinch/deathT/time and those scalars; it does not integrate a new private AI clock.

Base pose targets belly scale, body positionY/rotationX,Z/scaleY, fin rotationX,Y
(replaced in gait4/5 by fin positionY,Z and rotationX,Y), tail rotationX,Y. Head
has no independent channel and stays bind-local. Body bob/recoil remains the
existing authored pose. Gait5's actor-local continuation resets on hit rise,
death, rewinds and invalid dt; it must not be broadened to conceal bad new skin.
For admission, test normal clocks, transition continuity, actual attack hit window,
flinch, stop/resume and death, with target bones validated explicitly: the generic
numeric evaluator filters absent optional bones, so decode success alone is not
proof all intended channels executed.

**Physical death is still a separate blocker.** Current `AnimalView` selects a
rigid custom-body ragdoll when no upright/corpse recipe is specified; keyframed
limbs continue during physics death. This local scalar audit does not run that
world transform or Rapier. Existing V70 authored-recoil evidence already records
corpse penetration up to **41.647 mm below collider** / 11.647 mm below visible
floor. Do not transfer its living-contact result to death or to the enlarged
selected body. Require actual weighted world/contact checks from multiple death
poses/hit directions, no lift, padding, exemption or replacement callback.

## Bounded source-only next step, not executed

1. Preserve selected and public natives immutable. Create a new explicitly named
   derivative directory only after assignment, e.g.
   `art/driftwood-isle/puffer-complete-remaster/closed-anatomy-runtime-rig/`.
   No rewrite of retained selected or fabricated numeric model version.
2. Author an exact-source transfer recipe admitting only selected SHA98c485… and
   reference public weighted SHAb98559…. Assert complete ordered bones and all
   four named fin positions/paint/fur arrays match exactly before changing weights.
   Copy only the **552 identified skin rows** (indices plus weights). Assert every
   non-skin byte-value remains unchanged, including body/head/tail and every bind;
   assert all distal skin rows remain exact. Emit full immutable input/output,
   recipe and equivalence hashes. This is a new rig derivative of the same visual
   geometry, not a model-likeness gain or permission to call it V72/etc.
3. Re-measure actual positive-weight envelopes and separate geometric legLen from
   phase calibration; retain honest unaccepted collision/visual flags. Produce
   exact-source codec evidence and rerun actual public-pose evaluator with the
   derivative. Require cap attachment, finite normalized skin, full-part envelopes,
   source-to-float32 parity, triangle behavior and continuous/intersection checks.
   The selected source's documented self-crossing/contact defects are not waived:
   known proper hull crossings and palate contacts require explicit resolution or
   an honest failed gate, not a claim that closed edges certify a solid.
4. Do not change pose clips initially. Fin geometry and binds give a bounded reason
   to try the exact public rig1 weights and clips. If the changed belly, face or
   tail fails motion/clearance/physical checks, report the actual witnesses and
   author consequential source rig/pose work in that new lane. No guaranteed
   animation score follows from the plausible transfer.
5. Only after source gates, authorize a distinct native candidate admission and
   isolated build. Preserve public70 tuple, shared-arena pins, recoil and gray-v2
   untouched. Require real normal-renderer full-cycle independent animation and
   readability review, collider/terrain/turning/hit/death, damage/reward/Retry and
   persistence checks before considering promotion. Static score4.005 is not any
   of those results. No build or promotion is part of this audit.

## Descriptor constraint and explicit identity proposal

`scripts/puffer-preview-input.mjs` requires candidate `/^V[0-9]+$/`; the gait
admission then admits only exact V57 rig1 or V70 gait5 tuples. A descriptive
closed-anatomy ID cannot pass this legacy path. Naming it V70 would violate source
identity; inventing the next V number would manufacture an art version. Neither
is an acceptable shortcut.

Proposed future source identity: `puffer-closed-anatomy-98c4855852fc`, with separate
`rigProfile: closed-anatomy-rig1` and exact parent native, derivative native,
measurement, dimensions, transfer/equivalence, pose and adapter hashes. Extend
input resolution through a separately schema-tagged, strictly pinned descriptive
source-identity path while retaining the current legacy V-number resolver and
V70 admissions unchanged. Add tamper/rejection tests for every tuple field and
consumption of the explicit identity by build receipt, diagnostic label and UI.
The builder currently also permits gray-v2/authored-pose only for the literal
`v70-rig1-gait5` profile; a future descriptive profile needs equally explicit
policy binding, not impersonation of that profile or a broadened wildcard.
This proposal is documentation only; no resolver/admission code changed.

## Reproduce / scope

Run from the project root:

```sh
python3 docs/reviews/puffer-closed-anatomy-runtime-audit/source-audit.py
node_modules/.bin/vitest run --config docs/reviews/puffer-closed-anatomy-runtime-audit/vitest.config.ts docs/reviews/puffer-closed-anatomy-runtime-audit/runtime-audit.test.ts
```

Current host files must exist at the coordinator-identified sibling checkout.
The test asserts exact native hashes and public pose hash, decodes transient
in-memory packs, then writes only its owned measurement JSON. No native/model
output, preview product, app build, render, browser, Git/network write, Mac,
production asset, public pin or admission was changed. Source and dependency
hashes are checked again after evaluation. This is an offline diagnostic, not
public admission and not a new live/phone play claim.
