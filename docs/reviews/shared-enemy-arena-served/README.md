# Shared arena served composition

The production mount is `/shared-arena/`. The exact 93-file candidate is 5,134,163 bytes; `manifest.json` pins every file. This is a single engine, canvas, physics world and encounter, with four admitted opponents. Bellback remains unavailable. All candidates remain unaccepted WIP.

`build-served.mjs` is a separate bounded delivery build. It preserves the frozen source and admission rules, reruns current SDK validation, and verifies exact retained bytes before routing the four product bases, body meshes, first-person arms and Rapier to their existing same-origin engine URLs. Vite's normal asset-URL hook similarly routes the exact Basis transcoder WASM. All JavaScript stays in this mount's own namespace. No old JavaScript, global fetch interception, service worker, compression workaround or historical-host mutation is used.

## Verification

- Final mounted browser QA passed 33/33 checks, with zero page errors or missing requests.
- All four opponents caused and received real damage. Start, change opponent, Retry, Back, reentry and reload passed, preserving one runtime and empty persistent stores.
- The browser fetched and SHA-verified the routed Basis WASM. These texture-free fixtures do not exercise actual Basis transcoding.
- The earlier full-cycle proof passed 49/49 kill, reward, loot, player-defeat and Retry checks on build3, whose runtime bytes equal build4. The served candidate did not repeat all complete cycles.
- After normalizing only content-hash import filenames, all JavaScript matches build4 except boot's explicit URL mapping and runtimeProduct's Basis URL. The latter was mechanically verified to be exactly one URL-expression replacement. Gameplay source is unchanged.
- Cloud portrait Chromium is functional proof, not physical iPhone Safari, animation or performance acceptance.

## Reproduction and publication handoff

Run the established heavy build wrapper with `node scripts/shared-arena/build-served.mjs <retained-site-dist> <fresh-output>`. Then run `scripts/shared-arena/qa-served.mjs <candidate> <fresh-qa-output> <retained-site-dist>` through the established browser wrapper and installed headless shell. The QA server mounts candidate bytes at `/shared-arena/` and serves other URLs from the read-only retained Site.

The parent owns Site publication. Copy the manifest-pinned candidate into the Site's `shared-arena/` directory, preserve all route targets in `routes.json`, and make the existing single arena entry point lead to `shared-arena/arena.html`. Recheck the actual final combined Site archive cap and public lifecycle before promotion. No Site files were changed by this lane.

The original first draft failed build-time TypeScript parsing inside a Vite transform; it was corrected to emit JavaScript. A second, valid candidate passed mounted QA before the additional exact Basis WASM reuse was added. Final proof is `qa.json`, not those predecessors.
