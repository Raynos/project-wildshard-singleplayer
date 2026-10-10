# G292 Driftwood producers

Report-only; all committed outputs retained. Darwin arm64. Browser capture pin 1090df8a2b5b6b65b251922068c5d9fdd9ea66b9. Node proofs used immutable captured input closures (cache keys below), with only the optional force-write tool change. No collider or runtime change.

| Job | Outputs | Cold backend ms | Warm backend ms | Forced backend ms | Exact |
|---|---:|---:|---:|---:|---|
| driftwood-navmesh | 1 | 42.003 | 0.390 | 35.629 | cold/warm/forced full hashes |
| driftwood-fixed-models | 39 | 1416.780 | 13.889 | 1342.507 | cold/warm/forced full hashes |
| driftwood-physics | 1 | 8114.347 | 1.507 | 8577.108 | cold/warm/forced full hashes |
| driftwood-spots | 1 | 8293.799 | 0.504 | 7668.686 | cold/warm/forced full hashes |

Fixed models (32 GLBs + 7 JSONs) and navmesh JSON match all committed bytes. Physics and spots match every committed gameplay field; only top-level revision/build/input-hash provenance differs. Cold and forced captured files match **every byte including provenance**; warm hits verify all file hashes. Inputs include the full pinned source/public closure and Chromium executable digest. The preview build is fenced before/after capture. No native memory/fps claim.

One working-tree fixed-model forced attempt was rejected because src/engine/strings.ts changed during the job; nothing published. The subsequent proof freezes and verifies the exact source closure before the three calls. That failure is preserved here rather than counted as a successful run.

The fixed-model writer accepts --force-write only for isolated comparison, avoiding an equal-file write skip for imported schema seeds. Default behavior and output bytes are unchanged. Seed outputs are explicit; all other output files are removed in the isolated source tree before the producer runs, and every declared seed must be written.

Cache keys:
- driftwood-navmesh: `e29d2ea15c8adaf099cc37e02c3c4c02c1dd6b3c5a8c0873d93266addbad4f56`
- driftwood-fixed-models: `5e5ae1cc54c506716cb5efea0953cfd06299a9953dc1fb3d15d05275685840bd`
- driftwood-physics: `502c86bc410f806514ee0dcc66461cfc8e59d74a7d8552444b8d06d0656a7399`
- driftwood-spots: `64fb412f557c972d6ac8d21ea3d9fe2f95405387cdf186012ecdb0b60c77e8fd`
