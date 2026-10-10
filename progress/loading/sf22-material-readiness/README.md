# SF22: prepare asynchronous material samplers before entry

The dab8f21 source-mapped diagnostic identified Signal's late first-draw upload
by exact ImageBitmap identity: `sunscar.fire.book`, ShaderMaterial `uBook`,
2048 × 2048, 34.7 ms. Uniform collection already worked; the fire effect launched
its fetch without putting it on any preparation barrier. It published after the
sampler scan, so the first visible draw performed the upload.

The renderer now awaits registered pending material resources before compiling
borrowed jobs. The generic weak registry starts no fetch, allocates no texture,
and drops settled work. The shared fire effect registers its existing fetch/decode
promise. Its failed fetch still selects the procedural flame, and its existing
generation fence prevents a retired load from publishing. Shader preparation's
owner fence applies again after the wait. The ordinary upload pass then discovers
the exact sampler. Pixels, shader source, flipbook timing and sampler settings are
unchanged; no shard source, collider, map or witness payload is changed.

Focused checks cover delayed publication before compile/upload, unchanged Signal
shader sources and samplers, procedural failure fallback, successful decode after
retirement, owner cancellation, and resources registered during an earlier wait.
Existing injected-texture preparation and Signal shader-row fixtures also pass.
Touched typed lint and strict checking against committed public package exports
pass. Game → engine +1 (`render/materialPreparation`); no upward import or look
change. Browser re-measurement remains open; this is a scheduling fix, not yet a
new crossing-time verdict. See the road-cull receipt for the exact diagnostic build
and remaining boot owners.
