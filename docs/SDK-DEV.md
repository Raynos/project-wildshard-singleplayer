# Build and preview an author project

Use the installed SDK's `wildshard dev <project> [port]` to preview the normal
game client with the project's shardfile. Port 0 (the default) chooses a free
local port. The CLI prints the URL. It validates and builds a static product;
editing config, data, behaviour or source assets rebuilds it and reloads the
page. A failed rebuild keeps the last good product visible and reports the
error. Ctrl-C closes the watcher, HTTP server and temporary products.

The SDK distributes two compiled clients. `wildshard build` copies the
production client; `wildshard dev` copies the author client compiled with
`__DEVSERVER__=true`. A build option can choose a client directory or skip
copying the client (`buildProject`'s third argument, `{client:null}`), for a
repository that already builds its own normal game bundle. The immutable
shard data/asset product is the same format in both modes.

In this repository, `scripts/serve-build.sh --devserver` builds the game in
that mode and serves the resulting build. Without that flag it uses production
mode. There is no Vite development server. `__DEVSERVER__` is a build define,
with its declaration in `src/engine/build.d.ts`; URL parameters, storage and
requests cannot enable it in a production client.

`build-flags.json` records the mode, and each entry chunk carries its exact
runtime stamp. `node scripts/check-devserver.mjs <output>` refuses enabled,
missing or unsubstituted flags in a production artifact. The revision polling
endpoint and reload script exist only in the author server's disposable HTML.

The headless loader and collider edge walk extend `wildshard validate` at
SF8c's remaining composition step. The normal full loader supplies the same
colliders and simulation systems; validation must not substitute empty
geometry for authored content.
