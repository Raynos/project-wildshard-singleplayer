# Round 6: midway mockups (the in-engine screen, done properly)

Each image is a codex **edit of the in-engine iPhone capture** (`../round-5-engine-vs-mockup/`, left half). It
keeps the same screen, layout, UI text, model and camera angle, and shows the screen finished to a premium
dev-tool standard. The round-3 / round-4 mockup was attached as a style reference only. These sit between
what ships today and the full mockups, and they are the target for the polish plan.

**Recipe**: `codex exec -s workspace-write -i <engine capture, 1600 px high> -i <matching mockup> "<prompt>"`
(codex-cli 0.156.0, model `gpt-6-sol`, built-in `image_gen`, 1024x1536). Seven runs ran in parallel, and each
run copied the path that its own `image_gen` call returned. The prompt was a shared block plus one SCREEN
block per image: keep the screen, text and model verbatim, then add a dark studio gradient, a grid fading into
fog, a glass turntable with a cyan rim, a contact shadow and reflection, key / fill / rim lighting, frosted-glass
panels with corner brackets, and a soft cyan glow. 04 and 09 were regenerated once: the first 04 kept the
broken navy boulder, and the first 09 came back 853x1844.

| File | Screen | What changed vs in-engine |
|---|---|---|
| `04-world-select.jpg` | World: select | Boulder selected (cyan outline, bbox + dimension tag, glass card "Open in model explorer / Orbit / ✕"); navy boulder → grey granite; telemetry on a glass strip; bottom blur gone; sparkling water. (The rock gained texture detail, which is more than the flat-shaded game model has.) |
| `05-world-map.jpg` | World: map sheet | The same flight view above a glass map sheet: "DRIFTWOOD ISLE", spawn / close, a rendered top-down island, pins, a view cone, north arrow and scale. |
| `06-model-catalog.jpg` | Catalog | Same grid, names and counts. Every thumbnail is a studio shot (dark gradient, glowing disc, auto-framed so the pier, jetty and bridge fill the card), and the cards are glass with brackets. |
| `07-model-turntable.jpg` | Turntable: hut | Flat sky and navy disc → dark studio, glass disc with a cyan rim and ticks, reflection, rim light; the hut is framed about 3× larger; glass bottom sheet. |
| `08-model-facets.jpg` | Turntable: facets | Same as 07, with glowing cyan facet edges over the solid hut; the FACETS toggle is readable. |
| `09-model-tiers.jpg` | Turntable: tiers | The two palms stand side by side with their own chips ("DESKTOP · 507 tris", "PHONE · 407 tris"). The overlapping labels are fixed. |
| `10-model-creature.jpg` | Turntable: boar | Studio stage, cyan rim light along the mane, reflection, the boar framed about 60 % of the width. |

What they show: the chrome (bars, toggles, info panel) barely moves. The jump comes almost entirely from the
**studio stage + lighting + framing** around the model, which is one shared three.js scene.
