# GPU parity baselines — 2026-10-08 refresh

Main content pin: `bfb9dc325d08792ddbe88bd08c78fcf288da8851`. Nine desktop uses pushed `8ecb6c70b60781dc33f88c0a54688227e5f6d19b`, which includes its reviewed G224 ceiling. Every accepted file comes from the official record CLI.

The old references mostly date from October 1–2, before the approved content conversions. This refresh is authorised by
wildshard-new under E435. It records three full-profile runs per shard: phone on `gh-macos15`, phone and desktop on `m5`.
Both lanes use Chromium/ANGLE Metal, deterministic game-time advancement and muted audio.
The runner and local baselines remain separate; no runner timing is substituted for a phone measurement.

## Harness regressions fixed before recording

- `076309714` builds admitted shardfile products before Vite in CI and exported parity builds. Their omission caused
  the template's exit-3 loading timeout; a timeout is not an accepted baseline change.
- `18b8a6f4f` enables the device Developer fixture before seeding midday/clear. G216 had fenced saved time, silently
  turning the capture into a live morning scene. On identical Pine source (`f480101b9`), restoring the effective midday
  improved old-reference SSIM from about .79–.82 to .96–.97 before excluding the diagnostic badge.
- `17cb7422d` applies the initial non-live pick when the resident clock binds. The declared template and native Sky/Sun
  hour clocks previously only received subsequent setting changes. Live still preserves authored starts/overrides.
- Developer FPS, panels, banners, budget/memory readouts and boundary diagnostics are excluded by capture-only CSS.
  The fixture asserts hidden FPS overlays and records the effective paused clock. Developer script alerts still become
  `boot.errors`, even though their pixels are hidden. Gameplay HUD and loading/error screens are not suppressed.

- `d47eb030b` waits for startup toasts to expire before taking the complete HUD fingerprint, with a ten-second bound.
  The Sky/Sun serial repeat exposed an expiration race; no HUD node is excluded or manually removed. The focused
  straddle fixture covers both timer rates, native timing and a non-expiring toast.

## Why each shard's reference changes

| Shard | Classification and named content changes |
| --- | --- |
| `_template` | Intended replacement of the legacy plugin by the admitted shardfile. `e894412ca` ships Jake's G163 dev-map look; `a55e2684f` and `ea3f85ba6` fill the cell with the G220 districts, roads and landmarks. `ae94f0fd1` composites the admitted landmarks into its shared minimap (G222). The loading timeout was the separate fixed build regression above. |
| `driftwood-isle` | Intended G164 whole-world −0.8 m drop (`fe508c172`, `161c82471`), declared fixed-step bridge/boat, and graded pier/jetty ramps (`c4e6eaec2`). These change walk heights, collider/render counts, visible decks and surface-sound counts; the approved entry walks are recorded in `e02a6ac24`. `a07382147` gives the ocean its own material uniforms. |
| `pine-hollow` | The severe darkening was the fixed capture-clock regression. Remaining texture/memory/program drift includes cold-phone Auto KTX2 (`bc7181016`), baked creature/weapon textures (`02543ff4a`, `69ff4a7dd`) and the smaller item-shop panel (`ba19c6eb3`, `e6dccacd9`). `e406c2f60` adopts baked creature coats once per rig. Grid-only Pine memory trim is not used to explain this standalone capture. |
| `nalati-grasslands` | Intended declared group policies (`ad7fb76d3`, re-proof `cc235d56e`) after exact replay, both-tier parity and the ON floor (SF27/G112), plus offline baked creature coats (`305cce8cd`). The phone bow harness ground-height corrections (`603f8eaf4`, `007543ff9`) fix firing placement, not combat policy. The separately proved flock ON variant (`80358417a`) remains unselected in this default-policy baseline. |
| `nine-dragon-stack` | Intended road-height landing decks (`7d52f8ab3`), standalone carved arrival cap/brazier (`82bd665cf`), shop-front colliders (`8b9888c45`) and G224 portal retirement of the lift (`599924369`, `5ec641579`). Those account for registry, collider, mesh, draw and route-sound changes. The approved `864ecb7d0` ceiling receipt charges exactly 686,480 additional buffer bytes (textures/renderbuffers unchanged), measured identically in three runs, to G224 (`599924369`, `5ec641579`, `82bd665cf`). No margin or device memory cap changes. Facade multi-draw remains prohibited. |
| `far-reach` (Sky Reach) | First committed baseline in both lanes, rather than repeatedly creating uncommitted CI bootstrap artifacts. Includes the four Rising Islet entries (`92ee5f41a`, `5f33caa99`) and G200 standalone timber sky docks/beacons (`82bd665cf`); ordinary brains retired after replay/parity/floor in `668a92add`. |
| `sunscar-dunes` (Signal Dunes) | First committed baseline in both lanes. The sky/sand material-family conversion (`e53b7b44c`) and ordinary-brain retirement (`668a92add`) already passed their own parity/floor checks. Its authored dusk sky remains the authored look. |

