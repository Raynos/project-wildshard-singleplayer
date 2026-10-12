# Coarse graph mask and compressed-mip proof

E435, 2026-10-12. Baseline `e40cb824fbc6fcc3352a7765554f6795ad7ca544` plus
the source overlay fingerprinted in [summary.json](summary.json).
**Shader fix PASS. Simulator texture veto is correct; retain it.**
This is a focused render/compile proof, with no frame-floor timing claim.
Pine short-travel p95 remains open.

## Shader verdict

The old coarse-prop patch prepends `varying` to a raw GLSL3 program.
GLSL ES 3 reserves that keyword; this is a cross-platform shader bug,
including real iPhone WebKit/Metal ANGLE, rather than a Simulator-only
language issue. Chrome on Metal, desktop WebKit, and Simulator Safari all
reproduced the cold failure. See the
[Khronos GLSL ES 3 specification](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf).

The classic shader source stays byte-identical. Raw GLSL3 chunk shaders
get matching `out highp` / `in highp` declarations and precise uniforms.
The lazy node handler explicitly installs an internal port that composes
the material's existing native `maskNode` with the per-tile predicate.
Node-generated shaders have no classic chunk anchors, so changing only
the varying qualifier would leave the quadrant discard unapplied.

Nine focused checks, root strict TypeScript and touched typed lint pass.
The reusable focused WebKit compile/discard regression passes:

```sh
scripts/browser-lane.sh node scripts/coarse-mask-webkit.mjs
# During an owned quiet, also set WS_QUIET_OWNER to that owner.
```

All four cases (classic, raw GLSL3, pastel graph, ink graph plus outline)
remove each selected quadrant of an instanced mesh. All fixed programs
have zero shader/GL errors. Classic source and the pixels of previously
compiled unmasked surfaces match exactly before/after on all three
surfaces. Simulator's new coarse variants also match their unmasked
controls with zero differing bytes. The desktop overlay bench's restored
pastel coarse variant differs from its unmasked control by one byte in
one pixel; the committed WebKit regression has zero such differences.
That additional control is recorded, not rounded away.

A warmed unmasked node program can hide the old bug through a cache hit.
The proof releases that program before compiling the coarse variant.
Simulator captures use a fixed iPhone 16 Pro profile, 402×874 CSS pixels
and an 804×1748 buffer (2×), avoiding Safari toolbar height changes.

These are isolated, real renders of the authored rock graphs on four
instanced 3D rocks, using the same compiler, renderer and mask path.
The old failing draw leaves the clear background; neither shader nor
authored graph was changed to manufacture a comparison image.

| Graph | Before | After |
| --- | --- | --- |
| pastel-plain | [Failed shader](pastel-plain-before.jpg) | [Native mask](pastel-plain-fixed.jpg) |
| ink-cel-valley | [Failed shader](ink-cel-valley-before.jpg) | [Native mask](ink-cel-valley-fixed.jpg) |

All four images have burned-in labels, are portrait, and are below 500 KB.

## KTX2 verdict

The Simulator advertises ASTC, ETC2 and ETC1; it does **not** simply lack
those extensions. Its sampled results are unsafe. Independent controls
use separate single-level and four-level immutable textures, known
blocks, an explicit mip LOD, and individual RGBA8 readbacks. Every upload
and draw reports zero GL errors. The exact colors are in summary.json.

| Format | Single level | Four-level chain |
| --- | --- | --- |
| RGBA8 | correct | all levels correct |
| linear ASTC | correct | all levels correct |
| sRGB ASTC | correct | level 0 correct; levels 1–3 zero RGBA |
| RGB-only ETC2, linear/sRGB | incorrect RGB | incorrect level 0; lower levels zero RGBA |
| ETC2/EAC RGBA, linear/sRGB | correct | level 0 correct; levels 1–3 zero RGBA |

These controls agree with the production probe. Desktop WebKit and Chrome
pass all twelve production formats and the independent controls. The
Simulator's ASTC family is vetoed because its sRGB member fails even
though linear ASTC survives. ETC2 also fails, while BPTC/S3TC/PVRTC are
unavailable there. Auto→Images therefore remains correct; the existing
linear-ASTC fallback capability remains intact. No probe logic changes.

Real iPhone hardware supports these compressed families: Apple's
[Metal feature tables](https://developer-mdn.apple.com/metal/Metal-Feature-Set-Tables.pdf)
list ASTC and EAC/ETC for Apple GPU families. WebKit ANGLE also has
[Simulator-specific format mapping](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/mtl_format_table_autogen.mm)
and [Simulator-specific capability handling](https://raw.githubusercontent.com/WebKit/WebKit/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/DisplayMtl.mm).
The evidence points to the Simulator backend, not absent iPhone formats.
This proof contains no physical-iPhone readback, so it does not claim a
measured physical-device PASS. The unchanged per-context probe protects
the actual phone as well: it enables only families that sample correctly
on that device, with no Simulator or user-agent exception.

Quiet reserved after x2's explicit aerial cleanup plus the 120-second gap;
proofs began only after the authoritative push lock released. Both
Simulator legs and every browser/preview process closed before release.
