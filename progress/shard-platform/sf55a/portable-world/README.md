# SF55a portable authored world proof (E435)

An outside-repository project installed `@wildshard/sdk` from its packed tarball and built with Node alone. Its only author inputs were `shard.config.ts`, an ordinary Blender-exported GLB, and the declared AssemblyScript door source. No repository baker, project generator, Blender process or native texture encoder runs during the consumer build.

`node scripts/test-sdk-authored-world.mjs <receipt>` creates the isolated consumer, installs the tarball, builds twice, hashes every output, validates all native entry lanes, then opens and closes the compiled door on the public Node host. See [tarball.json](tarball.json): 152 identical product files, two embedded-image KTX2 textures encoded by the pinned WASM encoder, one independently controlled panel/collider, 64 collision tiles and 80 render tiles; 92 lanes / 46,099 capsule steps pass. Memory numbers are admission estimates, not physical-phone measurements.

Focused checks cover source-path confinement, named material refusals, source compiler identity and errors, clipped Float32 slivers, world row validation and real door events. Pinned AssemblyScript/Binaryen compilation retains the existing metered fixture hash. Witness checkpoint manifests are refreshed for the lockfile change; all committed compressed payloads are byte-identical.

The Blender Template level and its browser/frame proofs belong to SF55 and are separate from this importer receipt.
