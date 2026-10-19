# Minimal normal-bias trial: rejected

The same admitted V70 neutral-studio-v1 product was captured under cloud Chromium's phone policy. All cast and received shadows stayed enabled. The only diagnostic change was normal bias from 0.05 m to 0.06 m. Actual readback confirms unchanged depth bias −0.00012, radius 2 and one 1024×1024 shadow map. No AO exists on this phone policy; renderer DPR remains 2.

Four fixed-world angles compare eight matched stills, with unchanged actor/bone/camera transforms within each pair. Independent review found no meaningful reduction of the obvious fin stippling at 120°, 240° and 300°. There was no obvious large contact detachment, but the dark arena floor limits that judgment. The trial is rejected; no bias source change is adopted. Keep the original 0.05 m setting and leave residual fin shadow stippling open.

The source default comes from skyRig.ts and the standard CSM configuration. The arena has no custom ShadowStyle. Its graph material is flat shaded without a normal map. The node normal path derives geometric face normals from screen derivatives and transforms them to world space for normal bias; the engine supplies the receiver-plane PCF filter to node materials too. No corrupt camera-space normal mapping was established.

This diagnostic ran from 00:49:13 to 00:50:37 UTC, terminal 0, with 261 actual unique rendered-frame samples and zero runtime/HTTP errors. The exact raw capture/video/PNG and script hashes are in the receipt. It is cloud policy evidence, not physical-phone performance, a completed shadow fix or contact acceptance. Normal images remain locally preserved; no video or image encoding is being used to evade the repository's binary budget.
