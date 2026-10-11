# Configs describe; generators compile and write (OS-G2)

Run `npm run generate` before `wildshard synth`, `build`, `validate` or `dev` on an author project. The reference `generate.ts` compiles typed AssemblyScript with `generateScriptModule` and `compileBehaviourModule`, writes its SHA256 asset and generated JSON metadata, and exports the world GLB. These are Node operations in a retained generator.

`shard.config.ts` is bundled into one data-URL module. It computes and exports serializable declarations, imports generated JSON metadata and names project-relative assets. It may construct a scene in memory for `synth`. It does not write files or invoke the compiler. Filesystem or compiler imports left in its executable bundle refuse with a `generate.ts` diagnostic before the config runs; a data URL has no filesystem-relative module directory.

The reference package's build/dev scripts run generation first. For synth use `npm run generate && npm run synth`. `wildshard build` also compiles explicitly declared `behaviour/build.json` or exported `behaviour` source rows through its own confined compiler; that supported declaration path needs no compiler call in config. The CLI does not execute arbitrary `generate.ts` automatically.

Generated metadata carries a DO-NOT-EDIT notice; the readable generator stays in source. Missing metadata is a generation/setup error, never grounds to invent an asset hash or skip byte admission.
