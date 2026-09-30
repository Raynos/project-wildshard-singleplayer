# CI GPU options for the GPU gate (E357 research, 2026-09-30)

Jake: "Can we get a GitHub Actions Mac machine with GPU?" The gate (MW3 / TP6) boots each of 4 shards on the phone tier
(desktop later), walks, swings, shoots, records a boot fingerprint (draw calls, triangles, programs, registry, HUD) and a
few poses; ~3.5 min on the M5 Max with `--use-angle=metal`. The deploy ships only the newest commit whose gate is green.

**Answer: yes, and it is free.** GitHub's **standard** `macos-14` / `macos-15` / `macos-26` arm64 runners (M1 VM, 3 vCPU,
7 GB) expose a **paravirtualized Metal GPU**. Full Chromium draws WebGL2 and WebGPU on it through ANGLE Metal
(`ANGLE (Apple, ANGLE Metal Renderer: Apple Paravirtual device)`), the same ANGLE backend as iOS Safari's stack. Standard
runners are **free and unlimited on public repos**, and this repo is public (owner `Raynos`, a user account). Two traps:
Playwright's default **headless shell falls back to SwiftShader** (use `channel: 'chromium'`), and the VM is for
**correctness, not timing**. So: gate on counts on the GitHub Mac every push; keep ms and memory for Jake's Mac and the
iPhone. This replaces the audit's "the gate runs on Jake's Mac" plan (tooling-pipeline-audit §6): no Mac has to be
awake for a deploy, and no self-hosted runner touches a public repo.

## 1. GitHub-hosted macOS runners

| Runner | Hardware | GPU for Chrome | Cost here (public repo) |
|---|---|---|---|
| `macos-14` / `-15` / `-26` (standard) | M1 VM, 3 vCPU, 7 GB, 14 GB disk | Paravirtual Metal ("Apple Paravirtual device"), WebGL2 + WebGPU hardware accelerated in full Chromium | **$0**, unlimited; 5 concurrent macOS jobs on Free |
| `macos-*-xlarge` | M2 Pro VM, 5 vCPU + 8-core GPU, 14 GB | "GPU hardware acceleration enabled by default" (same paravirtual path) | $0.102/min; larger runners are never free, even public |
| `macos-*-large` / `-intel` | Intel VM | no Apple GPU | $0.077/min (large) |

- **What works.** Apple's Virtualization framework gives a macOS guest a paravirtual GPU (`VZMacGraphicsDeviceConfiguration`):
  the guest's Metal driver submits work that the host GPU runs. Three public repos proved it on GitHub runners in the
  last weeks: niivue (`macos-14`/`-15`, WebGL2 + WebGPU correct), reallm (`macos-15`, ~30 fps where Ubuntu SwiftShader
  gave 1.2–18 fps, suite 5 m 27 s), dunezone (`macos-26`, WebGPU "Hardware accelerated", jobs 249–276 s, queue 9–283 s).
- **What doesn't.** GitHub: "Nested-virtualization is not supported due to the limitation of Apple's Virtualization
  Framework." PyTorch MPS reports available but every allocation fails (runner-images #9918): compute is unusable, raster
  is fine. The guest GPU answers capability queries like an older device (~Apple family 5). Timing is VM noise.
