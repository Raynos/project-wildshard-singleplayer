# V23 Puffer candidate: implementation unaccepted

Build target: `../concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`, one of the five revised mockups explicitly approved by the owner. That approval does not accept this mesh.

V12 failed with an open hanging facial mask. V13–15 established a closed hull and coherent color regions. V16 failed eye containment; V17–19 exposed cross-view occlusion. V20–21 restored readable front/hero pupils using actual hull-surface frames, outward iris recentering, containment and visibility rays. V22 failed with a projecting cream visor. V23 reduces the lip to an integrated upper-mouth arch and restores six buried crown/shoulder spines plus a visible ochre tail-face border.

Actual V23: 5,732 triangles, 17,196 native triangle-corner vertices, eight joints, 35 native parts, one material. GLB 520,584 bytes; native JSON 2,469,432 bytes. The native codec check passed independently; this does not establish visual quality or arena animation acceptance.

Known visual gaps: thin foot profile, unfinished nose/nostrils and inner mouth, insufficient brow relief, and remaining target silhouette/material differences. Crown/feet/tail need deformation inspection. No implementation 4/5 or 5/5 claim.

Rig: body → belly → head; tail and feet remain body children. Absolute pivots are preserved. Final generated vertices are explicitly assigned their part’s rigid joint. Head must remain at bind transform for the initial belly inflation proof; old head offsets and old 1.57 swelling are unsuitable. Native consumer resolves the exported bone names/order. Native export conversion and linear RGB/weights are handled by `native_export.py`.

All earlier studies remain preserved. Heavy Blender scene files and full PNG renders remain in ignored build output directories.
