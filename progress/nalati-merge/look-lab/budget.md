# Nalati Look Lab — the phone budget (L4)

Phone tier, 390×844 @3 (the renderer caps it at the tier's 2× render scale), the four first-person camp poses, golden
afternoon, headless Chromium on the Mac GPU (Metal, vsync on): the frame ms are not an iPhone reading (16.7 = keeping up
with 60 Hz); the calls / triangles carry over. Budget: ≤ 150 calls, ≤ 2.0 M triangles.

| pose | variants | p50 ms | p95 ms | calls | tris (M) |
|---|---|---|---|---|---|
| camp-fp-front | none | 16.7 | 16.8 | 74 | 1.05 |
| camp-fp-front | terrainShadow | 16.7 | 18.4 | 74 | 1.05 |
| camp-fp-front | terrainAO | 16.6 | 18.1 | 74 | 1.05 |
| camp-fp-front | modelShade | 16.6 | 17.8 | 74 | 1.05 |
| camp-fp-front | all | 16.7 | 17.6 | 74 | 1.05 |
| camp-fp-left | none | 16.7 | 18.0 | 93 | 1.27 |
| camp-fp-left | terrainShadow | 16.7 | 18.1 | 93 | 1.27 |
| camp-fp-left | terrainAO | 16.7 | 16.8 | 93 | 1.27 |
| camp-fp-left | modelShade | 16.7 | 16.8 | 93 | 1.27 |
| camp-fp-left | all | 16.7 | 16.9 | 93 | 1.27 |
| camp-fp-right | none | 16.7 | 16.9 | 65 | 0.88 |
| camp-fp-right | terrainShadow | 16.7 | 16.8 | 65 | 0.88 |
| camp-fp-right | terrainAO | 16.6 | 17.6 | 65 | 0.88 |
| camp-fp-right | modelShade | 16.6 | 17.5 | 65 | 0.88 |
| camp-fp-right | all | 16.6 | 17.0 | 65 | 0.88 |
| camp-fp-back | none | 16.7 | 16.9 | 63 | 0.86 |
| camp-fp-back | terrainShadow | 16.7 | 16.9 | 63 | 0.86 |
| camp-fp-back | terrainAO | 16.7 | 16.8 | 63 | 0.86 |
| camp-fp-back | modelShade | 16.7 | 16.8 | 63 | 0.86 |
| camp-fp-back | all | 16.7 | 16.8 | 63 | 0.86 |

GPU time per frame (EXT_disjoint_timer_query_webgl2, 90 frames each, the renderer at pixel ratio 2 = 780×1688, camp
fp-front, the Mac GPU while it was quiet): variants off p50 4.19 / 3.80 ms, all three on p50 3.84 ms — the difference is
under the run-to-run noise (later runs were swamped by other agents' browsers: 9 ms p50, 49 ms p95 either way).
The frame-ms columns above are vsync-capped (16.7 = keeping up with 60 Hz).
