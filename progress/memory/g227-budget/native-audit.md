# G227 native ruler, empty-road residual and cut list (E435)

Follow-up: [audio retirement and exact output proof](audio-retirement.md) removes the four traced retired Deck pairs (115.611520 MB); its latest Nalati centre still exceeds the cap. The baseline audit below is retained with its original pins.

**WC + labelled GL remains the conservative ruler. Both entered centres exceed 1 GB, and an empty road retains over 1.1 GB even after the cache-eviction forward. There is no evidence for a blanket model discount.** Decimal MB throughout; Simulator-relative evidence, not a physical-phone cap pass.

## Allocation control

On the `f47f33199` build, a separate offscreen WebGL2 context allocates an RGBA8 4096² texture, renders a full-surface pattern, finishes and verifies a nonzero pixel. A positive CPU control allocates/touches the same 67,108,864 bytes. Neither control participates in a game-pose sample.

| Isolated control | WC physical footprint MB | GPU-process physical footprint MB |
|---|---:|---:|
| Before | 48.450152 | 14.239904 |
| 67.108864 MB GL allocation | 48.433792 | 14.715040 |
| Plus touched 67.108864 MB CPU buffer | 115.280560 | 14.649504 |

The CPU increment is 66.846768 MB; the GPU allocation does not appear in WC. The GPU-process footprint also omits the driver allocation, so it is neither a replacement for labelled GL nor a third quantity to add. The same control after the original Nalati route corroborates this (GL WC delta −0.016384 MB; CPU +63.668272 MB). This empirically supports the conservative WC + GL ruler for this Simulator/backend. It does not establish exact device-wide physical ownership of shared/driver pages.

## Cold routes and retirement

Muted Safari, iPhone 16 Pro Simulator, Developer ON, phone Auto, 2×, memory saver OFF. Three settled one-second kernel physical-footprint readings at each pose; table uses their median and the same-pose live GL census. Each route starts cold. Native sampling JSONL, vmmap maps and raw censuses are retained. No forced collection before these poses.

| Pin / pose | WC MB | GL MB | Combined MB | Model MB |
|---|---:|---:|---:|---:|
| f47 — home before Pine | 535.268880 | 208.491987 | 743.760867 | 905.230911 |
| f47 — Pine entry | 828.526456 | 240.307416 | 1068.833872 | 1082.195295 |
| f47 — Pine centre | 899.469200 | 238.167212 | **1137.636412** | 1075.919348 |
| f47 — cold home before direct Nalati | 563.678760 | 208.491987 | 772.170747 | 905.230911 |
| f47 — Nalati entry | 844.320464 | 305.647052 | 1149.967516 | 1070.055894 |
| f47 — Nalati centre | 917.786368 | 302.153224 | **1219.939592** | 1063.675114 |
| f47 — road, residents=[] | 925.208368 | 178.756678 | **1103.965046** | 525.852910 |
| cc2371ac6 — home | 599.166504 | 211.555187 | 810.721691 | 934.896463 |
| cc2371ac6 — Nalati entry | 921.472672 | 310.108352 | 1231.581024 | 1143.313166 |
| cc2371ac6 — Nalati centre | 979.373776 | 306.614524 | **1285.988300** | 1128.784955 |
| cc2371ac6 — road, residents=[] | 975.638272 | 160.961638 | **1136.599910** | 588.246941 |
| cc2371ac6 — road after Inspector Heap.snapshot | 966.168608 | 160.961638 | 1127.130246 | 588.246941 |

`cc2371ac6` includes the retired asset-cache eviction and composer/cache accounting forwards. Empty-road GL is 17.795040 MB below the old run. WC is higher, so this single before/after pair proves no positive WC saving; cold release/collection timing, source differences and diagnostic overhead are not isolated. The post-snapshot sample is a separate Inspector/collection experiment and cannot replace the original sample or be called a normal-boot pass.

The failed Pine→Nalati route remains in `native-f47f33199.json.gz`: it stopped on the old 1 ms timeOrigin fence at +2 ms before the Nalati leg. It is not retried or regraded as a GPU reset. The separate direct Nalati routes use the stable random document token; origin drift is recorded. Token loss/change and API/navigation recovery remain fatal. Catch diagnostics now include the token. Both direct routes completed, with no page errors; each Safari/Inspector/proxy/Simulator and owned preview was closed.

## Empty-road native region table

Rounded dirty bytes from `vmmap -summary` (source M means MiB), **not additive owner totals**: mappings can alias and resident shared libraries are not uniquely charged page memory. Full region rows are in `native-summary.json` and the original `.vmmap.txt` files.

| Region | f47 road dirty MiB | cc237 road dirty MiB | Interpretation |
|---|---:|---:|---|
| WebKit Malloc | 554.70 | 612.40 | bmalloc/JSC/native payloads; needs object retainers |
| JS VM Gigacage | 217.50 | 194.70 | typed-array/WASM backing-store region; not all live |
| JS JIT generated code | 36.80 | 37.80 | compiled JavaScript |
| MALLOC_SMALL | 7.75 | 7.61 | ordinary small native allocations |
| CG raster data | 7.08 | 8.08 | raster mappings, not every ImageBitmap allocation |
| Image IO | 0.00 | 0.00 | file/image mappings, not all decoded image storage |
| VM_ALLOCATE (graphics) | 10.60 | 11.60 | WC graphics mappings, not the labelled GL total |

## Live heap and concrete retainers

Inspector Heap.snapshot after the cc237 empty-road pose reports **606.986317 MB** across 957,267 nodes. These are Inspector estimates including externally owned payloads; they are already subsets of WC, never another quantity to add. Full compressed v3 snapshot and category/retainer details are retained in `heap-summary.json`. The snapshot is analyzed with WebKit's own dominator/shortest-root algorithm; its source URL and content hash are recorded.

