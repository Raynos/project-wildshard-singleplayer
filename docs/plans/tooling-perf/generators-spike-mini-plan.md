# Generators spike and redesign: mini plan (TOOLING-PERF, G648/G650)

**State:** `draft` 2026-10-23 — a plan-agent subagent spikes it (starts when a subagent slot frees); rows and decisions
follow from its findings. Separate from the [gen speed plan](gen-mini-plan.md) (caching and timing) and the
[TypeScript plan](typescript-mini-plan.md).

Jake, 2026-10-23: *"It sounds completely fucked that the generators are reading the generated output of other generators.
Like, can't I just import the TypeScript and like call functions? … I feel like each generator should be a standalone
program. Like the whole generator repository should be a standalone program, or like one fucking massive generator program
that like tries to generate everything at once. That's not like 20 generator programs that run in some arbitrary order that
must import each other's temporary outputs in the correct order … what is this dependency hell? Why are they doing imported
files? Why can't they import the source code?"*

## What we know

- `pnpm gen` writes 318 `*.generated.json` into `src/shards/<slug>/data/` (git-ignored); ~189 generator `.ts` files
  statically import other generators' outputs (Pine 65, Sunscar 30, Sky 28, Driftwood 28, Nalati 21, Nine 17).
- Example chain: `nine-dragon-stack/generators/bake-casts.mjs` writes `castHook.generated.json` (29 MB, base64 GLBs) →
  `castSources.ts` imports it → `worldScenes.ts` → `build-shardfiles` packs `public/shardfiles/<slug>/`.
- The importing makes TypeScript and typed lint read ~250 MB of baked data (about half the time and 4+ GB, G643).

G650 (Jake): *"Writing generated JSON files into the data directory of the shard … we need a complete redesign of how generators work and the source code of shard files work and the data and the generators."* Binaries stay out of JSON (G649).

## The spike answers

1. The real graph: every generator, what it reads and writes, the order `pnpm gen` / `gen-api.mjs` runs them, and why
   (costly bakes cached as files? GLB / image / model steps that can't run in-process? historic accident?).
2. For each file-to-file edge: could the consumer import the producer's TypeScript and call a function instead? What
   breaks (cost, cache, determinism, native tools like Blender / gltf-transform / KTX2)?
3. Which outputs are binaries in JSON (base64 GLBs) and which are real data.
4. Options, sized: (A) one generator program per shard: source in, shardfile out, in-process calls, a content-hash cache
   only around the truly expensive steps (writing binaries as `.glb`/`.bin` in a cache directory outside `src/`);
   (B) one program for the whole repo; (C) keep the files but move them out of `src/` and read them at run time.
5. A redesign of the shard folder: what is source (authored data, code), what is generated, and where generated output and caches live (never under `src/`).
6. A lint ban: no import of a `*.generated.*` file from `src/` or `test/` (and no generated file under `src/`).

## Rows (to be drafted from the spike)