- **Headless shell = SwiftShader, even on a real Mac.** `chromium.launch({ headless: true })` uses
  `chrome-headless-shell`; SwiftShader-WebGL is off on ARM for security, so WebGL can fail outright or drop to software.
  Use `channel: 'chromium'` (Playwright's "new headless" = the real browser) and **assert the renderer string** at boot:
  fail the gate in the first second if `WEBGL_debug_renderer_info` does not name Metal (reallm's `E2E_REQUIRE_GPU=1`).
  The repo's own scripts launch the headless shell with `--use-angle=metal`; the gate should log the renderer too.
- **7 GB RAM** fits the phone tier's 1.8 GB loading target; Pine Hollow desktop (27.5 s cold boot on the M5) may not.
  **The disk is case-insensitive**: a wrong-case asset URL passes here and 404s on Vercel. Keep a Linux-side check.

## 2. GitHub GPU runners (Linux, NVIDIA T4)

`gpu-t4-4-core`: 4 vCPU, 1 Tesla T4 (16 GB VRAM), 28 GB RAM, Ubuntu or Windows. **$0.052/min Linux**, $0.102 Windows.
Larger runners are "only available for organizations and enterprises using the GitHub Team or GitHub Enterprise Cloud
plans": this repo would have to move to an org on Team. Chrome gets the GPU only **headed** under `xvfb` after
`sudo modprobe nvidia nvidia_uvm`, with `--use-angle=vulkan --enable-features=Vulkan --use-gl=angle
--ignore-gpu-blocklist` (renderer `ANGLE (NVIDIA, Vulkan … Tesla T4)`); headless stays SwiftShader, and without the modules
it is llvmpipe (Dave Snider, 2026-02: suite 5 min → 1.4 min). NVIDIA Vulkan is further from the iPhone's Metal than the
Mac VM is. **Not worth it** while the free Mac runner exists.

## 3. Free Linux: `ubuntu-latest` + SwiftShader

- **Works:** public repos get 4 vCPU / 16 GB free. SwiftShader implements GLES 3 (so WebGL2) and Vulkan on the CPU.
  Automatic fallback to it is deprecated; opt in with `--use-angle=swiftshader --enable-unsafe-swiftshader`.
  dunezone: plain `--use-angle=swiftshader` (instead of headless's default `swiftshader-webgl`) removed 60 `ReadPixels`
  per 60 frames that stalled the main thread.
- **Speed:** 1.2–18 fps (reallm), 2.4 fps on 4 vCPU, 1.3 fps with a second browser. Shader compiles are LLVM JIT on the
  CPU; a heavy shard boot is minutes, and it burns ~3 cores per page (E25). A real-time 10 s walk at 2 fps runs the
  fixed step into its catch-up clamp, so stuck / hit results differ from a real GPU unless the harness steps the tick.
- **Determinism:** draw calls, triangles and registry are CPU-side and repeat if sampled at a settled barrier with a forced
  tier. Programs and GPU bytes do **not** carry across renderers: KTX2 picks ASTC / ETC2 / BC by extension (src/core/ktx2.ts),
  and capability limits change code paths (Babylon #18948, 2026-09: `MAX_TEXTURE_SIZE` differences changed a seeded
  particle stream). Screenshots are stable run to run on one Chromium + SwiftShader build but never match Metal.
  Baselines are per lane, and the Chromium version is pinned via the Playwright lockfile.
- **Can't measure:** frame ms, GPU time, real GPU memory or iOS jetsam, thermal, tile memory, driver bugs (the multi-draw
  crash, GLSL `pow` NaN on ANGLE D3D).
- **Precedents:** three.js e2e (dev, 2026) runs `ubuntu-latest`, 5 parallel jobs, headed Chrome under `xvfb-run` with
  `mesa-vulkan-drivers` (lavapipe, CPU), seeded `Math.random`, 0.1 px threshold, ≤ 0.1 % differing pixels, and an
  exception list for examples too slow or nondeterministic. Babylon.js runs visualization tests on Azure Pipelines across
  Chrome WebGL2 / WebGPU and Firefox. Babylon Lite uses SwiftShader Vulkan for WebGPU in CI.

## 4. Third-party Macs and Jake's own Mac

| Option | GPU | Price | Note |
|---|---|---|---|
| Jake's M5 Max, local watcher | real Metal | $0 | asleep / busy with model jobs; not a runner (below) |
| AWS EC2 `mac-m4.metal` / `mac-m4pro.metal` | bare-metal Mac mini, real GPU | $1.23 / $1.97 per h, **24 h minimum** → ~$900 / $1,440 a month kept up | headless display quirks reported on EC2 Mac (re:Post); verify before paying |
| WarpBuild M4 Pro 6 vCPU / Namespace M4 Pro | VMs (Virtualization framework, presumably the same paravirtual GPU) | $0.08 / $0.06 per min | faster CPU than GitHub's M1; not free |
| MacStadium Orka, Bitrise Build Hub, Codemagic | VMs on Apple silicon | paid plans | same paravirtual class |
| Cirrus CI / Cirrus Runners | — | — | **shut down 2026-06-01** (Cirrus Labs joined OpenAI); Tart stays open source |
| Buildkite + own Mac as agent | real Metal | free tier | still runs pipeline code on the Mac; same trust question |

**Self-hosted runner on a public repo: no.** GitHub: "Self-hosted runners should almost never be used for public
repositories on GitHub, because any user can open pull requests against the repository and compromise the
environment." A fork PR can edit `runs-on` in its own copy of a workflow. If Jake's Mac runs anything per commit, it is a
**launchd watcher** that polls `origin/main` (only Jake's agents push there) and posts a status with a fine-grained token
scoped to commit statuses on this one repo: no runner registered, nothing from forks ever executes.

## 5. Minutes and money (gate ~5 min, 12–20 pushes a day)

| Lane | Minutes / month | Cost now (public) | Cost if the repo went private |
|---|---|---|---|
| `macos-15` one job | 1,800–3,000 | **$0** | $112–186 ($0.062/min) |
| `macos-15` 4-shard matrix (~4 min × 4) | 5,760–9,600 | **$0** | $357–595 |
| `macos-15-xlarge` one job | 1,800–3,000 | $184–306 | same |
| Linux T4 one job | 1,800–3,000 | $94–156 + an org on Team | same |
| `ubuntu-latest` SwiftShader | 1,800–3,000 (longer runs) | **$0** | $11–18 ($0.006/min) |

Prices are GitHub's 2026 list (cut up to 39 % on 2026-01-01). The $0.002/min self-hosted platform charge was postponed,
and public-repo standard and self-hosted use "will remain free".

## 6. Recommended design

1. **Blocking, every push: GitHub `macos-15` standard runner** (pin the image label, not `-latest`; re-baseline on an
   image bump). Playwright full Chromium (`channel: 'chromium'`), `--mute-audio`, renderer assert. Phone tier only.
   Gate on **counts**: boot OK, 0 errors, fingerprint (draw calls, tris, programs, registry, HUD) within tolerance,
   walk 0 stuck, swing + shot register a hit, poses by SSIM against goldens **captured on this runner**. A matrix of 4 jobs
   (one per shard, ≤ 5 macOS concurrent on Free) keeps wall time near 5 min. `concurrency: { group: gpu-gate }` keeps
   one pending run, so a burst of pushes gates only the newest. Deploy (`deploy-version.mjs`) ships the newest `main`
   SHA whose `gpu-gate` check is green, as the audit planned. **The Mac's sleep does not matter.**
2. **Every push, Linux (already free):** the node gates, plus a case-sensitive asset-URL check (the Mac lane can't catch
   it). SwiftShader stays out of the blocking path: slower, and its programs / bytes / pixels differ from Metal anyway.
   Keep it as a fallback lane if the macOS queue misbehaves.
3. **Nightly, informational: Jake's M5 Max** through the launchd watcher (not a runner): desktop tier, soak, full
   scorecard, frame ms, GPU bytes, under `caffeinate` and the browser lane. It posts a non-blocking `gpu-perf` status.
   Asleep: launchd runs a missed `StartCalendarInterval` job on wake (or `pmset repeat wakeorpoweron` at 04:00); a missed
   night delays a report, never a deploy.
4. **Memory and stability truth stays the iPhone** (MW9, E271): neither the VM nor SwiftShader nor the M5 predicts
   WebContent's jetsam kill.

**First step (free, ~10 min):** a `workflow_dispatch` probe on `macos-15` that boots Driftwood on the phone tier with
full Chromium and logs the renderer string, boot time, peak RSS and the fingerprint. Wildshard's boot time on 3 M1
vCPU is **unmeasured**: the 3.5 min M5 budget could become 8–12 min in one job, hence the matrix.

## Sources

- GitHub: [hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) ·
  [larger runners](https://docs.github.com/en/actions/reference/runners/larger-runners) ·
  [larger-runner plans](https://docs.github.com/en/enterprise-cloud@latest/actions/concepts/runners/larger-runners) ·
  [pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing) ·
  [limits](https://docs.github.com/en/actions/reference/limits) ·
  [secure use](https://docs.github.com/en/actions/reference/security/secure-use) ·
  [2026 pricing changes](https://github.com/resources/insights/2026-pricing-changes-for-github-actions) ·
  [M1 runner, GPU acceleration](https://github.blog/news-insights/product-news/introducing-the-new-apple-silicon-powered-m1-macos-larger-runner-for-github-actions/) ·
  [M2 Pro runner](https://github.blog/changelog/2025-07-16-github-actions-now-offers-m2-pro-powered-hosted-runners-in-public-preview/) ·
  [runner-images #9918, MPS](https://github.com/actions/runner-images/issues/9918)
- Paravirtual Metal in practice: [niivue/mono #199](https://github.com/niivue/mono/issues/199) ·
  [mdzunic/reallm #42](https://github.com/mdzunic/reallm/pull/42) ·
  [ndelangen/dunezone #1570](https://github.com/ndelangen/dunezone/pull/1570) ·
  [dunezone #1414, SwiftShader flags](https://github.com/ndelangen/dunezone/pull/1414) ·
  [T4 + Playwright (Dave Snider)](https://davesnider.com/gputests)
- Apple / Chromium / Playwright: [VZMacGraphicsDeviceConfiguration](https://developer.apple.com/documentation/virtualization/vzmacgraphicsdeviceconfiguration) · [WWDC22 VMs](https://developer.apple.com/videos/play/wwdc2022/10002/) ·
  [paravirtual GPU capabilities (cua)](https://github.com/trycua/cua/blob/main/blog/gpu-passthrough-macos-vms.md) ·
  [Chromium SwiftShader](https://github.com/chromium/chromium/blob/main/docs/gpu/swiftshader.md) ·
  [headless WebGL on ARM Mac](https://groups.google.com/a/chromium.org/g/chromium-dev/c/8eR2GctzGuw) ·
  [Playwright headless modes](https://playwright.dev/docs/browsers)
- Engines: [three.js e2e](https://github.com/mrdoob/three.js/blob/dev/test/e2e/puppeteer.js) ·
  [three.js CI](https://github.com/mrdoob/three.js/blob/dev/.github/workflows/ci.yml) ·
  [Babylon.js #18948](https://github.com/BabylonJS/Babylon.js/pull/18948) ·
  third party: [EC2 M4 Mac](https://aws.amazon.com/blogs/aws/announcing-amazon-ec2-m4-and-m4-pro-mac-instances/) ·
  [mac-m4.metal price](https://instances.vantage.sh/aws/ec2/mac-m4.metal) · [WarpBuild pricing](https://www.warpbuild.com/pricing) ·
  [Cirrus shutdown](https://macstadium.com/blog/cirrus-labs-is-joining-openai)
