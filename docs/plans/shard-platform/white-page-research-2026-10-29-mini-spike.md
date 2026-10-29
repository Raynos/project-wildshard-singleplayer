# White page on the iPhone: what kills the page (spike, 2026-10-29)

Jake (14:40 Cancun): *"I don't think it's low on memory. It doesn't make any sense to me, logically ... I think it could
be CPU, I think it could be the temperature of the CPU ... Pine Hollow definitely like dies to memory ... But I think
some of the other ones that have a white screen don't die on memory."*

## The short answer

- **A white flash, then a fresh boot on the title, means the page's WebContent process died.** WebKit then reloads it.
  Only four things can do that: a **memory kill** (jetsam), a **crash** in WebKit itself, **three GPU-process crashes
  inside 30 s**, or a rare **thermal kill**.
- **CPU is ruled out by WebKit's own code.** The CPU limit only ends *background* pages. A visible page is logged, never
  killed (`WebProcessProxy::didExceedCPULimit`: "we are not terminating it because it has a visible page").
- **Heat on its own slows the phone; it does not close the page.** Apple's heat page lists slower charging, a dimmed
  screen, weaker radios and lower frame rates, not closed apps. Apple does document one rare thermal kill code,
  `0xc00010ff` ("cool off"). It would leave a crash log, so we can check for it. Heat does show the phone ran hot for a
  long time, but it is a symptom of that load, not the thing that killed the page.
- **Why it can be memory while the phone has 12 GB:** each page process gets its **own fixed budget**, and free RAM
  doesn't raise it. On an iPhone 17 Pro on iOS 26 the kernel killed WebContent at **ActiveHard 2048 MB** while ~197k
  pages (~3 GB) were still free. WebKit says iPhone pages have a **soft limit of ~1.5 GB**, enforced as other apps' demand
  rises "over time" after a reboot. **WebGL textures and buffers count against the page process**, even though the GPU
  process allocates them. Our 1.2 GB is our own estimate, not what the kernel counts.
- **A lost GPU on its own does not give the title.** If the GPU process dies once, the game's `GpuRecovery` reloads with
  `?glreload` and lands back in the world under the pause menu, not on the title.
- **Settle it in 2 minutes:** open Analytics Data on the phone (steps below) and look for `JetsamEvent` files at those
  times.

## Causes

