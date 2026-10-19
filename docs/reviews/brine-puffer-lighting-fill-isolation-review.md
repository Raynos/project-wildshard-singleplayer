# Brine Puffer: neutral-fill isolation review

2026-10-19 UTC. Independent visual addendum; previous diagnostic and v1 candidate reviews remain frozen.

## Scope and evidence

Inspected all 12 actual paused matched PNGs: angles 000, 120 and 240, each with original-fill, hemi-only, toon-only and neutral-v1. Inspection used labelled creature-region crops arranged four per angle; no recoloring or synthetic frames. This is a still-image comparison, not a video continuity review. Source capture: `tmp/v70-neutral-studio-v1-fill-isolation/capture.json`, SHA256 `8531e5253846ae1edf9444ec05cf76de44989d85fa64e4b17529ca9fcdda2ab6`.

Capture records cloud Chromium on Linux with iPhone user agent, device DPR 3, renderer DPR 2, 780×1688 buffer, one shadow cascade, three enabled passes and no AO. It is not physical-phone or Safari evidence. The capture owner reports fixed actor/bones/camera per four-way comparison and v1 rim held fixed throughout. Thus “original-fill” here isolates fill values and is not an exact reproduction of the complete original lighting profile.

## Findings

- At 120°, original-fill leaves the shadow half of the cream pouch purple/mauve. Hemisphere-only changes it to muted tan while retaining distinct large facet planes, mouth cavity and readable eyes. Toon-only leaves much of the purple tint and adds brown warmth. Combined v1 pushes the same cream further toward yellow/olive.
- At 240°, hemisphere-only reveals dark teal mantle and tail planes that are nearly navy-black in original-fill. Toon-only provides much less recovery of those surfaces. Combined v1 retains the useful teal separation but makes the visible ivory spikes/cheek more yellow than hemisphere-only.
- At 000°, the bright cream side remains readable in every variant. Hemisphere-only reduces the mauve spike-side and underside tint. Combined v1 introduces stronger green/yellow warmth. The dark underside remains distinct; this is not uniform flattening of all facets.
- Fine received-shadow stippling remains visible on the fin in the 120° comparison across all four variants. This fill experiment does not resolve it. Baseline one-factor shadow evidence, rather than these fill images alone, supports investigating received-shadow filtering/bias separately.

## Bounded recommendation

Prefer the neutral hemisphere alone as the cleaner next arena-only color correction, or reduce the additional toon lift substantially. It provides the main visible purple/navy neutralization with less yellow/olive drift than full v1. Retain directional key, recognizable facet contrast and contact shading. A darker turned-away side remains physically expected; the goal is readable material identity rather than identical brightness at every angle.

This recommendation refines the earlier support for v1 as an incremental improvement. Neither the combined candidate nor hemisphere-only is certified as a finished look; remaining hue swing, dark underside and shadow stippling are explicit. No new static likeness score, animation/contact acceptance or device-performance claim is made.

## Exact inspected PNG inventory

- `matched-000-original-fill.png`: 723701 bytes; SHA256 `fd69db40cbb86358dfd7ed690ee0b14d6dae3cadb00138f093a1459806bac61e`
- `matched-000-hemi-only.png`: 730013 bytes; SHA256 `acccb144ca106cad0385fdecd338c080c0bc0ca13a7d2d420c5510ffeb1a793e`
- `matched-000-toon-only.png`: 725279 bytes; SHA256 `dc0b37b490f28c49cc5a3fd7837eeafbfadcde385c580b6e049e4d4d05e4e201`
- `matched-000-neutral-v1.png`: 732138 bytes; SHA256 `5fea1e9ccdac54e897fdd9066cc3d0bbe852ef7e3324afb0c9c769c9cf4a1b59`
- `matched-120-original-fill.png`: 857972 bytes; SHA256 `84397e0eedee4e16fd91181bdf7ff219b4f0efa75a067eb4480b5bb84b200bac`
- `matched-120-hemi-only.png`: 855124 bytes; SHA256 `acd3bb256d813924b7347355901100a3a33a68a89bed4ccf8b9e573cd0ab5b04`
- `matched-120-toon-only.png`: 859891 bytes; SHA256 `52ffef11ab6d44c2686af6adaa6da38f02278b73f955ff5d78629425cf015cad`
- `matched-120-neutral-v1.png`: 855246 bytes; SHA256 `61bf21b1c2ef9ab154005568de4e83a02a135cb74432cf971f6c2a454a9c46ef`
- `matched-240-original-fill.png`: 781207 bytes; SHA256 `1242238f33c6809f85073d5429eef081fa6234378645228a1e35187423215215`
- `matched-240-hemi-only.png`: 798896 bytes; SHA256 `15fd56923155384e36f81761d3f3c620f46be22b82b5f2f5198cfb5f5e4b29a0`
- `matched-240-toon-only.png`: 782573 bytes; SHA256 `990d8692f8988f2ca600d665d2dcf44a21b059fc900a727614edb848575d8a8a`
- `matched-240-neutral-v1.png`: 799115 bytes; SHA256 `794563629a427442572e8094ee3c4fea73d71af271cc01f64acd2d8dd4fd68c2`
