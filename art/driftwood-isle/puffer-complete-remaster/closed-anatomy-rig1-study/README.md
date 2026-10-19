# Closed-anatomy rig1: source-only derivative

2026-10-19. Prepared after the coordinator reviewed the frozen
`docs/reviews/puffer-closed-anatomy-runtime-audit/` result. **No app/product build,
new runtime admission, collider change, rendered evidence or promotion.**

## Exact identity and edit

- Source identity: `puffer-closed-anatomy-98c4855852fc`
- Rig profile: `closed-anatomy-rig1`
- Retained original native: `98c4855852fc77ef385b0998e98dc5bdbabf40bb32b815f598c9a922525e5006`
- Public70 rig1 weight reference: `b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762`
- New `closed-anatomy-rig1-native.json`: `38e0ad4de8a25827ace7a366e70c3c21a860ce9221de64f4b4afaf0c27ec2b61`
- Transient diagnostic codec payload: `c1901ca16cd8efecaf839117ce9efef3b128008d571c89d586896e7f10220bb8`

Only **552 fin skin rows** changed: 138 per fin, 24 distinct coordinates per fin.
Per fin, 66 top-cap triangle vertices now belong wholly to belly, 72 adjacent
vertices use 0.8 fin / 0.2 belly; all distal rows remain exact. The transfer first
requires exact ordered binds and full ordered fin position, paint and fur arrays
against public70, then requires the entire resulting fin part to equal the public
rig1 reference. Body/head/tail including their skin remain exact. All non-skin
model values, metadata, geometry, paint, topology, bind hierarchy/order/pivots are
exact to retained selected. `transfer-receipt.json` lists all changed row indices
and immutable recipe/input/output hashes. No producer or old native was edited.

This is the **same visual geometry**, not a new complete model. It inherits the
selected source's separate 4.005 and 3.6375 static judgments, with their disagreement
retained; it earns no new likeness score. The rejected3.88 complete assembly is
not used. No manufactured V number. `candidate-source.json` is an explicit pinned
source record, deliberately not a legacy V-number preview/admission descriptor.

## Actual consumer/evaluator checks

The study reuses the frozen audit's preparation code. The existing native packer
runs in memory; the real packed-body consumer decodes float32 attributes. Actual
public pose blob `cf98695e901d32720a0434084c553b4f91ac2b01e58c0a0b224105ee10dfed17`
is checked against current authored programs and evaluated through the unchanged
numeric consumer/gait5 adapter and Three `SkinnedMesh.applyBoneTransform`.

Three sources are compared: unchanged selected, derivative, unchanged public70.
Each receives **1,071 samples**: rest, static1.05/1.10, and1,068 stop/resume,
attack-entry, hit and keyframed-death sequence frames at1/60,1/30,0.1,0.2-second
steps. All10,458 derivative vertices and seven parts are measured. Exact ordered
bones and inverse binds match both baseline sources. This is controlled scalar
sampling, not a live AI, physics or rendered-animation test.

Derivative results:

- Maximum cap-to-belly displacement <=`2.220446049250313e-16` m, versus selected's
  `0.12278964263212996` m. Static1.10 cap displacement similarly falls from
  `0.05567867766411256` m to roundoff.
- Minimum local sequence Y `0.00400000018998975` m. Static1.10 hull Y
  `0.0022656615823507392` m. No new root lift, padding or tolerance offset.
- Minimum fin area ratio `0.5999999999999934` in keyframed death; no sampled fin
  triangle collapse. Actual transformed whole-part envelopes are retained.
- Weight-derived front/rear foot centres return exactly to public70's centres;
  unchanged geometry itself was never repositioned.
- All current source/dependency pins remain unchanged after evaluation.