| Heap class | Live MB | Concrete retainer / action |
|---|---:|---|
| ArrayBuffer | 227.140445 | Includes global Rapier memory and native-root buffers; not all assignable to scene owners |
| AudioBuffer | 153.513721 | Four old Deck.audio calm/tension pairs total **115.611520 MB**, retained through ended-listener callback roots; release on retirement/suspended-context track switches |
| ImageBitmap | 64.422184 | `window.__skyV2.tPano.value.source.data` retains 12.516128 MB after retirement; other textures require scoped ownership |
| Float32Array | 36.051192 | JS arrays/backing-store estimates; do not independently sum with ArrayBuffer as a physical ownership claim |
| FunctionCodeBlock | 27.836172 | Compiled code, not streamed world geometry |
| Object | 23.710810 | Includes retired contexts reachable through page diagnostics |
| HTMLCanvasElement | 22.919660 | `__bake.roots` and live page/screen/perf canvases; keep live ones, clear retired references |
| string | 9.472022 | Source/data/diagnostic strings; not assigned wholesale to a shard |
| UnlinkedFunctionCodeBlock | 7.759807 | Code metadata |
| Uint32Array | 4.450872 | Index/source arrays; native-root retention still needs attribution |

WASM weak-reference capacity telemetry: 32.899072 MB at home, 54.460416 MB in Nalati, with Rapier growing from 30.736384 to **52.297728 MB**. The largest heap ArrayBuffer is that exact Rapier backing store (header adds 144 bytes). It remains on the road but cannot explain ~580 MB. Clearing live physics is not permission to free the page's shared WASM engine.

Further concrete paths: `window.__perfHud.counters → questSource → ctx.runtime.objects` retains a retired runtime's grass/widget state; `window.__bake.roots` retains paint roots; `window.__skyV2` retains the retired panorama. The page diagnostics must remove a retired owner's read callbacks/references. Some largest geometric ArrayBuffers have only native/Internal roots in this Inspector snapshot: assigning them to an exact JS owner would be speculative. Directly scene-held arrays are available separately in each census, with buffer identity, role and geometry path. Three.js generally retains `BufferAttribute.array`; uploaded static attributes must explicitly opt into safe `onUpload` release where later picking/cloning/restore never reads them. No blanket geometry-array clearing is safe.

Suspended/unlocked audio is an important case: an AudioContext that does not advance cannot deliver a future `ended` event, so relying on that event alone can keep faded decks/PCM indefinitely. This muted synthetic-input measurement must not be represented as an audible-play parity test. The lifecycle must release retired decks even when the context is suspended; running-context crossfades must remain identical.

## Measured centre cut list

The per-label world/retained classes below are disjoint classification groups; direct arrays are measured WC subsets, not the whole native owner. GL plus direct arrays is an attributable lower bound, not a total retirement credit. Unknown heap/native residual remains unassigned. Visibility is a lifecycle requirement, not an accounting discount.

| Candidate | Pine centre GL / direct arrays MB | Nalati centre GL / direct arrays MB | Release condition / visible from cell |
|---|---:|---:|---|
| Platform + template presentation | 72.802 / 7.535 | 72.802 / 7.485 | Dispose scopes and claims only for pieces outside the needed view/approach; restore before road exposure. Whole platform claim ~99.8 MB is not identical to physical saving |
| Sky/post/water/dynamic | 53.304 / 0.642 | 90.700 / 2.897 | Split further: composer/grade/sky/grass are visible and cannot simply disappear |
| Static world props | 21.712 / 14.655 | 55.040 / 47.737 | Region/tile-ring retirement; retain visible props and authoritative collision |
| Kit/UI/shared | 23.119 / 19.137 | 11.547 / 13.451 | Platform traveller stays; retired shard-only assets may release after last user |
| Forest/scatter | 16.722 / 5.313 | 7.090 / 2.896 | Stream outside visible active ring; no cut credit before actual owner retirement |
| Terrain | 13.184 / 0.000 | 14.930 / 0.000 | Visible/colliding terrain stays; tiled representation may cost more |
| Creatures/dynamic | 15.401 / 9.206 | 40.912 / 12.384 | Active actors stay; dead/retired scope assets release after shared users retire |
| Runtime-unclassified | 15.786 / 16.832 | 5.233 / 25.001 | Inspect source/retainers before any attribution |
| Page-unclassified | 6.136 / 0.199 | 3.900 / 0.199 | Keep actual shared page users; no arbitrary base discount |
| Retired PCM and diagnostic-held native payload | Only post-retirement heap measured | 115.612 MB old Deck PCM; 12.516 MB retired panorama | **First fix: not visible/audible after retirement; remove owning roots. Do not sum with WC again** |

Largest platform pieces are open plots (19.059 MB GL), sign atlas (22.646 MB GL including buffers), deck (14.005 MB GL), screen group (6.990 MB GL at two slots), junctions (5.619 MB GL). Road scopes charge actual retained JS as well. Releasing every such claim without deleting its actual objects is forbidden.

Composer labels in Pine include 18.370 MB colour, 9.185 MB depth, 9.185 MB luminance, mip chains and 8.389 MB other 1024² colour/depth targets. Some targets support visible post effects; an aux-target retirement needs exact pass ownership and reconstruction, not deleting the whole composer. The +25 MB Pine sky candidate is not independently evidenced in this capture; no corresponding credit is assigned. Nalati's panorama alone is 16.683 MB GL / 12.516 MB ImageBitmap.

Next: fix the retired Deck lifetime, then repeat the same centre/road ruler. Coordinator routed diagnostic-root cleanup separately. Platform scope streaming follows the residual fixes. No model/cap change, no visible cut, and no 1 GB PASS is claimed.
