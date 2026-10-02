# 02 · The GitHub repo and the project page, audited in full

Read 2026-10-01 (E359). The repo [Tencent-Hunyuan/Hunyuan3D-WorldClaw](https://github.com/Tencent-Hunyuan/Hunyuan3D-WorldClaw)
has **two branches**. `main` is the visible repo. **`web` is the project page's full source**, and its contents never
show on the repo's front page. Both were read file by file. The web branch was cloned (50 commits deep, 278 MB with
media). Its prose, data and media were read, and the 91-second reel was watched frame by frame every 2.5 s.

## 1. `main`: there is nothing to run

| | |
|---|---|
| Created | 2026-08-05 (the paper's submission day) |
| Files | `README.md` (1,333 bytes: badges, the teaser, the pipeline image, a BibTeX), `assets/teaser.jpg`, `assets/pipeline.jpg`, `.gitignore` |
| Commits | 3: "Initial commit: WorldClaw paper README and assets" (2026-08-10, co-authored by Cursor) and two README edits (08-10, 08-13) |
| Licence | **none** (GitHub reports `license: null`) |
| Code / weights / API | none |
| Stars | ~1,340 (2026-10-01) |

**Issues** (all open, no maintainer reply on any):

| # | Date | Title | Gist |
|---|---|---|---|
| 1 | 08-10 | No code in here | "When release?" plus +1s; one user proposes having Qwen 3.8 "replicate the idea … openworldclaw" |
| 2 | 08-23 | Code Release Please | empty body |
| 3 | 09-01 | Add auditable OSS replacement workflow | empty body |
| 4 | 09-14 | Questions about online demo, downloadable maps, and modular export for game engines | asks for a demo, downloadable `.blend` / `.glb` scenes, **per-region export** (`snow/terrain.glb`, `rocks.glb`, …) and engine concerns: streaming, collision, navigation. The same questions we have |
| 5 | 09-20 | Paraíba | a user pasting a world prompt (a Brazilian market) as if the repo were a service |

**Timeline signal.** The web branch's commit "update: drop the Code button from the hero" (2026-08-07 03:43) removed
the code link before launch. "bring back the hero's repo link, labelled GitHub" (08-10) points it at this README-only
repo. Nobody should plan on a code release.

## 2. `web`: the project page's source

A Vite 8 + React 19 + TypeScript site (`package.json` "license": "MIT", for the page code only). It deploys to GitHub
Pages from a workflow. It has 18 commits, 2026-08-03 → 08-10. The site footer: "all images, 3D assets, and other visual
content … are owned by Tencent. No rights or licenses to Tencent-owned content are granted." So we may look at and
learn from the media, but **not ship or redistribute it**.

### 2.1 What the page shows

| Section | Content |
|---|---|
| Hero | "Agentic 3D open-world generation at scale"; four rotating season renders of **one** world (spring / summer / autumn / winter), each with an asset note (§2.2) |
| Teaser | "A world from a single sentence." The 91-s reel (§2.4) |
| Results | 11 worlds (§2.3). Each has: the prompt; an isometric layout render (alpha cut-out on a 1200×878 canvas); 3 orbit + 3 walk stills (640×480 tiles, 1600×1200 lightbox); four synchronized 960×540 / 30 fps clips of **one camera orbit rendered four ways**: RGB, instance masks, normals, depth ("metric scene distance") |
| Abstract | the paper's, verbatim |
| Method | the three stages with formulas and figures. **Eq. 6 is printed with the region weight outside a bracket**: `H(x) = Σ_r m̃_r(x)[h_r + Σ_k w N + Σ_j α G]`, captioned "Soft region weights blend each region's base elevation with multi-frequency noise and geomorphic operators — peak, dune, terrace, erosion". Fig. 3's caption: "Both loops re-render after every edit, so failures are caught on the image rather than in the scene graph." |
| Conclusion | "Structure first, detail second." Future work: code-native 3D modeling and production engine integration ("large game worlds also need runtime procedural generation, navigation, physics, and interaction") |
| Attributions | 12 third-party models (§2.2) |

### 2.2 The asset notes: what is generated and what isn't

`src/data/content.ts` gives each hero season an `assetNote`, verbatim:

| Season | Note |
|---|---|
| Spring | "Scatter assets are built through 3D coding; all other objects are produced by 3D generative models." |
| Summer | "Scatter assets are **sourced from Sketchfab**; all other objects are produced by 3D generative models." |
| Autumn | "Scatter assets and all other objects are produced by 3D generative models." |
| Winter | "Scatter assets and all other objects are produced by 3D generative models." |

`src/data/attributions.ts` lists the Sketchfab models, **all CC BY 4.0**:
- Low Poly Grass Pack and Low Poly Flowers (Anskar);
- Reed Plants Pack (Nicholas-3D);
- Lilac bush pack ("12 vars, LODs, game ready", LOLIPOP);
- Realistic Tree (Daniel);
- Cattail Plant (SXuno);
- Stylized Fence (Mr. Compotchino);
- Deciduous Tree with Leaves (Sereib);
- Old Wooden Bench (Nikoleta.Zhecheva);
- Stylized Wooden Sign (FrieDev);
- Wooden Picnic Table (Mark Peters);
- Stylized Pine Tree (Batuhan13).

**What this means:** the system's scatter layer takes **three sources**: code-built (procedural), stock assets, or
generated. The prettiest vegetation in some marketing shots is stock. For us this confirms the split our model contract
already makes: scatter models can be CODE, CC0 (or CC BY with credit), TRELLIS or HUNYUAN. The plan picks per model.

### 2.3 The eleven worlds (scene ids, names, sizes, prompts)

The page sorts worlds into **compact** (`case*_small`) and **large** (`case*_large`):

| id | Name | Type | Prompt |
|---|---|---|---|
| frontier-mosaic | Frontier Mosaic | Multi-biome village | medieval village; snow-capped mountains, plains, water, desert; animals |
| snowline-village | Snowline Village | Compact snow world | snow village along both sides of a river |
| painted-dunes | Painted Dunes | Desert landforms | desert adventure camp ringed by massive coiling dragons |
| island-settlement | Island Settlement | Compact island | tropical pirate stronghold, One Piece |
| grand-canyon | Grand Canyon | Large canyon world | river through a canyon; tribal villages on cliffs and floor |
| azure-archipelago | Azure Archipelago | Large island world | island with several Japanese-style towns, ocean around |
| ember-caldera | Ember Caldera | Large volcanic world | glowing lava; the volcano is a demon's lair |
| desert-frontier | Desert Frontier | Large desert world | PUBG-style desert battlefield for large PvP |
| frontier-mine | Frontier Mine | Industrial terrain | gemstone mine with excavation equipment |
| verdant-valley | Verdant Valley | Large mountain valley | realistic valley, Hobbit-style villages under hills |
| snowbound-outpost | Snowbound Outpost | Large snow world | Red Alert-style snow valley, high-tech buildings |

**Audit finding.** `grand-canyon` and `verdant-valley` have their media swapped. The "Grand Canyon" layout and walk
views show the green mountain valley with Hobbit holes. The "Verdant Valley" ones show the canyon with the river and the
tribal huts. Small, but it says the page was assembled by hand under time pressure.

### 2.4 The 91-second reel (`public/media/worldclaw-teaser.mp4`, 1920×1080, 24 fps)

| Time | Shows |
|---|---|
| 0–4 s | title card |
| 5–18 s | Snowline Village: a slow orbit; dense cabins, pines, a church, a frozen river; cliffs as tall white walls behind |
| 20 s | card: "Generate a Desert Battlefield like PUBG" |
| 22–26 s | the desert mesas: watchtowers, radar dish, barrels, solar panels |
| 27.5 s | depth and normal wipe |
| 30 s | "Instance Map": every object a separate flat colour |
| **35 s** | **the object library: about 100 unique generated assets laid out in a grid above the desert** (crates, barrels, signs, rocks, palms, towers, vehicles). That is the size of one large world's catalog |
| 37–43 s | desert walk views |
| 45 s | card: "Generate a Japanese-style towns" |
| 47–55 s | Azure Archipelago at walk height: palms, Japanese houses, a torii, a "General Store" sign, lanterns |
| 57.5 s | card: "Generate A Snowbound Outpost" |
| 60–68 s | outpost: tanks, a hangar, a bunker; close-ups show soft generated geometry |
| 70 s | "High quality geometry and texture at instance level": 4-way split (RGB / clay / normal / instance) |
| 72–90 s | 4-way splits of the snow village, a frozen lake, the pirate island |

### 2.5 What the released media shows that the paper doesn't say

- **Scale.** Every world is shown as a tabletop **diorama**: a square slab with steep skirts, viewed from orbit. Walk
  views sit about a person's height above ground, but nothing gives metres. The layout renders put the whole world in
  one frame with buildings readable from above. Our guess from the walk views: a few hundred metres across, densely
  packed.
- **Density over space.** Regions are packed shoulder to shoulder with props. There is very little open space, no
  readable paths between places, and no long sightlines. That suits a still render. **A level needs routes, rest and
  reveals.**
- **Visible defects at walk height** (in Tencent's own chosen stills):
  - lamp posts and pots floating on sand (Frontier Mosaic walk 3);
  - stretched cliff textures on vertical walls (Grand Canyon / Verdant Valley);
  - blurry low-frequency terrain textures underfoot;
  - repeated assets;
  - a house on water (raised on Hacker News).
- **Cliffs are walls.** Terrain relief is made with terraces and vertical drops. That reads well from above and is not
  walkable. Our player climbs ≤ 40° with a 0.35 m step.
- **Style is uniform.** One look across all 11 worlds: soft image-to-3D meshes with baked-looking textures, toy
  proportions, bright sky. The prompts' "realistic" worlds come out in the same look.

## 3. Outside commentary

- **Hacker News** ([thread](https://news.ycombinator.com/item?id=49265051)).
  - Praise: "an image model performs the composition (which image models are really good at), and then you extract the
    objects into 3d via things like SAM3D" (avaer); LLMs are "amazing and flexible constraint solvers, and are woefully
    underutilized" for PCG (torginus).
  - Criticism: cherry-picking (a house on water), "too cartoonish", "utterly devoid of any soul" (handcrafted vs
    Starfield-style generation); re-rolling a failed constraint means "expensive verification" (Marazan).
  - "Claude knows Blender" and can build the LOD pipeline (avaer).
- **Write-ups** (orcarouter.ai, vp-land.com, aitoolsreview.co.uk, kompozy.io, explainx.ai) add nothing beyond the
  paper. They agree: no code, no weights, no API, no pricing, and the agent is Claude Opus 4.8, "not a new model".

## 4. Audit verdict

1. **Not reproducible as released.** There is no code, the skills' prompts and schemas are unpublished, and there are
   no numbers. The method is fully described at the level of stages, equations, skill names and loop shapes, which is
   enough to rebuild it.
2. **Its quality bar is a render, not a game.** Dense dioramas, cliffs as walls, floating props, uniform style, partly
   stock vegetation. Our version must be judged by **walking and playing on the phone**.
3. **Its useful inventions:**
   - the layout map → Eq. 6 height field (an LLM writes per-region terrain programs from a painted map);
   - masked scatter with samplers as data;
   - paint-then-lift with a recorded camera (the image model does the composition);
   - ray-pair placement with a contact search;
   - check-function refine loops with budgets (3/5 terrain, 6/15 per region);
   - re-render after every edit.
4. **What it leaves to us:** walkability, navigation, colliders, LODs, budgets, streaming, a level's structure and
   pacing, and a shard's own art style. Those are the bulk of a shard, and they are where [04](04-our-pipeline.md)
   spends its words.
