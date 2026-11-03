# Pine held-weapon same-source pixel cause

2026-11-03, sp-x2. Read-only Z6 investigation; no shader, renderer,
readiness, material, comparator or capture protocol change ships here.

The left supporting hand's physical-material **geometry roughness** causes
the same-source flicker. Three computes this term from the screen-space
derivatives of the unperturbed normal:

```glsl
vec3 dxy = max(abs(dFdx(nonPerturbedNormal)),
               abs(dFdy(nonPerturbedNormal)));
float geometryRoughness = max(max(dxy.x, dxy.y), dxy.z);
material.roughness += geometryRoughness;
```

This is the existing Three `lights_physical_fragment` chunk. The evidence
identifies the varying shader term; it does not identify a particular
Metal driver scheduling or derivative-quad implementation defect.

## Source and original refusals

All probes use immutable source
`a209d3e37e9ae0c9f61af3b939a13ba22cb9573a`, actual build
`a209d3e-mw0ww4tm`, served from
`tmp/serve/20261103-113649-4408/dist`.

The original strict readers and raw failures remain unchanged:

- Chromium: `tmp/sp-x8-z6/held-before-chromium/reading.json`,
  `pine-hollow-desktop-{0,1}-crossbow-24-hands-up.rgba`.
- WebKit: `tmp/sp-x8-z6/held-before-webkit/reading.json`,
  `pine-hollow-phone-{0,1}-crossbow-24-hands-up.rgba`.
- Original observer: `tmp/sp-x8-z6/held-hand-diagnostic.mjs` and
  `tmp/sp-x8-z6/held-hand-diagnostic/reading.json`.

These are native iPhone 16 Pro portrait captures, 804 × 1748 raw RGBA,
with the actual selected tier, Ghost Stag skin, EquipmentService selection,
terrain promises, and original fixed render. The hands-up pose is native
game frame 186. Coordinates below are raw GL coordinates, with a lower-left
origin. Alpha is always 255.

| Chromium desktop pixel | Original RGB alternatives |
| --- | --- |
| 566,514 | 150,112,95 ↔ 150,113,96 |
| 567,514 | 153,115,97 ↔ 153,115,98 |
| 565,516 | 156,117,100 ↔ 156,118,101 |
| 566,516 | 158,117,98 ↔ 160,120,103 |
| 565,517 | 160,121,103 ↔ 158,117,97 |
| 566,517 | 164,121,102 ↔ 163,120,100 |

The original WebKit phone refusal is pixel **569,509**:
**153,114,95 ↔ 153,113,94**.

## Isolation

Temporary diagnostic files live under `tmp/sp-x2-held-aa/`. Every primary
image is captured before the extra diagnostic draws. The probes do not
advance the native frame or clock or move the camera. Temporary GPU
programs, draw hooks and touched GL state are restored; no source or scene
material is changed.

`terms-chromium/reading.json` records eight draws per probe at the same
native state, with 173 calls and 6,576,843 triangles:

| Probe applied only to the left-hand draw | Result in the hand crop |
| --- | --- |
| Original shader | Exact original six pixels toggle |
| Newly linked clone of the original shader | Same six toggle |
| Shadow reception disabled | Same six toggle |
| Receiver-plane shadow depth derivative set to zero | Same six toggle |
| Only `geometryRoughness` set to zero | 8/8 byte-identical |
| Original shader restored | Original six toggle again |

`derivatives-webkit/reading.json` confirms the phone case: the original
shader toggles pixel 569,509 between its exact original RGB alternatives;
zeroing only geometry roughness gives 8/8 identical crops; restoring the
original shader resumes the toggle. Additional raw diagnostic hand pixels
are retained in that reading and receive no inferred qualification.

`packed-chromium/reading.json` supplies affirmative numerical evidence.
The diagnostic retains the original physical-lighting calculation through
a uniform-controlled mix, then writes the low 24 bits of
`floatBitsToUint(geometryRoughness)` to RGB. Those bits change across frozen
draws at the affected fingers. For example, at 566,516 the packed bytes
are **152,43,179 ↔ 70,9,37**. The zero-term probe is again 8/8 identical;
restoring the original shader reproduces the exact six RGB deltas. The
earlier plain 8-bit roughness visualization was stable and was insufficient
to reveal this variation; its raw result is retained too.

## Other causes checked

- These hands are rigid `Mesh` objects, created by `HeldHandParts`, with
  no skeleton or bone texture. Their actual model/view/normal matrices,
  GPU vertex and index buffers and shader sources match.
- The actual GPU uniform values match, including expanded light arrays,
  matrices and sampler units. The old cached-uniform observer omitted
  nested vectors; this investigation reads them through `gl.getUniform`.
- In the failing repeat 0/1 pair in `four-chromium/reading.json`, all
  material textures, the PMREM environment, DFG LUT and all three 2048²
  shadow depth textures have identical GPU-read texel hashes. The material
  maps are single-level 1 × 1 textures. Sampler bindings and parameters
  were checked separately. This is not a late texture-residency event.
- Per-draw readback localizes the six original pixels to `hand-left`;
  subsequent sleeve and right-hand draws do not change them. Disabling
  shadow reception and shadow plane bias does not remove the flicker.
- Repeated original renders in one context reproduce the variation at the
  same frame/clock/camera. No late animation sample or extra gameplay tick
  is needed. The original direct-render protocol has no post-process AO.

## G872 ruling and limits

The coordinator's 2026-11-03 ruling permits the Pine held-finishes cut to
qualify only when before/after differences are confined to exactly the
identified toggling hand pixels in the held views. Every other pixel must
be raw zero, with frame, clock, camera and draws exact. The cut's commit
must record this cause and its evidence path.

**No comparator allowance, shader fix or new pixel class is introduced.**
The diagnostic zero-term shader is not a proposed shipped appearance or a
replacement parity capture. Counter-only Nine A/A qualification is a
separate ruling and supplies no allowance for these pixels or A/B counts.

All finite diagnostic browsers were closed. Raw refusals and the diagnostic
readings remain at the paths above for the Z6 owner. There is no production
source change or new golden to qualify in this evidence-only document.
