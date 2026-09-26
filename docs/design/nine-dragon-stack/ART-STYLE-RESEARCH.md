# Nine Dragon Stack: art-style research

**Ask:** E169 · **Date:** 2026-09-25 · **Status:** research, no code, waiting on Jake's pick

Jake asked: *"How are you going to do a fully custom art style for this? Do research in what would be the most insanely
epic and wow."*

The shard is described in the scratchpad brief: Chongqing × Cyberpunk 2077 × Kowloon Walled City, a 500 m cube, nine
strata, spawn on Lantern Square at +125 m. Every shard has its own look and they are never unified:

- Driftwood Isle is flat-shaded toon, with no lines.
- Nalati Grasslands is soft painterly, with no lines.
- Pine Hollow is photoreal PBR.

Shard 4 needs a fourth look that could not belong to any of them.

---

## 1. The answer

**界画霓虹 Jiehua Neon: the city ruled in ink, lit by neon, floating on silk.**

1. **Draw the Stack as a *jiehua* (界画, ruled-line painting).** Jiehua is the Song-dynasty Chinese genre made for this
   exact subject: dense, many-storeyed architecture drawn with a ruler and a line guide. The best-known picture of
   Kowloon Walled City, Terasawa's 1997 cutaway, is already a modern jiehua.
2. **The picture has three layers and no others:**
   - ruler-straight ink lines for the world;
   - flat mineral washes from the blue-green palette (青绿): azurite, malachite, cinnabar and gold leaf;
   - blank silk (留白) for the fog between strata.

   Neon is the only saturated light, and its glow bleeds into the silk like wet ink (晕染).
3. **The nine strata are one hanging scroll.** The silk is pale at the Crown and gets darker all the way down. In the
   Sump the lines turn into **gold ink on indigo sutra paper** (泥金磁青). You can read that colour script from any Well.
4. **No game has shipped this look, as far as this search found.**
   - Chinese AAA goes photoreal (Black Myth, Phantom Blade Zero) or anime cel (Honkai: Star Rail, ZZZ).
   - The Chinese ink games are 2D or 2.5D (Realm of Ink).
   - Ōkami is Japanese brush painting, not ruled architecture.
