# Source-only author generation

Build-time SDK capabilities, part of the [engine manual](ENGINE.md).

Build functions receive `ProjectGenerationContext` from
`@wildshard/sdk/projectGeneration`. `cached({id, inputs, native}, fn)` returns
detached bytes keyed by bundled source, compiler, explicit inputs and native
host; hits still read inputs. `asset(bytes)`
publishes owned bytes. Injected `compileScript`, `compileScriptV2`,
`compileDecisionScripts` and optional `compileDecisionRows` compile without
author filesystem/compiler imports. Compiler dependencies enter cache keys.
An output sidecar may export `prepareOutput(ctx)` alongside `output`; its
result crosses product admission, keyed by config and sidecar source.

`proveStaticPortalEntries(shard, pieces)` is an uncached build capability for
static portal links. It admits the shard, installs the declared baked pieces,
walks the real capsule routes and returns lane, step and transfer counts. Each
call owns a fresh native physics world and disposes it on success or refusal.
Ordinary edges and moving entry routes retain their world-specific proofs.

`readImagePixels(bytes, {flipY?})` is the existing bounded still-image decoder
injected at build time. It returns owned RGBA pixels; Sharp stays outside
author module bundles. Programs may decode freshly and include the measured
pixel/dimension identity in a cached packing step, preserving invalidation
when decoded pixels change without adding a source-tree handoff.

`bakeForestPlacements(source, variants)` from `@wildshard/sdk/bake/forest`
uses the engine's defining forest algorithm with explicit seed, count, policy
and native terrain queries. It returns owned numeric tree records (RGB tuples,
not runtime color objects) and the original padded spatial query over those
same records. Nothing selects a level or installs terrain. The author owns
the result and keys its native cache on all supplied source policies/samplers.

`bakeMeadowField(source)` from `@wildshard/sdk/bake/meadow` bakes the
original four-metre, eight-channel meadow lattice from explicit native
samplers and authored policy. It returns an owned numeric snapshot and the
original field queries; snapshot edits do not change query state. Independent
builds share no mutable samples and never configure the page grass singleton.
The author includes all supplied policy/samplers in its native source cache.

`inputFiles(prefixes)` lists current file URL names beneath the context's
explicit input roots without reading payloads. It accepts at most eight
nonoverlapping directory prefixes and returns at most 4,096 sorted names;
traversal is bounded to 4,096 directories and depth 32. Symlinks, duplicate
prefixes and escaped paths refuse. Directory reads enter the existing product
input receipt, so additions and removals invalidate old presence facts.
Older context adapters may omit it; programs requiring current inventory must
refuse that absence. This build capability installs no runtime service.

New named JSON uses `namedJsonSchema(schema, {provenance: true})` with an
exact defining format root. The generated build-only schema catalogue checks
both its identity and full schema structure; a source label alone grants
nothing. Existing names stay under the shrink-only CS0 inventory, while new
`custom/` sections refuse. Default schema emission preserves existing bytes.

A build function may return a shard declaration or `GeneratedProject`:
`{shard, output}`. The latter carries `ProjectOutput` named files and platform
sections produced by that same invocation. Root and sidecar output exports
cannot compete with it. Both forms cross the same shard, decision, asset,
source-budget and output admission checks; no intermediate metadata file is
needed to pass a generated hash to its consumer.

`GeneratedProject.discovery` supplies computed discovery data alongside the
product. The builder admits bounded JSON bindings, detaches their values and
stores them with a canonical hash in the existing validation receipt. Discovery
emission consumes only a current verified product and inlines those literals;
it adds no runtime section, asset or source-file handoff. Missing or invalid
program bindings refuse. Executable generator references remain forbidden in
authored discovery metadata.

`encodeBuildBytes(input, codec, level?, deflateBackend?)` in `@wildshard/sdk/bake/byteCodec`
provides deterministic build-only compression for cache-owned results. Deflate
defaults to level 9 (range 0–9); Zstd defaults to level 19 (range 1–22). Deflate
keeps the portable backend by default; an explicit `native` backend preserves
Node zlib streams and must use a native build-cache step. The backend is refused
for Zstd. Inputs
must be unshared, attached byte views of at most 256,000,000 bytes. It copies
the selected view and returns independent bytes, without installing a service
or adding runtime decoding or asset authority.

`bakeRawColourPixels(image, options)` in `@wildshard/sdk/bake/rawTexture`
packs bounded, unshared RGBA pixels into the existing single-level Zstd
KTX2 format. It keeps the supplied row order and explicit linear/sRGB
transfer without loading an image decoder or a filesystem service. The
existing image-file adapter retains its decoding and flip semantics and
uses this same packer. Both paths preserve the original complete bytes.

`GeneratedProject.map` supplies a 1000 × 1000 RGBA lattice and optional
logical name. `@wildshard/sdk/bake/groundMap.rasterGroundMap` paints actual
L0 terrain and placed GLBs; `rasterSceneMap(settings, readers)` adds declared
props/private scenes using owned bytes and decoded JSON. Readers retain
model URL authority; neither operation infers file roots. Both preserve
integer coverage, height order, ground palette and relief. The SDK encodes
lossless WebP into the charged product. Build/read-only lookup share the
current world-input key from `--generated-map-tiles-hash`. Missing/invalid
lattices or competing images refuse. Source maps bypass legacy jobs/stamps;
legacy images retain their pixel check. Authored minimaps pack the same
in-memory bytes; the builder then publishes the verified product image and
receipt at its existing URL. No shard-source metadata is emitted.

`@wildshard/sdk/bake/mapAssembly.MapAssembly` collects ordered map shapes
and their float32 instance placements. `pack()` returns independent scene
JSON and raw packed geometry bytes without compression, file reads or
publication. The caller retains geometry/material disposal ownership.
The retained Node map adapter uses the same packer and applies its original
zlib compression and file publication afterward.
`mapModelBytes(bytes, slot?, world?)` in that module decodes one prepared
GLB mesh with its original vertex/index order. Local geometry is the default;
an explicit world flag applies the selected node's world matrix. External
GLB resource URIs refuse; file adapters must supply every input byte.

A cached step may also name a public asset URL beneath an input root explicitly
supplied by the CLI's manifest intake. Each URL must select exactly one root;
traversal, encoded separators, ambiguous roots and symlink escapes refuse.
The bounded bytes are detached and hashed on every hit, like project-relative
inputs. No repository layout, shard name or ambient parent path grants access.