| Cause | What Jake sees | Event first? | Threshold | Source |
|---|---|---|---|---|
| Jetsam memory kill of WebContent (`per-process-limit`) | White, then a reload. A second kill soon after: "A problem repeatedly occurred" (Safari) | None: no pagehide, no `webglcontextlost` | iPhone: soft ~1.5 GB (2024); ActiveHard 2048 MB seen on iPhone 17 Pro, iOS 26.3–26.4.1; no iOS 27 figure published | [bug 277848](https://bugs.webkit.org/show_bug.cgi?id=277848) smfr; [forum 823061](https://developer.apple.com/forums/thread/823061); [bug 300782](https://bugs.webkit.org/show_bug.cgi?id=300782); [three.js forum, iOS 26](https://discourse.threejs.org/t/memory-limit-crash-on-ios-26/86978) |
| WebGL memory leaking in the GPU process, charged to WebContent | Same as above | None | Same limit | [bug 253172](https://bugs.webkit.org/show_bug.cgi?id=253172) (iOS 16.4: GPU process grew, WebContent was killed); `RemoteGraphicsContextGLCocoa.cpp` creates the context with the web process as resource owner |
| WebContent crash (a WebKit bug) | White, then a reload | None | n/a | [forum 822200](https://developer.apple.com/forums/thread/822200) (iPhone 15, iOS 26.4: page goes blank, reload) |
| GPU process crash or GPU watchdog, once | `webglcontextlost`: the canvas freezes or goes black; **our game reloads into the world (`?glreload`)** | Yes, `webglcontextlost` | GPU hang reset; IPC timeout 15 s | [bug 290620](https://bugs.webkit.org/show_bug.cgi?id=290620) (long shader, "victim of GPU error/recovery"); [bug 321693](https://bugs.webkit.org/show_bug.cgi?id=321693) (iOS 27 beta 5, GPU EXC_GUARD, fixed); `src/engine/core/GpuRecovery.ts` |
| GPU process crashes more than 2 times in 30 s | WebKit kills every page; the client reloads: white, then the title | Context lost first | `maximumGPUProcessRelaunchAttemptsBeforeKillingWebProcesses = 2`, 30 s | `WebProcessPool.cpp` |
| CPU limit (WebKit) | Nothing while the page is visible | n/a | Background only | `WebProcessProxy.cpp`; [bug 169456](https://bugs.webkit.org/show_bug.cgi?id=169456) |
| CPU limit (iOS `cpu_resource`) | Usually only a log ("NON-FATAL"); `CPU_FATAL` kills background tasks | None | "80 % over 60 s" style messages; varies by version | [Apple EXC_RESOURCE](https://developer.apple.com/documentation/xcode/exc_resource); [forum 123975](https://developer.apple.com/forums/thread/123975) |
| Thermal | Usually slower and dimmer, then the full-screen "Temperature" warning; a rare `0xc00010ff` kill | None | Not published | [Apple SIGKILL codes](https://developer.apple.com/documentation/xcode/sigkill); [Apple heat page](https://support.apple.com/en-us/118431) |

No web API sees any of these coming. Safari has no `navigator.deviceMemory`, no `performance.memory` and no
memory-pressure event. Bug 300782 asks Apple for one.

## How Jake tells on his phone (2 minutes)

1. Open **Settings ▸ Privacy & Security ▸ Analytics & Improvements ▸ Analytics Data**.
2. The list is alphabetical, and each name ends with the date and time. Look for files from **2026-10-29** around
   **13:46, 14:12, 14:13 and 14:22**:
   - **`JetsamEvent-2026-10-29-1346xx.ips`**: open it and scroll to `com.apple.WebKit.WebContent`. If that entry has
     **`"reason" : "per-process-limit"`**, it was memory (Pine, as expected). `rpages × 16384` is the real size the kernel
     counted. If the entry has no `reason`, a different process was killed and our page wasn't.
   - **`com.apple.WebKit.WebContent-2026-10-29-…ips`**: WebKit crashed (not memory). **`com.apple.WebKit.GPU-…ips`**:
     the GPU process crashed (more than 2 in 30 s gives the title).
   - A crash log whose termination code is **`0xc00010ff`**: thermal. A name containing **`cpu_resource`**: CPU,
     usually only a warning.
3. Share any matching file (AirDrop or Mail) to the agent. If a time has **nothing**, the cheapest next step is a
   **sysdiagnose today**, before the phone's log rolls over. Press and hold both volume buttons and the side button
   for about 1 second and let go on the short buzz. About 10 minutes later a `sysdiagnose_…tar.gz` file appears in
   that same list.

Note: if the list is empty, check that **Share iPhone Analytics** is on. That it decides whether files are kept is
widely reported but not confirmed.

### On the Mac (phone plugged in; the tools are installed at `/opt/homebrew/bin`)

```sh
mkdir -p tmp/iphone-logs
idevicecrashreport -k -e -f JetsamEvent tmp/iphone-logs     # -k keeps them on the phone
idevicecrashreport -k -e -f WebKit tmp/iphone-logs          # WebContent / GPU crashes
grep -l '"reason"' tmp/iphone-logs/JetsamEvent-2026-10-29-*.ips
# live, during a repro session:
idevicesyslog | grep -E --line-buffered 'memorystatus|processDidTerminate|gpuProcessExited|didExceed|0xc00010ff|thermal'
# a sysdiagnose's unified log:
log show --archive system_logs.logarchive --start '2026-10-29 13:40' --end '2026-10-29 14:30' \
  --predicate 'eventMessage CONTAINS "memorystatus" OR eventMessage CONTAINS "processDidTerminate" OR eventMessage CONTAINS "gpuProcessExited"'
```

The live lines mean this. `memorystatus: ... WebContent ... exceeded mem limit: ActiveHard N MB (fatal)` is memory.
`processDidTerminate: reason=Crash` together with a WebContent crash log is a WebKit crash. `gpuProcessExited:
reason=Crash` is the GPU. Xcode ▸ Devices and Simulators ▸ the phone ▸ device logs shows the same files. When the
process dies, Safari's Web Inspector loses the page and its console; the reloaded page shows up as a new target, so the
inspector never shows why.

## Verdict per event (before the logs; confidence)

| Event | Most likely | Next |
|---|---|---|
| Pine 13:46 (just loaded, then an app switch, then no event) | **Memory jetsam, ~85 %.** Our estimate read 1214 / 1200 MB; the real footprint is higher | WebKit crash 10 % |
| Nine Dragon 14:12 (grapple zip) | **Memory jetsam, ~55 %**: the zip streams new tiles and textures fast, a peak above the steady state | GPU process crashed 3× / WebKit crash 30 %; thermal < 10 % |
| ~14:13 (not named, "phone is hot") | Same as 14:12 if it was the reloaded Nine Dragon (~55 % memory) | as above |
| Driftwood 14:22 (light shard, hot) | **Memory, ~45 %**: after 40 min the page process carries JS / WASM high-water marks, garbage, canvases and layers our estimate doesn't count, and the ~1.5 GB soft limit bites harder as other apps' demand rises | WebKit or GPU crash 35 %; thermal `0xc00010ff` 15 %; CPU < 5 % |

Jake is right that heat is real evidence, but it is evidence of sustained load, not of how the page died. No source
shows iOS ending a *visible* page for CPU. A thermal kill is documented but rare, and it leaves a log.

## Cheapest tests, in order

1. **The Analytics Data look above.** It settles each event by name and gives the true counted size (`rpages`). No
   build needed.
2. **A sysdiagnose today** if any time has no file.
3. **On our side (no phone):** read the boot reports for those four sessions. A `glreload` or `markReload` trail means
   the game reloaded itself. "The previous page ended with no event" means the process died.
4. **Only if the logs say memory but our estimate disagrees:** measure the real WebContent footprint in the Simulator
   (`footprint` / `vmmap` on WebContent and the GPU process) on a long Driftwood run after a Pine visit, and compare it
   with the game's estimate.
5. **Only if the logs show crashes, not jetsam:** a long hot session against a cooled one at the same spot, Low Power
   Mode on (30 fps, half the GPU work and heat, the same memory) against off. A smaller render scale is a diagnostic
   only; it stays 2× on the phone. A crash that follows heat and frame rate but not memory points at the GPU or thermal.