5. **It fits the phone.** The lines are drawn inside the material (antialiased, so they don't shimmer), plus one depth
   silhouette pass. There are no PBR textures, no volumetrics and no SSR. The estimate is about **+1.5–2.5 ms at
   1206×2622**, and the shard comes out **cheaper overall than the neon-noir PBR baseline**.

**The "wow" frame:** the balustrade over the Yamen Well. The view down is a 375 m hanging scroll unrolling below you,
bands of coloured silk that each hold a stratum drawn in finer and fainter lines. Gliding down the Well with the
umbrella means falling out of the painting into the sutra.

---

## 2. What makes a custom style read as "wow" (the research)

### 2.1 Shipped references and what each teaches

| Work | What the look is | Technique | Lesson for us |
|---|---|---|---|
| **Arcane** (Fortiche, 2021/24) | 3D sets and characters that read as concept paintings | Hand-painted textures; matte painting projected onto 3D sets; comp in Nuke ([80.lv](https://80.lv/articles/arcane-artists-show-how-they-combine-traditional-art-3d-for-backgrounds), [RedShark](https://www.redsharknews.com/why-netflixs-arcane-looks-so-good-how-fortiche-ramped-up-the-animation-pipeline)) | The paint lives **in the surfaces**, not in a filter on top |
| **Spider-Verse** (Imageworks) | A comic book that moves | Animation on twos; halftone and Ben-Day dots instead of soft gradients; ink lines hand-placed in 3D with an Ink Line Tool ([AWN](https://www.awn.com/animationworld/creating-stylized-universe-sonys-spider-man-spider-verse), [CG Spectrum](https://www.cgspectrum.com/blog/spider-man-into-the-spider-verse-how-they-got-that-mind-blowing-look)) | A print tradition becomes the renderer. Motion gets styled too, not only pixels |
| **Hi-Fi Rush** (Tango, GDC 2024) | 60 fps toon world at native resolution | Deferred toon renderer. Halftone dots and hatching are mapped in **world space** with SDF + smoothstep AA, "so patterns don't look printed on the camera". Stepped lights; decal lights ([GDC Vault](https://gdcvault.com/play/1034330/3D-Toon-Rendering-in-Hi), [notes](https://www.foth.top/article/gdc-2024-hifirush-toonrendering-notes/), [80.lv](https://80.lv/articles/the-making-of-hi-fi-rush-s-3d-toon-rendering-style)) | **Anchor pattern to the world**, antialias it analytically. Our ruled lines use the same trick |
| **Ōkami** (Clover, 2006) | Sumi-e brush painting | Cel shading plus ink-density outlines (the contour is darker than the inner strokes), paper texture, brush strokes. Chosen partly because the PS2 couldn't run the realistic version ([Wikipedia](https://en.wikipedia.org/wiki/%C5%8Ckami), [TCD sumi-e thesis](https://publications.scss.tcd.ie/theses/diss/2020/TCD-SCSS-DISSERTATION-2020-056.pdf)) | **A style can be the performance plan.** It is exactly our phone situation |
| **Sable** (Shedworks, 2021) | Moebius ligne claire | Full-screen post pass: edges from depth, normal and colour; flat colour, almost no shading ([Cook & Becker](https://www.cookandbecker.com/en/article/170/sable-exploration-through-line-art.html), [Heckel: Moebius post](https://blog.maximeheckel.com/posts/moebius-style-post-processing/)) | Line art plus flat colour reads beautifully and is cheap. Sable is Moebius, though, and we need our own ancestor |
| **Jusant** (Don't Nod, 2023) | A vertical world, "simplified reality" | Almost flat colour and light. Holds are shown by **natural colour shades, not painted markers** ([Destructoid](https://www.destructoid.com/interview-climbing-the-tower-with-jusants-art-director/), [Game Informer](https://gameinformer.com/2023/11/29/the-challenging-climb-to-make-jusant)) | Verticality and readability come from the palette, not from UI |
| **Mirror's Edge** (DICE) | White city, red routes | "Runner Vision": climbable things turn red. A white-dominant world with no green ([EA](https://www.ea.com/news/runners-vision-in-mirrors-edge-catalyst), [Duru](https://medium.com/@duruburak/art-style-as-a-ux-guide-how-mirrors-edge-turned-art-into-navigation-0fd15080c6f6)) | **Reserve one colour for traversal.** Ours is gold for the dragon hooks |
| **Stray** (BlueTwelve, 2022) | Kowloon-inspired neon slum | UE4 realism, heavy neon, dense makeshift rooms ([UE interview](https://www.unrealengine.com/developer-interviews/28-people-and-two-cats-inside-the-making-of-stray), [CBR](https://www.cbr.com/stray-kowloon-walled-city/)) | The Kowloon + neon *realism* slot is **taken**. It is our baseline, not our answer |
| **Ghost of Tsushima / Yōtei** Kurosawa mode | Black-and-white film | A post filter (grade + grain) plus stronger wind and old-radio audio ([GamesRadar](https://www.gamesradar.com/ghost-of-tsushima-kurosawa-mode-explained-how-it-changes-the-game-and-why/), [Yōtei modes](https://gamerant.com/ghost-of-yotei-kurosawa-miike-watanabe-mode-explained/)) | A filter-only style reads as a filter: good as a mode, not as a shard identity |
| **Nine Sols** (Red Candle, 2024) | "Taopunk", Taoism × cyberpunk | 2D hand-drawn, anime-influenced ([Digital Trends](https://www.digitaltrends.com/gaming/nine-sols-taopunk-developer-interview/)) | Chinese tradition × cyberpunk is a hit *theme*. Nobody has made it a *rendering language* in 3D |
| **Phantom Blade Zero** (S-Game, 2026) | "Kungfupunk" | Ray-traced photoreal wuxia with machinery ([GameRant](https://gamerant.com/phantom-blade-zero-kung-fu-punk-chinese-cyberpunk-setting-art/)) | Chinese AAA is going **photoreal**. We can't beat it there on a phone |
| **Honkai: Star Rail**, Xianzhou Luofu | "Silkpunk" jade-tech Chinese city | Anime cel, Huizhou architecture ([Siliconera](https://www.siliconera.com/honkai-star-rail-xianzhou-luofu-inspired-by-pre-qin-dynasty-myth-golden-era-sci-fi/)) | A Chinese sci-fi city in anime cel is **taken** (HSR, ZZZ, Wuthering Waves) |
| **Realm of Ink** (Leap, 1.0 in May 2026) | Ink-wash action roguelite | 2.5D brushwork animation ([indiegame.com](https://indiegame.com/en/archives/26511)) | Ink wash is *emerging* in 2D. A 3D first-person ruled-ink city is still open |
| **Tengami** (Nyamyam) | Japanese pop-up book | Real scanned paper, layered folds ([Game Developer](https://www.gamedeveloper.com/programming/tengami-the-art-of-a-folding-world)) | Paper layers are gorgeous but need a camera that faces the layers. First person breaks that |
| **Chungking Express** (Wong Kar-wai / Doyle / Lau, 1994) | Smeared "step-printed" time | Shot at ~6 fps with slow shutter, each frame printed 4× ([Wikipedia](https://en.wikipedia.org/wiki/Chungking_Express), [analysis](https://deepfilmanalysis.com/chungking-express-1994-deep-film-analysis/)) | A great **moment** effect (sprint, grapple, hotpot haze). As a constant look it causes nausea in first person |
| **Ghostrunner**, **Neon White** | Vertical cyberpunk speed, colour-coded clarity | Neon on dark or white, strong affordance colours ([Ghostrunner](https://en.wikipedia.org/wiki/Ghostrunner), [Neon White](https://en.wikipedia.org/wiki/Neon_White)) | At speed, readability beats detail |

### 2.2 The six rules the wow examples share

1. **One idea with a real ancestor in art history**, applied everywhere: Ōkami from sumi-e, Sable from Moebius,
   Spider-Verse from comic printing. The ancestor is what makes the style feel authored instead of "a shader".
2. **Built into the renderer, not laid over it.** Arcane paints the surfaces and Hi-Fi Rush anchors its halftones in
   world space. The pure post filters (Kurosawa mode) read as filters.
3. **The style is the performance plan.** Ōkami went cel because the PS2 couldn't do realism. On an iPhone a
   line-and-flat-wash look is how we afford ~120 floors of density.
4. **Colour is navigation.** Mirror's Edge has red and Jusant has natural accents. One reserved hue per verb.
5. **Motion is styled too**: on twos (Spider-Verse), step-printing (Wong Kar-wai), brush trails (Ōkami).
6. **What is *not* drawn carries the picture**: Sable's flat fields, and liubai (留白) in ink painting. Negative space is
   what keeps a hyper-dense city readable.

### 2.3 Chinese traditions that could carry a future city

| Tradition | What it is | Fit for a vertical neon megablock |
|---|---|---|
| **界画 Jiehua**, ruled-line painting | The only formalised Chinese painting technique that uses **rulers, line guides and compasses** (the 界尺 *jièchǐ*). Its subject is architecture: palaces, multi-storey towers, boats. It was a Song-dynasty genre; Yuan Jiang's Qing *Palace of Nine Perfections* is a peak example ([Wikipedia](https://en.wikipedia.org/wiki/Jiehua), [Britannica](https://www.britannica.com/art/jiehua), [Leqi Yu, *Painting Architecture*](https://hkupress.hku.hk/image/catalog/pdf-preview/9789888754236.pdf), [Met: Yuan Jiang](https://www.metmuseum.org/art/collection/search/49227)) | **Perfect.** It is the Chinese tradition made *for* dense buildings, and screen-space lines are naturally straight and ruled |
| **Kowloon cutaway** (Terasawa / Kani, 1997) | Technical-pen cross-section of the whole Walled City: mahjong parlours, factories, dentists ([Colossal](https://www.thisiscolossal.com/2024/07/kowlooon-walled-city-illustration/), [Spoon & Tamago](https://spoon-tamago.com/detailed-cross-section-of-the-kowloon-walled-city-created-by-japanese-researchers/)) | The modern jiehua *of our exact subject*. The Wells are "cutaways" |
| **山水 Shanshui** ink wash | Brush and ink on paper or silk. Five ink tones (墨分五色), liubai blank paper, Guo Xi's three distances ([Three Distances](https://baike.baidu.com/en/item/Three%20Distances/38162), [Guo Xi text](https://globalphilosophyresources.com/2018/07/19/guo-xi-the-interest-of-lofty-forests-and-springs/)) | Superb for **fog and composition**. Weaker for architecture: brush wobble on a 120-floor grid turns to mush |
| **青绿 / 工笔**, blue-green and fine-line | Fine even contours, flat mineral pigments (azurite, malachite, cinnabar, gold). *A Thousand Li of Rivers and Mountains* ([Wang Ximeng](https://en.wikipedia.org/wiki/Wang_Ximeng)); *Along the River During Qingming* ([scroll](https://en.wikipedia.org/wiki/Along_the_River_During_the_Qingming_Festival)) | The **colour system** for our washes. Qingming is the crowd density model |
| **泥金 on 磁青**, gold ink on indigo paper | Sutras hand-copied in ground gold and silver on indigo-dyed paper (Goryeo, Ming) ([Met, Lotus Sutra c.1340](https://www.metmuseum.org/art/collection/search/36451), [Cleveland, Avatamsaka Sutra](https://www.clevelandart.org/print/art/1994.25), [Asian Art Museum](https://education.asianart.org/resources/buddhist-manuscripts-sutras-of-the-goryeo-dynasty-918-1392/)) | The **night / underworld** mode: gold ruled lines on indigo. The neon glows against it |
| **HK hand-bent neon** | Glass bent over flame into characters that "mirror the elegance of ink-brush calligraphy". Fewer than seven masters remain ([HKFP](https://hongkongfp.com/2023/04/16/its-disappearing-very-fast-hong-kongs-fading-neon-heritage-shines-a-spotlight-on-the-craft/), [NEONSIGNS.HK](https://www.neonsigns.hk/neon-in-visual-culture/neon-fades-out/?lang=en)) | **Neon is calligraphy.** It is the bridge between ink and cyberpunk |
| **月份牌 Yuefenpai** (1930s Shanghai) | Zheng Mantuo's "rub-and-paint": charcoal rubbed in for tone, then watercolour glazes ([Snow Pavilion](https://snowpavilion.co.uk/national-day-thoughts-the-yue-fen-pai-calendar-posters/), [USC](https://scalar.usc.edu/works/republican-era-chinese-posters-as-seen-from-the-university-of-southern-california-library-collection/the-poster-artist-zheng-mantuo)) | Good for **ads and sky-screen content**, not for the world |
| **年画 / woodblock**, **剪纸 / 皮影** paper-cut and shadow puppet | Keylines and flat inks; backlit perforated silhouettes | Signage and props. Too flat for a first-person world |

---

## 3. Scoring

Scores run 1–5, and 5 is always best: **Cost 5 = cheapest** on the phone, **Risk 5 = safest**.

- **Unique** asks whether a shipped game has done it.
- **Fit** means Chinese × cyberpunk × vertical fog city.
- **Read** is readability: enemies, ledges, hooks, which stratum you are on.

| # | Candidate | Wow | Unique | Fit | Read | Cost | Risk | **Σ /30** | Verdict |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|
| **8** | **界画霓虹 Jiehua Neon** *(new)*: ruled ink lines + mineral washes + silk fog + neon | 5 | 5 | 5 | 5 | 4 | 4 | **28** | **Winner.** It absorbs 1, 2 and 9 as parts of one system |
| 9 | 泥金磁青 Gold-on-Indigo Sutra *(new)*: gold ruled lines on indigo paper, neon only colour | 5 | 5 | 4 | 4 | 4 | 3 | **25** | Folded into #8 as the Sump / Shelter Market mode; also a one-uniform whole-shard variant |
| 2 | 工笔 / 青绿 Gongbi Neon: fine contours + flat mineral colour, Qingming crowds | 4 | 5 | 4 | 4 | 4 | 3 | **24** | Its palette becomes #8's washes. On its own it is a *daylight* look that fights the neon night |
| 1 | 水墨霓虹 Ink & Neon: shanshui brush, paper fog, neon only colour | 5 | 4 | 5 | 3 | 3 | 2 | **22** | **Top-3.** Highest painterly ceiling; brush edges crawl in first person; mush at density |
| 6 | 漆器 Lacquerpunk: black lacquer, cinnabar carving, gold 描金 lines, neon reflections | 4 | 5 | 4 | 3 | 3 | 3 | **22** | **Top-3.** The "AAA gloss" custom option. Converges on PBR, and a dark frame on a phone in daylight |
| 4 | 剪纸 / 皮影 Paper-cut shadow theatre: backlit layered silhouettes | 5 | 4 | 3 | 3 | 3 | 3 | **21** | Stunning in stills. First person breaks the layer illusion; alpha-test overdraw defeats the TBDR |
| 10 | 港漫 HK manhua *(new)*: Oriental Heroes-style ink hatching + airbrush glow + speed lines | 4 | 4 | 4 | 3 | 3 | 3 | **21** | Native Kowloon pop culture. Hatching gets busy on a 6" screen; keep for UI and comic cutscenes |
| 11 | 青花 Qinghua porcelain *(new)*: cobalt brushwork on white glaze, underglaze-red neon | 3 | 5 | 2 | 3 | 5 | 3 | **21** | Unique and cheap, but it kills the neon-night mood. A possible Shelter Market shop-interior motif |
| 5 | Neon woodblock / 年画 / risograph: keylines, flat inks, misregistration, halftone | 3 | 3 | 3 | 4 | 4 | 3 | **20** | Spider-Verse and Hi-Fi Rush own halftone. Use for posters and sky-screen ads |
| 3 | Chungking Express: step-print smear, green + red fluoro, grain, halation | 4 | 3 | 4 | 2 | 3 | 2 | **18** | A **moment** (sprint, grapple, glide, hotpot haze), not a shard look |
| 7 | Baseline: neon-noir PBR realism (Cyberpunk 2077 / Stray) | 4 | 1 | 5 | 3 | 1 | 2 | **16** | On a phone it loses to Stray and CP2077 on their own terms. Wet SSR, volumetrics and PBR sets for 120 floors are unaffordable |

Anime cel (the HSR / ZZZ / Wuthering Waves "silkpunk" look) was not scored. It has been shipped at scale by three
Chinese studios, so it is not unique.

**Why jiehua beats shanshui for *this* shard.** Ink wash grew up painting mountains and water, where brush wobble is
the subject. Jiehua was invented for buildings, where the ruler is the point. A Kowloon megablock is 100 % buildings. In
the renderer, a straight line is also the thing a GPU draws most stably. So we keep shanshui for what it is best at, the
fog, the composition and the silk, and let jiehua draw the city.

---

## 4. The top 3 in depth

### 4.1 Rank 1: 界画霓虹 Jiehua Neon

**What it looks like (for a painter).** Paint it on warm raw silk with a fine weave.

- **Lines.** Every building edge, slab lip, balcony rail, window mullion, air-con box, cage bar, pipe and cable is one
  ruler-straight ink line of constant width. Near lines are scorched black (焦墨). They thin and grey out with distance
  until, three blocks away, the lines have dissolved and only the washes remain.
- **Washes.** Walls are flat ink washes in the five ink tones, cool-grey where the sky screens light them from above and
  a deeper ink where they don't. Only a few authored things get **flat, opaque mineral colour**:
  - azurite and malachite glazed roof tiles perched on the concrete towers;
  - the cinnabar-lacquer paifang;
  - brass and gold-leaf dragon hooks;
  - green planter foliage;
  - the red couplets on the doors.
- **Neon.** Neon is the only light with saturation: hand-bent calligraphy in magenta, cyan, jade, amber and red. Its halo
  soaks outwards into the silk like colour dropped on wet paper.
- **Fog.** Between strata the fog is **not grey mist but blank silk**, lit from beneath by the city, so each lower
  stratum sinks into a band of paper of its own tint.
- **Wet ground.** It darkens the silk the way water darkens paper. The neon falls into it as long vertical streaks, and
  drizzle rings are drawn as fine ruled circles.

**References.**

| Reference | Why |
|---|---|
| Jiehua genre ([Wikipedia](https://en.wikipedia.org/wiki/Jiehua)) and Yuan Jiang ([Met](https://www.metmuseum.org/art/collection/search/49227)) | Ruled architecture |
| Terasawa's cutaway ([Colossal](https://www.thisiscolossal.com/2024/07/kowlooon-walled-city-illustration/)) | Our subject, drawn as line |
| Wang Ximeng ([Wikipedia](https://en.wikipedia.org/wiki/Wang_Ximeng)) | The mineral palette |
| Guo Xi's three distances ([Baidu](https://baike.baidu.com/en/item/Three%20Distances/38162)) | Composition |
| Goryeo gold-on-indigo sutras ([Met](https://www.metmuseum.org/art/collection/search/36451)) | The lower-strata mode |
| HK neon craft ([HKFP](https://hongkongfp.com/2023/04/16/its-disappearing-very-fast-hong-kongs-fading-neon-heritage-shines-a-spotlight-on-the-craft/)) | Neon as calligraphy |
| Hi-Fi Rush world-space AA patterns ([GDC](https://gdcvault.com/play/1034330/3D-Toon-Rendering-in-Hi)) | The technical ancestor |

**The three distances as a level and camera rule.**

- **平远, level distance.** Every stratum's street views run level into fog at 60–120 m. That is the "this is the
  ground" feeling.
- **高远, high distance.** At every Well mouth the view looks up the shaft to the strip of Crown sky.
- **深远, deep distance.** Every balustrade looks down through the bands. Each Well is authored so all three are
  available from one spot.

**Shader and post recipe (three.js 0.186, WebGL2, pmndrs postprocessing).**

| Layer | How | Where it lives |
|---|---|---|
| **Ruled lines** (interior) | Every face of the modular kit carries a face-local UV in metres (`aFace`: u,v across the face plus the face size). The fragment draws lines where `u` or `v` is near an edge, plus **ruling rows**: slab lips every 3.2 m, mullions per window module. They are antialiased with `fwidth()` like a grid shader ([Ben Golus, "The Best Darn Grid Shader"](https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8)). When a line would go under ~0.7 px it **fades into the wash instead of aliasing**, which is the ink-dilution rule. Cost: ~10 ALU per fragment and no texture fetch. Stable in motion (no crawl, no moiré) | A new `jiehuaMaterial()` with **one program**, following the `src/world/painterly.ts` rule (per-material uniforms, constant cache key) |
| **Silhouette lines** | One post Effect: an 8-tap depth-discontinuity test on `composer.inputBuffer.depthTexture` (already bound for worldDepth). The threshold scales with linear depth, the width is 2–3 px at 3× DPR, and the line colour gets fogged too. No normal buffer, so no MRT and no second scene render ([Omar Shehata, outlines](https://omar-shehata.medium.com/how-to-render-outlines-in-webgl-8253c14724f9), [code](https://github.com/OmarShehata/webgl-outlines)). It is a convolution effect, so it goes in **its own EffectPass** | `src/gpu/post.ts` / `Game.buildComposer` |
| **Wash + ramp** | Vertex colour picks the mineral or ink wash. The light term goes through **2 hard bands**: lit = wash, shade = wash × 重墨 tint. It is never black. The key light is the **sky screens above** (a cool top light per stratum). Neon spill and AO are **baked into vertex colours** at build time. Up to 4 real point lights (lanterns, the player's jian) | Same material |
| **Silk** | A 512² silk-weave texture, world-anchored, single-axis planar on the dominant normal (1 fetch), ±4 % value. The fog and sky get the same weave in screen space, which is fine there because fog has no surface to "shower-door" against | Material + the fused EffectPass |
| **Banded silk fog** | An analytic height fog in the fog chunk: light density inside a stratum, a dense band in each inter-strata gap, and fog colour = that band's silk colour (§4.1 colour script). **Lines are fogged too**: far lines turn 淡墨 grey. Neon's fog factor is ×0.5, so signs glow through, Chongqing-fog style | `Atmosphere.ts` fog uniforms, as Nalati's extra air does |
| **Ink-bleed bloom** (晕染) | The existing mip bloom, threshold set so only emissive passes. In the composite the bloom is multiplied by `0.75 + 0.25·silkWeave` and its outer mips are pulled toward the paper colour, so the halo "soaks" the fibre | The existing `BloomEffect` + a few lines in the grade |
| **Wet ground** | Wet = silk value −25 %. **Reflection cards**: each neon sign spawns an additive vertical quad on the ground below it, the sign's colour stretched ×3 downwards, broken by ripple noise. Drizzle rings are procedural ruled circles in the ground material. No SSR, no planar reflection | Ground material + a card pool |
| **Grade** | The existing LUT, authored per stratum (silk tint in the highlights, ink-blue in the shadows) + fine grain | Existing `LUT3DEffect` / grain |
| **Drop** | The volumetric march and god rays for this shard: silk fog *is* the atmosphere | `Game.buildComposer` style switch |

**Performance estimate.**

These are guesses to replace with `scripts/bench` numbers. They are given at 1206×2622 (3.16 MP), and at the 2×
render scale target, 804×1748 (1.41 MP), in brackets.

| Item | ms @3.16 MP (2× target) |
|---|---|
| Ruled lines + 2-band ramp in material (vs plain Lambert) | +0.3–0.6 (0.15–0.3) |
| Depth silhouette pass (own EffectPass, 8 taps) | +0.8–1.2 (0.4–0.6) |
| Silk weave + ink-bleed bloom mix + banded fog (fused) | +0.2–0.3 (0.1–0.15) |
| Reflection cards (≤ 40 visible, additive) | +0.3–0.6 (0.15–0.3) |
| **Added** | **+1.6–2.7 (0.8–1.35)** |
| Removed: volumetric march + god rays | −1.0–2.0 (−0.5–1.0) |
| Avoided vs the PBR baseline: PBR texture sets, IBL, SSR, 4k atlases for 120 floors | draw calls + ~100s of MB of download avoided |

The bigger phone risk in this shard is **draw calls and vertex count** from the density, not pixels. One shared program
with vertex-coloured washes merges and batches like the painterly shard does, and that is the real performance win of
the style.

**Colour script up the nine strata: a hanging scroll.** Silk goes from light at the top to indigo at the bottom. Lines
are ink on light silk and gold on dark silk.

| # | Stratum | Silk / fog | Line | Mineral wash | Neon lead | Sky screens |
|---|---|---|---|---|---|---|
| 9 | The Crown | the unpainted silk itself, violet overhead `#3a2e63` → warm glow `#d9c9a8` at the horizon | 淡墨 thin `#474a52` | gold leaf `#c9a24a` | aviation red `#ff2a2a`, VTOL white | **none: the real sky is the one thing nobody painted** |
| 8 | Antenna Forest | raw silk `#d8d0bd` | ink `#2a2c31` | rust `#9a5a3a`, laundry colours | sparse red `#ff2a2a` | gaps show the real sky |
| 7 | Cable Deck | pale silver silk `#b9c0cf` | ink `#1a1c22` | light azurite `#6f9ccf` | cyan-white `#d9fbff` | evening, half broken |
| **6** | **Lantern Square ★** | blue-hour silk `#8e9bb5` | 焦墨 `#14161c` | cinnabar lacquer `#b0301f`, azurite `#2e5fa3` | magenta `#ff3fa4`, cyan `#3fe6ff`, lantern red `#ff4a3a` | dusk sky |
| 5 | Terrace Row | tea-green silk `#7f8a80` | 焦墨 | malachite `#2f8a6a` | jade `#33f0b0`, lantern amber | morning sky |
| 4 | Old Street (datum) | soot silk `#4b4a45` | 焦墨 | ochre `#8a6a3a` | amber `#ffb347`, magenta | noon sky at a coarse LED pitch |
| 3 | Rail Cut | slate `#232a3a` | **silver ink 泥银 `#aab3c2`**: the hinge | iron `#4a4f5a` | cyan `#3fe6ff` (monorail) | tunnel ads |
| 2 | Shelter Market | indigo-smoke `#221b2c`, hotpot steam `#3a1f1c` | **gold 泥金 `#d4ad5a`** | cinnabar `#b8321f` | chili red `#ff3b30`, amber | none: carved rock + steam |
| 1 | The Sump | 磁青 indigo-black `#0e1a2c` | **gold `#c9a24a`** | verdigris `#2f6f62` | algae jade `#33f0b0` | dead panels, a few live pixels |

**How the key things look.**

- **Fog.** Each gap is a band of that stratum's silk, drawn as the analytic fog. Looking down the Yamen Well you count
  the bands: blue, tea, soot, slate, indigo. From the balustrade, deep distance *is* the colour script.
- **Sky screens.** LED ceilings play a *painted* 青绿 sky: flat mineral-blue with stylised ruled cloud bands. They show
  a visible dot pitch, dead pixels and a scan roll: the painted heaven sold to the lower strata. They are also the key
  light. At the Crown there is no screen, only silk and real stars. The class joke becomes a painting joke.
- **Neon.** Signs are SDF calligraphy strokes on emissive quads (cheap, crisp at any distance) with a ruled tube frame.
  They are the only saturated pixels, and the ink-bleed bloom soaks the halo into the silk.
- **Wet ground.** Ruled flagstone joints, silk darkened where wet, neon as vertical reflection-card streaks, and ruled
  drizzle rings.
- **Neon Jian.** The one **brush-drawn** hero object:
  - a dry-brush 焦墨 outline;
  - a cyan-white neon edge (`#d9fbff` core, `#3fe6ff` halo), the only neon that moves with you;
  - a cinnabar tassel and a gamboge fu talisman.

  Swings leave a **飞白 "flying-white" dry-brush ribbon**, a streaky calligraphy stroke that fades from cyan to ink. Hits
  splash a small **泼墨** ink decal. A heavy attack sends a brief ink bloom around the screen edge.
- **Fei Zhua.** The filament is a **single gold ruled line** from wrist to hook. The jiehua ruler (界尺) becomes the
  weapon: you literally rule a line across the city. Dragon hooks are the only gold-leaf objects in reach, which is our
  Runner Vision.
- **Enemies.** Brushed, never ruled. Heavy variable-width dry-brush silhouettes (an inverted hull with a brush-strip
  alpha), 浓墨 bodies and their own violet `#9d6bff` implant neon. Optionally they animate on twos. Attack telegraphs
  are a **cinnabar seal stamp** (印) decal on the ground where the blow will land.

**Readability.**

| Thing | How the eye finds it |
|---|---|
| World | Hairline ruled ink |
| Walkable lips and ledges | Heavier ruled line (the ground-line weight) |
| Hooks | Gold |
| Living things | Brush |
| Danger | Cinnabar seal |
| Player | Cyan |
| Stratum | Silk tint + line colour + sky-screen content, backed by the HUD ladder |

**Risks.**

1. **Line soup at distance.** A 120-floor facade could become a moiré of lines. Mitigations: the density fade (lines
   below 0.7 px become wash), ruling rows that thin by distance band, and fog that eats lines first.
2. **Reading as "CAD / wireframe".** The mineral washes, silk weave, ink-bleed bloom and brushed living things must carry
   the painting. Mock this *first*.
3. **Generated props** (TRELLIS GLBs) have no clean face UVs. They get silhouette lines only, with their atlases
   quantised to the palette.
4. **Neon on light silk loses contrast.** Keep the fog value ≤ 0.55 near signs. Neon sits on dark ink masses, not on
   the fog.

### 4.2 Rank 2: 水墨霓虹 Ink & Neon (shanshui brush)

**What it looks like.** A wet-brush painting on unbleached xuan paper.

- **Towers** are massed in with a loaded brush: 焦墨 black near the eye, diluted to 淡墨 and 清墨 grey with every
  block of distance. The edges break into **飞白** dry-brush streaks where the brush ran out of ink.
- **No colour at all** except neon and lanterns, which glow and spread into the damp paper with feathered edges.
- **The lower strata** are **blank paper** (留白): the drop is simply not painted.
- **The spawn** has a black-ink paifang, red lanterns as dots of pure cinnabar, and puddles as pools of darker, glossy
  ink with the neon floating in them.

**References.**

- Ōkami ([Wikipedia](https://en.wikipedia.org/wiki/%C5%8Ckami)) and real-time sumi-e
  ([TCD thesis](https://publications.scss.tcd.ie/theses/diss/2020/TCD-SCSS-DISSERTATION-2020-056.pdf)).
- Lingdong Huang's procedural shanshui ([shan-shui-inf](https://github.com/LingDong-/shan-shui-inf)).
- Maxime Heckel's painterly Kuwahara ([blog](https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders/)) and the
  2026 three.js watercolour world "Susurrus", which uses Kuwahara as its only post pass
  ([Codrops](https://tympanus.net/codrops/2026/04/24/susurrus-crafting-a-cozy-watercolor-world-with-three-js-and-shaders/)).
- Guo Xi, *Early Spring* ([Google Arts](https://artsandculture.google.com/story/a-new-vision-of-national-treasures-quot-early-spring-quot-landscape-national-palace-museum-taiwan/MAVhq9CUx6JmSQ?hl=en)).

**Recipe.**

- **Material:** a 2-band ramp into the five ink tones. A world-space ink-wash texture (triplanar, 3 fetches) is
  thresholded by light to make wash edges. Dry-brush silhouettes come from an inverted hull with a brush-strip alpha
  whose width scales with view angle.
- **Post:**
  - a depth silhouette whose UVs are wobbled by **world-anchored** noise (reconstruct the world position, then sample
    the noise) so strokes don't slide over the scene;
  - optional **half-res** 4-sector Kuwahara (r = 3) for the wash look;
  - a paper overlay;
  - ink-bleed bloom.

  Full anisotropic Kuwahara ([Kyprianidis](https://www.kyprianidis.com/p/gpupro/)) is desktop-only.

**Performance estimate** at 3.16 MP (2× target in brackets):

| Item | ms |
|---|---|
| Material | +0.8–1.2 (0.4–0.6) |
| Wobbled silhouette | +1.0–1.5 (0.5–0.8) |
| Half-res Kuwahara | +1.5–3 (0.7–1.5) |
| Paper + bloom mix | +0.2 (0.1) |
| **Total** | **+3.5–6 (1.7–3)** |
| Full-res Kuwahara (rejected) | 5–9 alone |

**Colour script.** Ink density is the script: 焦墨-dense at the Sump, with paper showing more and more on the way up.
At the Crown there is almost nothing but paper and a few strokes of antenna. The neon hue per stratum follows the
Jiehua table.

**Fog, screens, neon, ground, jian.**

- Fog is blank paper.
- Sky screens are painted as a wash of blue, the only non-neon colour.
- Neon bleeds with a wet-ink feather.
- Ground is glossy ink pools.
- The Jian is a calligraphy stroke, and swings are brush strokes that stay on screen for a beat.

**Risks.**

- **Brush lines "boil" and crawl** under a first-person camera: every head-bob moves every stroke.
- A monochrome world hides enemies and ledges.
- Density turns to mush on a 6" screen.
- It is the most expensive of the three.
- Ōkami owns "brush-painted 3D" in players' minds.

**Best use.** As the **treatment of the fog bands and the far view** inside Jiehua Neon (already there as liubai), not
as the whole shard.

### 4.3 Rank 3: 漆器 Lacquerpunk

**What it looks like.** The whole Stack is finished like Chinese lacquerware.

- **Walls** are mirror-deep black lacquer (黑漆).
- **Balconies and the paifang** are cinnabar carved lacquer (剔红), with layered relief you can see in section at the
  chipped corners.
- **Edges** are traced in fine **gold 描金 lines**, and gold leaf is crazed with fine craquelure.
- **Mother-of-pearl (螺钿) inlay** shimmers blue-green-pink on sign frames and sky-screen bezels.
- **Neon** is reflected in *everything*: the whole frame is black glass full of coloured streaks.
- **Fog** is dark smoky amber.

**References.**

- Carved cinnabar and gold-traced lacquer.
- The HK neon craft ([NEONSIGNS.HK](https://www.neonsigns.hk/neon-in-visual-culture/neon-fades-out/?lang=en)).
- Stray and CP2077 as the gloss benchmark it has to out-style
  ([Stray UE interview](https://www.unrealengine.com/developer-interviews/28-people-and-two-cats-inside-the-making-of-stray)).

**Recipe.**

- **Material:** a custom low-roughness spec lobe plus a clearcoat-like second lobe, sampling a **per-stratum baked PMREM
  cubemap** of that stratum's neon, captured at bake time: 9 × 256² HDR.
- **Gold 描金 lines:** the same face-UV line trick as Jiehua, but metallic gold.
- **Mother-of-pearl:** a view-angle hue shift in the shader. Not `MeshPhysicalMaterial.iridescence`, which is too heavy.
- **Carved relief:** a tileable normal map.
- **Wet ground:** reflection cards.
- **Post:** bloom, LUT, grain.

**Performance estimate:** +2–4 ms at 3.16 MP (1–2) for the spec lobes and env fetches. There are more programs
(texture-mapped variants), and more texture memory.

**Colour script.**

- **Lacquer:** black lacquer up top, turning to cinnabar-dominant in the Shelter Market and jade (celadon glaze) in the
  Sump.
- **Gold:** gold density rises toward the Crown.

**Fog, screens, neon, ground, jian.**

- Fog is dark amber smoke.
- Sky screens are mother-of-pearl panels.
- Neon is doubled in every surface.
- Ground is lacquer-black water.
- The Jian is black-lacquer grip, gold dragon guard, neon edge. It is the most "product shot" of the three.

**Risks.**

- **Static cubemap reflections don't match the local signs** and slide wrongly in motion.
- A black-dominant frame is hard to read on a phone outdoors.
- Needs textures (download size).
- Drifts toward the PBR baseline it is meant to beat.

**Best use.** Hero props and interiors (the yamen, shrines, the Jian itself) inside Jiehua Neon.

---

## 5. Style bible draft: 界画霓虹 Jiehua Neon

### 5.1 Palette

| Role | Name | Hex |
|---|---|---|
| **Ink, five tones** (墨分五色) | 焦 scorched · 浓 thick · 重 heavy · 淡 light · 清 clear | `#111214` · `#2a2c31` · `#474a52` · `#7b7f88` · `#b3b5b8` |
| **Silk** (paper and fog) | raw silk · aged silk · blue-hour silk · soot silk | `#e8dfc9` · `#d6c9a8` · `#8e9bb5` · `#4b4a45` |
| **Sutra paper** (磁青) | indigo · deep indigo | `#1d2b4a` · `#0e1a2c` |
| **Metal inks** | 泥金 gold · bright gold · 泥银 silver | `#c9a24a` · `#e8c46a` · `#aab3c2` |
| **Mineral washes** (青绿) | 石青 azurite · light azurite · 石绿 malachite · light malachite · 朱砂 cinnabar · 赭石 ochre · 藤黄 gamboge · 蛤粉 clamshell white · lacquer red | `#2e5fa3` · `#6f9ccf` · `#2f8a6a` · `#7fbf9a` · `#c23b22` · `#8a6a3a` · `#d9a441` · `#f2eee4` · `#7e1e1a` |
| **Neon** (emissive only, ×4–8 HDR) | magenta · cyan · jade · hot red · amber · violet (enemy) · jian white-cyan | `#ff3fa4` · `#3fe6ff` · `#33f0b0` · `#ff3b30` · `#ffb347` · `#9d6bff` · `#d9fbff` |
| **Telegraph** | seal vermilion (emissive) | `#ff3b1f` |

### 5.2 Line rules

Pixel widths are at 3× DPR, 1206 px wide. Halve them at 2×.

| Line | Width | Colour | Rule |
|---|---|---|---|
| World ruling (edges, slab lips, mullions, rails) | 2 px | 焦墨 near → 淡墨 at 40 m → gone at ~80 m | Ruler-straight, constant width, never wobbles |
| Silhouette (depth break) | 3 px near → 1.5 px at 60 m | 焦墨, fogged | Post pass only; never on the fog or the sky |
| Ground line (walkable lips, stair nosings, ledges you can stand on) | 4 px | 焦墨 | The only heavier ruled line: the player's "you can stand here" cue |
| Hookable (dragon hooks, cable masts with a hook) | 3 px + faint glow | 泥金 gold | Gold is reserved for the grapple |
| Living (enemies, NPCs, the Jian, the player's hands) | 6–9 px, variable, dry-brush | 焦墨 | Brush, never ruled. Living = brush, built = ruler |
| Lower strata (1–3) | same widths | gold → silver | Line colour inverts on dark silk |

A line never goes below ~0.7 px. It fades into the wash first, and never aliases or shimmers.

### 5.3 Material rules

- **One program for all architecture** (`jiehuaMaterial`): vertex-colour wash × 2-band ramp × ruled lines × silk weave ×
  banded fog × wetness. Everything varies by uniform, never by define, following the painterly.ts rule.
- **No albedo textures on buildings.** The only textures are:
  - the silk weave (512²);
  - one dry-brush strip (256×64) for enemy outlines and 飞白 trails;
  - the SDF calligraphy atlas for neon.
- **Flat mineral colour only on authored accents:** roof tiles, the paifang, planters, couplets, lanterns and doors.
  About 15 % of the frame. The rest is ink wash on silk.
- **No specular** except wet ground (a darker, glossier wash) and the Jian's blade.
- Generated props: quantise their atlases to the palette; they get silhouette lines only.

### 5.4 Light rules

- **The key light is the sky screens**: a cool top light per stratum, in 2 hard bands. There is no sun, except the moon
  at the Crown.
- **Neon is the only saturated light.** Its spill onto walls is baked into vertex colour at build time. At most
  4 dynamic point lights: lanterns near the player and the Jian's edge.
- **Shadows are a deeper ink wash** (重墨 tint), never black. The only true black on screen is the line.
- **Bloom only on emissive**, soaked into the silk weave (晕染). It never whites out the paper.

### 5.5 Fog rules

- **Fog is silk**, never grey mist. Each stratum has its own silk colour (§4.1 colour script).
- Light fog inside a stratum, with 平远 visibility of 60–120 m. A dense band sits in every inter-strata gap, so wells
  and edges read as stacked bands.
- **Fog dilutes the lines first**, then the washes. Neon is fogged at half strength and always glows through.

### 5.6 UI accent

The shared HUD language stays exactly as it is: navy glass `#0d1b26`, cyan `#8fe3ff` hairlines, monospace caps. Shard 4
adds three things:

- The **stratum ladder ticks** take the current stratum's neon lead.
- A small **cinnabar seal** `#c23b22` square with a white 九龍 marks the quest chip.
- The **HOOK** button's ring turns gold `#c9a24a` when a dragon hook is in range.

### 5.7 Do and don't

| Do | Don't |
|---|---|
| Rule every built edge. Let distance dissolve lines into wash | Wobble architectural lines, or put brush texture on buildings |
| Leave the drop unpainted: fog = silk = 留白 | Fill fog with volumetric god-ray mist or grey haze |
| Keep saturated colour to neon, lanterns and the ~15 % mineral accents | Tint whole walls in neon colours, or use gradients on walls |
| Reserve gold for hooks, cinnabar seal for danger, cyan for the player | Use gold or vermilion as decoration where the player could grab or fear it |
| Write signs in real hand-bent calligraphy (麵 牙科 火鍋 茶 藥房 麻雀 旅館) | Use fake hanzi, or blocky pixel fonts for neon |
| Make the sky screens obviously *painted* and obviously *screens* (dot pitch) | Put a photographic sky anywhere below the Crown |
| Mock it before building: the wireframe/CAD failure mode is decided by the washes | Ship a post-only edge filter on top of the PBR look and call it jiehua |

---

## 6. Prompt-ready descriptions of the top 5 (for codex `image_gen` / Qwen-Image)

Each paragraph is the SCREEN block for one variant. Prepend the shared COMMON block (first-person game screenshot,
iPhone portrait, no device frame, shared HUD). All show Lantern Square, +125 m, blue hour, light drizzle.

**A. 界画霓虹 Jiehua Neon (recommended).** First-person portrait screenshot of a video game, standing on a wet granite
plaza halfway up a colossal vertical Chinese megacity at blue hour. The entire world is drawn as a Song-dynasty jiehua
ruled-line architectural painting on raw silk. Every building edge, floor slab, balcony rail, window mullion, air-con
unit, cage bar, pipe and cable is a ruler-straight hairline of black ink of constant width. The lines are crisp and
black near the viewer and fade to pale grey ink in the distance. Tower walls are flat, untextured washes of cool grey
ink with no gradients. Only a few things carry flat opaque mineral colour: azurite-blue and malachite-green glazed roof
tiles perched on concrete towers, a cinnabar-red lacquer paifang gate, green banyan leaves, red paper lanterns. The fog
between the stacked city levels is blank pale blue-grey silk with a faint visible weave, swallowing the lower levels in
horizontal bands. The only saturated colour is neon: hand-bent tube calligraphy reading "麵", "牙科", "火鍋", "茶",
"旅館" in magenta, cyan, jade and amber. Its glow bleeds softly into the silk like colour on wet paper. The flagstones
have ruled joint lines, and the wet stone mirrors the neon as long vertical colour streaks. The ceiling far above is a
grid of LED panels showing a flat painted blue-green sky with visible pixels. In the lower right the player's hand holds
a straight Chinese jian with a thin cyan-white glowing edge and a red silk tassel, drawn with a looser dry-brush
outline.

**B. 泥金磁青 Gold-on-Indigo Sutra.** First-person portrait screenshot of a video game on a wet plaza inside a colossal
vertical Chinese megacity at night. The whole world is drawn in fine ruler-straight lines of burnished gold ink on deep
indigo-dyed paper, like a medieval gold-ink sutra. Every building edge, balcony, window frame, pipe, cable and railing
is a thin gold line. The surfaces are left as flat indigo paper, with slightly darker indigo washes for shadow and a
visible paper fibre. The distant towers fade from gold to dim bronze lines, then vanish into indigo void. The fog
between stacked levels is a slightly lighter indigo haze. The only colour besides gold is neon: hand-bent calligraphy
signs "麵", "藥房", "麻雀" in magenta, cyan and jade, and vermilion paper lanterns, all glowing softly. Puddles double
the gold lines and stretch the neon into vertical streaks. The player's jian has a cyan-white glowing edge and a red
tassel.

**C. 工笔青绿 Gongbi Blue-Green Neon.** First-person portrait screenshot of a video game in a dense vertical Chinese
city, painted like a Song-dynasty blue-green landscape scroll crossed with "Along the River During Qingming Festival".
It has fine, even black ink contour lines on aged tan silk, and flat opaque mineral colours: azurite blue, malachite
green, ochre, cinnabar red, clamshell white and touches of gold leaf, with no shading gradients. There are crowds of
small, detailed people at mahjong tables, a steaming noodle stall and a shrine. Tower blocks of concrete are rendered as
pale ochre and white washes with blue-green tiled roofs. Stylised flat cloud bands with curled scalloped edges separate
the stacked city levels. Neon signs are flat bright pink, cyan and red shapes with a thin glowing halo and the
characters "茶", "火鍋", "旅館". The wet stone is painted as a darker blue-grey with neon colour reflected in vertical
strokes.

**D. 水墨霓虹 Ink & Neon.** First-person portrait screenshot of a video game in a vertical Chinese megacity, painted
in Chinese shanshui ink wash on unbleached rice paper. The towers are massed in with a wet, loaded brush: scorched black
near the viewer, diluted to pale grey with each block of distance. Edges break into dry-brush "flying white" streaks.
Large areas are left as blank paper where fog hides the levels below. The paper grain is visible everywhere. There is no
colour at all except neon and lanterns: magenta, cyan and jade calligraphy signs "麵", "牙科", and red paper lanterns as
dots of pure cinnabar. Their glow spreads into the damp paper with feathered, bleeding edges. The paifang gate is a few
bold black strokes. The puddles are pools of darker glossy ink with neon floating in them. The player's jian is one
confident calligraphy stroke with a cyan edge.

**E. 漆器 Lacquerpunk.** First-person portrait screenshot of a video game in a vertical Chinese megacity where every
surface is finished like Chinese lacquerware. The walls are mirror-deep black lacquer. Balconies and a paifang gate are
cinnabar-red carved lacquer in layered relief, with the layers visible at chipped corners. Every edge is traced with fine
gold lines, and gold leaf is crazed with craquelure. Mother-of-pearl inlay shimmers blue-green-pink on the sign frames.
Neon calligraphy signs "火鍋", "茶", "藥房" in magenta, cyan and jade are reflected sharply in every lacquered surface
as long coloured streaks. Dark amber smoky fog hides the levels below. The wet ground is black lacquer water. The
player's jian has a black-lacquer grip, a gold dragon-head guard and a cyan-white glowing edge.

---

## 7. Next steps (suggested, for Jake's pick)

1. **Decision board:** mock A–E on the Lantern Square frame, iPhone portrait, one side-by-side JPEG labelled A–E. Then
   mock A as a second frame, looking down the Yamen Well (the colour-script money shot).
2. If A wins, the first build lever is `jiehuaMaterial` on a greybox block + the depth-silhouette pass, benched on the
   phone tier. It stays behind a pause ▸ Settings ▸ Debug row, with no URL switch. B is one uniform flip in the same
   material, so ship it as a Debug variant from day one.
3. Moments from the other candidates, if wanted later:
   - Chungking step-print smear on sprint, grapple and glide;
   - 港漫 hatching for comic cutscenes;
   - lacquer finish on hero props (the yamen, the Jian);
   - 青花 porcelain for Shelter Market shop interiors.

## Sources

Games and film:

- Arcane: [80.lv](https://80.lv/articles/arcane-artists-show-how-they-combine-traditional-art-3d-for-backgrounds), [RedShark](https://www.redsharknews.com/why-netflixs-arcane-looks-so-good-how-fortiche-ramped-up-the-animation-pipeline)
- Spider-Verse: [AWN](https://www.awn.com/animationworld/creating-stylized-universe-sonys-spider-man-spider-verse), [CG Spectrum](https://www.cgspectrum.com/blog/spider-man-into-the-spider-verse-how-they-got-that-mind-blowing-look)
- Hi-Fi Rush: [GDC Vault](https://gdcvault.com/play/1034330/3D-Toon-Rendering-in-Hi), [GDC notes](https://www.foth.top/article/gdc-2024-hifirush-toonrendering-notes/), [80.lv](https://80.lv/articles/the-making-of-hi-fi-rush-s-3d-toon-rendering-style)
- Ōkami: [Wikipedia](https://en.wikipedia.org/wiki/%C5%8Ckami), [TCD sumi-e thesis](https://publications.scss.tcd.ie/theses/diss/2020/TCD-SCSS-DISSERTATION-2020-056.pdf)
- Sable: [Cook & Becker](https://www.cookandbecker.com/en/article/170/sable-exploration-through-line-art.html), [Heckel: Moebius post](https://blog.maximeheckel.com/posts/moebius-style-post-processing/)
- Jusant: [Destructoid](https://www.destructoid.com/interview-climbing-the-tower-with-jusants-art-director/), [Game Informer](https://gameinformer.com/2023/11/29/the-challenging-climb-to-make-jusant)
- Mirror's Edge: [EA Runner Vision](https://www.ea.com/news/runners-vision-in-mirrors-edge-catalyst)
- Stray: [UE interview](https://www.unrealengine.com/developer-interviews/28-people-and-two-cats-inside-the-making-of-stray), [CBR](https://www.cbr.com/stray-kowloon-walled-city/)
- Ghost of Tsushima / Yōtei: [GamesRadar](https://www.gamesradar.com/ghost-of-tsushima-kurosawa-mode-explained-how-it-changes-the-game-and-why/), [GameRant](https://gamerant.com/ghost-of-yotei-kurosawa-miike-watanabe-mode-explained/)
- Nine Sols: [Digital Trends](https://www.digitaltrends.com/gaming/nine-sols-taopunk-developer-interview/)
- Phantom Blade Zero: [GameRant](https://gamerant.com/phantom-blade-zero-kung-fu-punk-chinese-cyberpunk-setting-art/)
- Honkai: Star Rail, Xianzhou Luofu: [Siliconera](https://www.siliconera.com/honkai-star-rail-xianzhou-luofu-inspired-by-pre-qin-dynasty-myth-golden-era-sci-fi/)
- Realm of Ink: [indiegame.com](https://indiegame.com/en/archives/26511)
- Tengami: [Game Developer](https://www.gamedeveloper.com/programming/tengami-the-art-of-a-folding-world)
- Chungking Express: [Wikipedia](https://en.wikipedia.org/wiki/Chungking_Express), [analysis](https://deepfilmanalysis.com/chungking-express-1994-deep-film-analysis/)

Chinese art:

- Jiehua: [Wikipedia](https://en.wikipedia.org/wiki/Jiehua), [Britannica](https://www.britannica.com/art/jiehua), [Leqi Yu (HKU Press)](https://hkupress.hku.hk/image/catalog/pdf-preview/9789888754236.pdf)
- Yuan Jiang: [Met](https://www.metmuseum.org/art/collection/search/49227)
- Kowloon cutaway: [Colossal](https://www.thisiscolossal.com/2024/07/kowlooon-walled-city-illustration/), [Spoon & Tamago](https://spoon-tamago.com/detailed-cross-section-of-the-kowloon-walled-city-created-by-japanese-researchers/)
- Guo Xi: [Three Distances](https://baike.baidu.com/en/item/Three%20Distances/38162), [Guo Xi text](https://globalphilosophyresources.com/2018/07/19/guo-xi-the-interest-of-lofty-forests-and-springs/)
- Scrolls: [Wang Ximeng](https://en.wikipedia.org/wiki/Wang_Ximeng), [Qingming scroll](https://en.wikipedia.org/wiki/Along_the_River_During_the_Qingming_Festival)
- Gold-on-indigo sutras: [Met](https://www.metmuseum.org/art/collection/search/36451), [Cleveland](https://www.clevelandart.org/print/art/1994.25), [Asian Art Museum](https://education.asianart.org/resources/buddhist-manuscripts-sutras-of-the-goryeo-dynasty-918-1392/)
- Hong Kong neon: [HKFP](https://hongkongfp.com/2023/04/16/its-disappearing-very-fast-hong-kongs-fading-neon-heritage-shines-a-spotlight-on-the-craft/), [NEONSIGNS.HK](https://www.neonsigns.hk/neon-in-visual-culture/neon-fades-out/?lang=en)
- Yuefenpai: [Snow Pavilion](https://snowpavilion.co.uk/national-day-thoughts-the-yue-fen-pai-calendar-posters/), [USC: Zheng Mantuo](https://scalar.usc.edu/works/republican-era-chinese-posters-as-seen-from-the-university-of-southern-california-library-collection/the-poster-artist-zheng-mantuo)

Tech:

- Omar Shehata: [outlines](https://omar-shehata.medium.com/how-to-render-outlines-in-webgl-8253c14724f9), [code](https://github.com/OmarShehata/webgl-outlines)
- Ben Golus: [grid shader](https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8)
- Maxime Heckel: [painterly shaders](https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders/)
- Codrops: [Susurrus](https://tympanus.net/codrops/2026/04/24/susurrus-crafting-a-cozy-watercolor-world-with-three-js-and-shaders/), [sketchy pencil](https://tympanus.net/codrops/2022/11/29/sketchy-pencil-effect-with-three-js-post-processing/)
- Kyprianidis: [anisotropic Kuwahara](https://www.kyprianidis.com/p/gpupro/)
- Lingdong Huang: [shan-shui-inf](https://github.com/LingDong-/shan-shui-inf)
- Apple: [TBDR, WWDC20](https://developer.apple.com/videos/play/wwdc2020/10602/)

Performance figures in this doc are estimates. The bench on the phone tier decides.
