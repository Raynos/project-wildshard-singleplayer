# Static world material and atlas packing

The shared SDK path is `@wildshard/sdk/bake/staticMaterials`. Native-lattice ground and captured authored props share one final GLB per tile address, then `WorldBakeRows` hashes and charges that GLB and its distinct dependency closure. Each primitive retains its own material name; `props.family` is only the old-path fallback. Named packing never assigns the terrain material to unrelated props.

Capture while the original material and geometry are alive. `captureStaticMaterial(material, {name, id}, imageIdentity)` copies the actual Lambert/PBR factors and supported texture slots. `name` is a stable authored model/piece-and-slot name, including for unnamed generated materials; it is never a Three UUID, capture-order ordinal or an inferred family. `id` names the shard's explicit admitted `look.materials` recipe. A shard owns the shader tuning: the packer does not infer painterly parameters from `MeshLambertMaterial`. Family base colour multiplies the captured GLB colour, so a neutral base preserves the source factor; any additional tint is an authored choice. Graph surfaces require an explicit factor-binding adapter and are currently refused by this packer.

The image-identity callback receives the actual texture and slot and returns `{id, width, height}` for the complete original bitmap/atlas. The snapshot also carries UV channel, wrap/filter converted from Three to glTF enums, anisotropy, raster orientation, normal scale and occlusion strength. UV0, identity texture transforms and scalar tangent-space normal scale are supported. Unsupported state/maps refuse explicitly. Blended and masked surfaces, emission, sidedness, source vertex-colour use and authored flat normals survive the supported transport. HDR emission and unsupported custom surface behavior need an explicit adapter, rather than a guessed replacement.

An atlas must come from its original bitmap or the real raster producer with the same fonts, pixels and full dimensions. The Node bake host's non-drawing canvas supplies construction APIs only; its pixels cannot stand in for a generated sign atlas. Missing original pixels block that material. No atlas crop, UV repack, texture-to-vertex-colour conversion or flat-colour substitution is permitted.

Encode each original PNG/JPEG/WebP with `bakeWorldTexture(bytes, role, {flipY})`. Colour/emissive slots use `srgb`; normal/metallic-roughness/occlusion use `linear`. A captured Three `flipY:true` flips raster rows before encoding to the glTF/KTX2 convention, retaining the original UV rectangles. The encoder emits complete mip chains. Pre-encode asynchronously, then supply the resulting immutable KTX2 bytes to the synchronous catalogue resolver. Resolve by original image identity, role and orientation, not a texture UUID or filename guess. The catalogue checks the role, complete admitted KTX2 and captured dimensions. One output file may have only one sampler and colour/data role; equal bytes are deduplicated.

```ts
const catalogue = new StaticMaterialCatalogue(capturedSlots, admittedLook.materials,
  (source, role) => encodedOriginal(source.image, role, source.flipY ?? false));
try {
  // materialNames follows the actual source mesh material array, not traversal order.
  const primitives = catalogue.primitives(geometry, materialNames, { instances });
  // Combine these with the ground primitives BEFORE staticGlb, one GLB per address.
  const bytes = staticGlb(primitives);
  const names = staticMaterialNames(bytes);
  const dependencies = catalogue.dependencies(names);
  const snapshot = catalogue.snapshot();
  for (const texture of snapshot.textures.values()) rows.asset(texture, 'ktx2');
  rows.tile({ lod, x, z, bounds, bytes, dependencies });
  const packed = rows.finish(groundMaterialId, { materials: snapshot.materials });
} finally {
  catalogue.dispose();
}
```

`primitive(name, geometry, options)` accepts an already resolved single material slot. `primitives(geometry, names, options)` splits an actual multi-material mesh by its complete triangle groups and rejects gaps, overlaps and unknown slots. Original positions, UVs, normals, custom attributes and instance transforms remain intact; a declared flat-shaded source gets a separate owned face-normal geometry. Input geometry is borrowed. The catalogue disposes only its transport materials and owned geometry copies, never the source mesh/material/texture.

The snapshot is the compiled `props.materials` name → look ID and KTX2 sampler map, plus owned immutable texture bytes. Every GLB directly declares every texture used by its own material names. A texture used by a different tile does not satisfy that requirement. Pack textures first; use `catalogue.dependencies(staticMaterialNames(glb))` for each GLB and `finish(family, {materials})` to check all names and dependencies. The final full shardfile asset validator remains required. Dynamic objects, panels and colliders retain their explicit existing ownership; this packing step does not duplicate them, allocate collision or switch a live boot path.

For native render terrain, call `simplifyNativeLatticeTile(tile, targetRatio, maxErrorMetres)` from `@wildshard/sdk/bake/worldLod` on the clipped L1 tiles before writing GLBs. The pinned meshoptimizer locks tile and hole borders and keeps the exact original values of every surviving vertex and custom channel. All channels participate with unit weights; more than 32 scalar components refuses rather than dropping channels. It returns owned tile arrays, actual triangle counts and an absolute appearance-error estimate including float32 measurement conversion. That estimate is not an independent Hausdorff measurement. The ratio is a target: borders and appearance error may retain more geometry. L0 and original native collision remain unchanged. Charge actual emitted geometry and distinct texture dependencies, preserving shipped compressed textures and instance records; partitioning alone is not a memory saving.
