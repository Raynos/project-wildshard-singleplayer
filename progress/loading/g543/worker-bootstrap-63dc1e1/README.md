# Tiny worker bootstrap proof

Source: 63dc1e12b4886139a525b726884f4b529d8b0919.
Maintained native regression: 8c1c7c4fcc3320c886b960f5776e2d955148840e.

The production generator emits a 95-byte sw.js importing its complete
worker core from a SHA-256-named path. sw.js retains no-cache and ETag;
the core has a one-year immutable policy. Registration keeps all-mode
update checking. The wire denominator remains actual response bodies
plus actual response headers, including browser-owned requests.

The real preview regression checks core HTTP headers, Origin invariance,
unchanged conditional 304s, and a same-length changed script's full body.
Strict type-aware lint and both focused tests pass.

The native Safari regression runs through sim-lane on an isolated local
fixture using the production bootstrap generator. Unchanged same-process
and restarted-browser updates request only the tiny bootstrap; no core
body is fetched. A same-length changed core gets a new SHA-256 path,
transfers in full, and changes the version observed by the controlled
client from first to other. The native receipt retains every request.

These prove update/cache behavior. Full cold/warm game byte and cadence
acceptance remains a separate served-build measurement.