G219 open plots, SF23 far-cliff proxies and neutral *grid* look changes do not explain Select-a-shard pixels: those are
not drawn by this harness route. Shader warm-up (`42962da4e`, `3e5ea7e58`) intentionally changes program creation order;
the entered Pine receipt at `61bb3b25b` proves unchanged settled pixels and zero post-warm program creation in that view.

## Recording evidence

The initial runner dispatch completed six shards, but Pine's three concurrent captures exceeded the unchanged
240-second cabin-porch timeout (exit 3). `d739e3149` makes runner records serial; Pine is recaptured through
the official workflow run `37738217141` (workflow `d739e3149`, content `bfb9dc325`). Pine passed serially. The failed concurrent capture is not accepted.

The next serial repeat rejected Sky and Sun solely because startup toasts straddled the HUD sample.
`d47eb030b` fixes that boundary; the final runner Sun recapture uses workflow `92d593e40` in
[run 37741474189](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/37741474189).
All seven jobs in the final runner dispatch passed. M5 Sky and Sun were recaptured with the identical idle helper.
No rejected repeat is accepted.

The first all-pairs M5 batch rejected Driftwood desktop run 2 after Chromium reported `net::ERR_NETWORK_CHANGED`.
Its atomic record gate wrote no baselines. Each shard/tier was then recorded separately through the official CLI,
including three fresh Driftwood desktop runs; the rejected capture is not used. No baseline is written by an external helper.

The accepted files are byte-checked against their official aggregates (only the CLI-owned image path differs),
and every image is byte-identical to the official first capture. The receipt records aggregate, image and raw-run
hashes, all three setting witnesses, content pins and workflow IDs. No abandoned bootstrap is copied here.
Every accepted recording must pass boot errors, renderer checks, 0-stuck walks, combat, pause/resume, unload census
and render budgets, as well as consistency across its three runs. Baseline movement does not waive those checks.

## Accepted consistency

**21 pairs / 63 full-profile captures**, all green; lowest three-run self-SSIM **0.99130899**. All raw captures have zero stuck walks and boot errors.

| Shard | M5 phone min SSIM | M5 desktop min SSIM | Runner phone min SSIM |
| --- | ---: | ---: | ---: |
| `_template` | 1.00000000 | 1.00000000 | 1.00000000 |
| `driftwood-isle` | 0.99130899 | 1.00000000 | 0.99176465 |
| `far-reach` | 0.99999486 | 0.99999995 | 0.99995556 |
| `nalati-grasslands` | 0.99999636 | 0.99997652 | 0.99993828 |
| `nine-dragon-stack` | 0.99998342 | 1.00000000 | 0.99963733 |
| `pine-hollow` | 0.99969821 | 0.99992858 | 0.99659403 |
| `sunscar-dunes` | 0.99961914 | 0.99998246 | 0.99920791 |

The [audit receipt](../../../progress/shard-platform/sf62/gpu-baseline-refresh.json) includes each accepted source,
content pin, image/raw/aggregate hashes and three settings witnesses. Runner artifacts come from record runs
`37735055551` (initial green pairs), `37738217141` (Pine serial replacement), and `37741474189` (Sun idle-canonical replacement).

Official M5 command, run with the matching `harnessSha` from the receipt (one pair at a time; Sky idle recapture batched its two tiers with `--jobs=1`):

```sh
node scripts/parity.mjs --record --runs=3 --lane=m5 --shards=<slug> --tiers=<tier> \
  --export=bfb9dc325d08792ddbe88bd08c78fcf288da8851 --jobs=1 --retry=0 --out=<scratch>
```

Nine desktop substitutes the approved `8ecb6c70b60781dc33f88c0a54688227e5f6d19b` pin. Runner dispatch:

```sh
gh workflow run gpu-gate -f record=true -f sha=bfb9dc325d08792ddbe88bd08c78fcf288da8851
```
