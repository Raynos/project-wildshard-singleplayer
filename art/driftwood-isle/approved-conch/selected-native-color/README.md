# Conch authored-color candidate (unaccepted)

One isolated candidate using existing packed-body attributes and material graphs. No engine, schema, admission, source host, shared graph or existing pin is changed. The payload appends exact Float32 color bytes as `aAuthoredColour`; the old uncompressed payload is an identical prefix. The candidate graph changes only `nodes.paint`. Actor tint, toon response, flat normals, side, all geometry/skin channels, REST pose, lights and decisions stay as before.

`conchColorPreview.ts` exposes `createConchColorSource()` and `buildConchColorProduct(project, destination, options, bodies)`. The latter follows the original SDK product preparation and validation and accepts this folder's metadata. It does not publish, replace a host, or authorize a build. Pass this folder's payload with its content-addressed metadata URL when mounting the product. Never substitute this graph onto other species lacking the attribute. No default-value fallback is declared.

## Checks from repository root

- `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s art/driftwood-isle/approved-conch/selected-native-color -p 'test_*.py' -v`
- `node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/approved-conch/selected-native-color/vitest.config.ts art/driftwood-isle/approved-conch/selected-native-color/color.test.ts`

The Python rebuilder tests deterministic bytes in memory; `prepare.py` refuses to overwrite existing generated outputs. Input hashes cover the retained native input, graph, original factory, poses and the relevant engine/format implementations.

## Next gate

Root controls the heavy build lane and build authorization. Before capture, freeze the complete candidate factory/build inputs, use a new isolated host destination, validate the emitted SDK product and confirm that product's only graph change is the paint node. Reuse the retained nine-view REST camera/root and shared-light capture contract. Actual paired captures and independent native-first review are required before any quality score. Neither tests nor generated GLSL prove rendered appearance or gameplay acceptance. Keep all prior captures and scores untouched.
