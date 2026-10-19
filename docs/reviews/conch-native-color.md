# Conch native authored-color candidate

2026-10-19. **Source candidate prepared; unaccepted, not built or captured.** Retained native appearance remains **64.75/100 (3.2375/5)**. Source-model static likeness remains its separate **4.05/5** result. This candidate has no visual score.

## Bounded change and support proof

The new isolated `art/driftwood-isle/approved-conch/selected-native-color/` candidate implements the [shading diagnosis](conch-native-shading-diagnosis/REPORT.md): every native part gains an `aAuthoredColour` Float32 vec3 copied from its already-admitted linear `color` bytes. The existing graph's `paint` node alone becomes an attribute lookup. All material tint multiplication, toon shading, roughness, emissive, flat shading, sidedness and light settings remain unchanged.

Support is existing, not an exemption: `packedCreatureBodies` declares arbitrary attribute names and f32 widths, copies each declared channel, and its actual consumer test admits all 15 parts. `validateGraph` admits the attribute node and the real `compileGraph` and `EngineNodesHandler` generate GLSL with `in vec3 aAuthoredColour` and the attribute-to-varying assignment. This CPU shader generation is not a GPU render.

## Evidence

- Original decompressed native payload is an identical prefix of the candidate. Every old part row and offset is recoverable exactly by removing the one appended attribute/offset. All bones, dimensions, positions, normals, colors, skin indices/weights, fur lengths, groups and triangle order remain identical at admission.
- Real `mergeAnimalGeometry → facetGeometry → oneMaterial` preserves all **19,710 authored color components exactly**. Every original runtime attribute, group and bound remains exactly equal to the original default-faceted path. The legacy `color` channel still has all 19,710 components jittered; this candidate does not disable or change faceting.
- The full candidate source catalogue equals the retained selected-native-view source except the single creature paint node. Its SDK product factory reuses the original REST pose/output, decisions and neutral-gray-v2 lighting and keeps actual product admission.
- Deterministic Python roundtrip checks reproduce metadata, compressed payload and graph byte-for-byte. Strict metadata still rejects an added `facetJitter` control and graph validation still rejects invalid attribute naming.
- Added raw bytes: **78,840**. Candidate compressed payload: **47,157 bytes**, SHA-256 `640861d7e12003814917b45d38d622a3e796084cf0b86bf88d01353ecfdc4cbb`. Metadata SHA-256 `99a4920df2bb3fa4368e456b38b40e27e85d905bcccdee8e93776bf0902ae219`; graph SHA-256 `6f8e43b848546c5cd99e3da32a89913450d2fda66dd9803e80d522bffa0e9b97`.

Test commands and results live alongside the candidate. Python: 3 checks. Focused Vitest: 6 checks. The first pnpm launcher failed before running tests because its automatic install tried an unavailable home store; direct invocation of the already-installed Vitest succeeded. A first GLSL assertion expected GLSL1 `attribute`, but the real handler emits GLSL3 `in`; the corrected exact declaration/assignment assertion passes. Both failure logs are retained. Oxlint reports no eligible art files, so this is **not** a lint or full typecheck pass.

## Scope and next gate

No shared source, old pins, acceptance, public host, lighting, tint, geometry, skinning, AI or gameplay was changed. The factory is ready for a newly pinned isolated SDK product build under root's heavy-lane authorization. No candidate host build or capture ran in this work.

Require a complete actual paired nine-view REST capture with preserved camera/root/light contracts, post-facet authored-channel verification in the actual host, and independent native-first concept review. Keep native tint/Toon versus source Standard differences, the 25 triangles with directional normal differences, unresolved stippling, animation, combat readability and phone performance open. A smaller pixel difference is not a visual quality pass.