**One focused runtime measurement test passes; seven Python transfer/tamper tests
pass.** This closes only the identified pure-fin skin mismatch. It does not
establish triangle nonintersection, rendered attachment quality, world terrain,
yaw/turn planting, real hit/combat behavior, physics death, or a motion score.
The cap metric follows corresponding rest points under the belly transform; it is
not a signed hole-width test. Since cap and belly hull now share the same affine
transform, their original relative arrangement is preserved, including any
pre-existing defects. The retained geometry audit's finite root-interior samples
are historical evidence only, not a new continuous solid-intersection proof.

## The 20 old-capsule misses are decorative spike tips

`semantic-envelope-audit.json` maps the *actual source*, not names guessed from
coordinates. Closed-anatomy's producer preserves the post-hull triangle range
exactly from pass2; the eight six-triangle spike blocks reconstruct exactly from
pass2's pinned vertices/faces receipt.

Part0 regions are core continuous hull triangles `[0,1022)`, authored face/brows/
beak `[1022,1426)`, and eight spikes `[1426,1474)`. Against the **unchanged public70
rest body capsule**:

- Core hull: **zero outside vertices**; minimum margin115.096247 mm
- Authored face/brows/beak: **zero outside vertices**; minimum margin253.282048 mm
- Five decorative tips, spike indices1,3,4,5,6: each appears at four triangle
  corners, accounting for **all20 misses / five unique coordinates**
- Largest tip excess92.813315 mm; paired shoulder tips1.633298 mm and paired
  lateral tips0.389715 mm
- The separate pure-head part has zero misses against the old rest head sphere,
  with minimum margin1 mm

Therefore the larger whole-weight measurement radius0.963145520796 m must **not**
automatically become gameplay collision padding. It includes decorative spikes.
The existing helper's built-in1 mm measurement margin is disclosed, not a newly
chosen tolerance. The actual full-body bounds and all positively weighted vertices
remain measured and reported, including decorative regions. **No region was
excluded from floor/skin evaluation, and no contact exemption was added.**

No collider decision is made here. The old dimensions are plausible inputs for a
separate anatomical collision investigation, not admitted by a rest-only test.
Living inflation, hits and real physical death must test their actual contacts.
Diagnostic transient pack dimensions use freshly measured whole-weight envelopes
and existing independent phase calibration; this was never written as a runtime
collider config, added to an admission, or built into a product.

## Remaining gates before any runtime candidate

1. The unchanged selected source retains documented self-crossing hull sheets and
   palate contacts. Weight transfer cannot fix them. Continuous source topology/
   intersection/contact checks and appropriate bounded geometry work remain open.
2. Re-evaluate actual anatomical body/head hit and movement volumes separately
   from decorative geometry, including inflated poses. Do not pad or raise roots.
3. Real physical death remains open. Public70 already has corpse-floor penetration
   evidence; neither public living clearance nor this keyframed local collapse is
   transferable physical-death acceptance.
4. Native normal-renderer nine-view/rest evidence and full normal-clock animation/
   readability review, plus real combat, attack boundary, hit, reward, Retry and
   persistence checks remain pending. No physical-phone claim.
5. Only the coordinator may advance to a separately admitted isolated build after
   reviewing this candidate. The explicit source-identity resolver/profile path
   described in the frozen audit is still unimplemented; legacy V70 admission,
   public70 gait5/recoil/gray-v2 and all shared-arena pins stay untouched.

## Reproduction and delivery

From repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/test_transfer.py
python3 art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/audit_regions.py
node_modules/.bin/vitest run --config art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/vitest.config.ts art/driftwood-isle/puffer-complete-remaster/closed-anatomy-rig1-study/runtime-audit.test.ts
```

`transfer_weights.py` refuses overwriting outputs; its unit test reconstructs the
saved derivative in memory and verifies its exact bytes. Runtime tests require the
coordinator-identified current sibling Site checkout, read-only. Raw environment
`test.log` is retained locally and excluded from publication. `study-freeze.json`
contains the stable deliverable list; no unrelated work or assets were changed.
