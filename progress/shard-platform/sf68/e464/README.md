# E464: admin reload, current data and true plan ordering

2026-10-09. Live: https://wildshard-admin.vercel.app, build **5f37ac4d9** (full pin in `live-version.json`).
Only the admin was deployed. Repo pushes remain coordinator-owned.

## Result

- Header **Reload** works in the full-screen PWA. Changed `/version.json` exposes **NEW DATA · TAP TO UPDATE**;
  checks run initially, on foreground and every five minutes with `cache: no-store`. Offline checks can retry.
- Dedicated `admin-deploy` workflow rebuilds committed report / plan changes through `admin/tools/deploy.sh [REV]`.
  The clean export pins one commit, uses workspace-safe package links and the shared build queue. GitHub has the existing
  Vercel build-token secret; the named project and its IDs are unchanged.
- Plan leads with State's **1 of 7**, then **Ready to share**, then **Effort**. M3 is **effort toward 80/20**.
  Missing / invalid count stays unavailable; no fixed count or guessed readiness.

## Source commits

- `87b23f8c244c4465ac7b22c9c1ef46893aacb081`: PWA reload / update checks and State-driven Plan order; seven admin tests.
- `e770df8b11c06146457a8062b273e5b48baabb07`: report-change deployment workflow and exact-SHA export.
- `1d4d7f8eb0477a5b8c8f9683b15b5631bdc623e1`: canonical macOS export path for workspace-safe package links.
- `5f37ac4d93268f433094c2dd4c554d2b9b92e891`: nonempty CLI argument array for macOS Bash 3 with nounset.
- `948c2267085ab1fd114c367bd97a62a0b1ec1cc9`: uncached, bounded exact-build verification while the alias propagates.

The first automatic [workflow run](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/37936632171)
deployed `e770df8b1`, but immediately saw the preceding `9aa669b39` alias response and failed verification.
The final authorized clean deploy succeeded at `5f37ac4d9`; `deploy.log` records its deployment URL.
The propagation forward accepts only the expected build: injected stale then matching reads succeeds on read 2;
12 wrong reads fail (`alias-verification.json`, actual verification block with stub curl / sleep, macOS `/bin/bash`).

## Proof

Muted Chromium, **iPhone 16 Pro** emulation (402 × 874 CSS portrait), through `scripts/browser-lane.sh`:

- [Plan](plan.jpg): actual live `5f37ac4d9`; count first, header reload, no horizontal overflow.
- [Update banner](update.jpg): owned localhost static build of identical UI (`87b23f8c2`); only `/version.json` was mocked
  to a new build. No production requests were mocked. Tapping the banner reloads and hides it again.
- `plan-state.json`, `reloaded-state.json`, `updated-state.json`: exact heading order and count; header reload creates a
  new document time origin; banner is hidden after update reload. Accessibility snapshots accompany the captures.

Capture used an owned static server for built `dist-admin` on localhost:4488. Agent-browser session `sp-x2-admin` was
muted with `--args --mute-audio`, emulated iPhone 16 Pro and opened the live `#plan` tab. For the local update proof,
`network route '**/version.json' --body '{"build":"e464-new-data-fixture"}'` preceded a `pageshow` event; after the
banner capture, the route was removed and the banner tapped. The browser closed on every exit. Both captures were
visually inspected; each is below 500 KB. No game URL switch was introduced.

Validation: `pnpm exec vitest run admin/test` **7 / 7**, `pnpm --dir admin typecheck` (browser + tools) green,
touched TypeScript oxlint green, `bash -n admin/tools/deploy.sh` green, clean admin build green.
Clean exported `5f37ac4d9` passed every tree-gate stage, including full Vitest (121 s), bake checks, root / layer / API /
script strict checks, root lint, ratchet, asset audit, Vite build and WebKit smoke (`clean-tree-gate.log`).
The wrapper then hit its unrelated empty `failed[@]` Bash 3 error after all checks passed; the coordinator owns that
forward. No assertion was weakened, no failing stage hidden, and the wrapper is not reported overall green here.
