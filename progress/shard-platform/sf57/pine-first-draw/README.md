# Pine first-draw mip lifetime P0 — 2026-10-08

Functional regression CLOSED locally on `d77c83b8490a8dfeb170fd6bf05b28479b635e58` (`d77c83b-muzq86wz`). This is Mac WebKit, phone 390×844/DPR2/touch/muted, through `scripts/browser-lane.sh`, fresh contexts. All browsers closed and the owned preview stopped. No native-memory, GPU crash-rate, pixel-parity or frame-floor claim.

- Public SHARD SELECT Pine, Developer OFF: usable title 11.233 s; gameplay 11.312 s; ten live frames; zero fatal/page/console/HTTP/error-report faults (`standalone.json`).
- Developer grid: real EXPLORE navigation and home boot, then existing harness source pose at world (0,230), real held movement through road (0,277.5) into Pine (0,325). Route 18.35 s; final feet z=323.635, Pine current/inside/resident, gameplayReady true, pending empty, issues empty, zero errors (`grid-pine.json`). The source pose does not bypass admission or readiness. One earlier driver lacked harness pins and refused before travel; retained in `grid-harness-refusal.txt`, not scored as a product failure.

Root: loader/final upload had released compressed mips before consumers finalized sampler wrap/anisotropy. Actual diagnostic labels identify the bolt atlas (`before-bolt-failure.json`, d5ac76cf0, texture40) and tree cards (`intermediate-tree-failure.json`, 6ba810ee1, texture73). The original a1c4 grid texture195 is not directly identified by these traces; do not claim that mapping.

Fixes: bolt preload stays provisional (`6ba810ee1`); tree sampler configuration precedes upload (`733e6e635`). Generic `d77c83b84` retains mips until a successful real draw binds a finalized texture, including shader-injected uniforms, and guards retired sampler/source/native-allocation identity. `f9e50f6fb` compares scalar identity without per-draw arrays; behavior is unchanged and its 25 focused checks pass. `09d9bc6ab` updates the real rifle lifetime oracle. Official release boot smoke now includes public standalone Pine (`1bffb4df0`) with the unchanged 60 s case deadline and ten-frame requirement.

Commands: `scripts/browser-lane.sh --max 3 node <scratch>/pine-webkit-draw.mjs`; `scripts/browser-lane.sh --max 5 node <scratch>/pine-grid-webkit-pins.mjs http://127.0.0.1:4407/ <fresh-out>`. These call production `bootCase`, `stageFloorGrid`, and `driveFloorGrid`; the grid fixture adds only the existing `{seed:357,capture:null}` harness pins.

Validation: root/scripts strict, typed lint, precommit guards, 35 focused upload/factory/boot tests, then 25 hot-path/lifetime checks green. Full clean-export result is recorded in `validation.json`; no timeout or assertion was weakened. Coordinator owns the serialized push and exact-SHA official boot smoke before releasing.
