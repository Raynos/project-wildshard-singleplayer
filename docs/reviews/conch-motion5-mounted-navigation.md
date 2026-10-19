# Conch motion5 mounted navigation repair

2026-10-19. Local QA only. No build, candidate, engine, existing script, pin,
Site file, production asset or prior evidence changed. No publication or acceptance.

## Result

The navigation repair works. `mounted-run2` exercised the actual unchanged
homepage Arena link, five-enemy selector, Conch button, and embedded native
Start button on desktop and iPhone 16 Pro Chromium emulation. Each selection
had zero engines before choosing and exactly one mounted Conch engine afterward.
The final receipt exits 1: **counterPending and counterObserved remain false**.
Four guard attempts are preserved; their finite failure does not establish
unreachability. All other 37 checks pass. There was no fatal exception.

The Site deliberately retains its Motion4 title/card. Only the loopback
`/conch-engine/` mount serves exact unaccepted motion5 bytes for this QA.
The captured embedded overlay identifies motion5. This is not a public host update.

## Test-only repair

New ordinary test source: `test/conch-motion5-mounted-unified.mjs`, outside
unchanged buildInputs inventory. It imports and calls the unchanged strict
`verifyMotion5CaptureIdentity` before and after the run. No identity waiver,
new pin or build is involved. The exact executing test source is separately
hashed in the receipt and verified unchanged afterward.

The obsolete direct homepage-link/popup navigation was replaced with actual
Arena selection and an iframe Frame handle. Native touch controls, player-only
diagnostic placement/aim, and existing combat/persistence checks are retained.
Reload uses the real selector Reload button, reacquires the replacement iframe,
and presses its native Start. All engine requests stayed within Conch's mount.
The Site index, arena.html, arena.js and arena.css were hash-checked unchanged,
as were all four existing engine inventories and the exact motion5 host.

## Observations

- Desktop native Start, one live Conch, rendered canvas, zero runtime/request errors.
- Phone DPR 3 and renderer 2×; 804×1448 canvas in embedded 402×724 viewport.
  The complete outer portrait is 402×874. No diagnostic render-scale override.
- Exactly one native 60-HP Conch with all 15 bones. Guard observed.
- Native sword attacks defeated Conch; local practice reward was 3 coins and complete.
- Enemy attacks defeated the 100-HP player without killing or damaging fresh Conch.
  Attack after player defeat did not damage Conch.
- Retry after guard, reward and player defeat restored fresh native actor/player/reward.
- Selector Reload restored fresh Conch/player; assets returned successfully.
- Local/session storage stayed empty; world/shard documents stayed empty and unchanged.
- Zero phone runtime errors, failed requests or HTTP errors.

The sparse post-corpse samples passed their no-post-death-strike check. This
**does not overturn** actual-run1's rendered death-onset failure or prove
interruption continuity. No frame-complete animation, visual, contact, Safari,
physical-phone performance, quality or fun acceptance follows from this run.

## Reproducibility and evidence

Run: `2026-10-19T14:33:20.001Z` to `2026-10-19T14:38:53.002Z`. Approved muted Chromium under
`scripts/browser-lane.sh --max 20`, using the established shared cloud HOME,
PATH shim, heavy-lane root and Playwright directory. Browser and server closed.
No installs, heavy build, remote writes or additional agents.

- Test source SHA256: `18e1b11991a4317e4390a0ea8ba6b7700c551a1fd789e6ae527fc8b5864fd290`
- Report SHA256: `27638d087a96cc2d1d7496132d16f4a1c44e627737755c8813b76b09ca0f9141`
- Build pin SHA256: `3a584795af56adef1d35d4ff3907bc8ac053f481cee43c222775541c27305489`
- Preview SHA256: `346580249b80f84598fe7e3e7781fbf9cdcc284370474a480c12d1becba2cea7`
- Host inventory SHA256: `7a51507bf92abd3af2261785bfcbb87097986a7c8d0613f28bee78ddbff7964b`

Full report, placements, guard frames, lifecycle samples, persistence, images,
all before/after inventories and compact `run-summary.json` are retained in
`tmp/conch-motion5-qa/mounted-run2/`. Original `actual-run1` and failed
`mounted-run1` remain intact. No evidence file was rewritten to turn a failure green.

`node --check test/conch-motion5-mounted-unified.mjs` and scoped oxlint pass.
Node-only imports use narrowly scoped explanatory rule exceptions because this
standalone test runner is not browser code; no repository lint configuration changed.
