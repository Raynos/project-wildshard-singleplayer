# No binaries inside JSON: mini plan (G649)

**State:** `open` 2026-10-23. JSON is UTF-8 text. Binary data inside it (base64 strings, data URIs, number arrays standing
in for bytes) is **banned**: in committed files, generator outputs and shard files alike.

Jake, 2026-10-23: *"make a new mini plan called no fucking binaries inside JSON. Like JSON is supposed to be UTF-8, you
can't embed binaries inside JSON because then you're base64ing it … that's fucking banned. Like, we need a lint rule, we
need a hook or something."*

## Today (plan-agent scan, 2026-10-23: base64 runs of 1 KB or more in `*.json` under src, public, scripts, test, lint)

**77 files hold 153 MB of base64**: 22 committed, 55 generated. The biggest:

| Base64 | File | |
|---|---|---|
| 52.1 MB | `nine-dragon-stack/data/lightSpill.generated.json` | generated |
| 46.7 MB | `nine-dragon-stack/data/paintArray.generated.json` | generated |
| 29.4 MB | `nine-dragon-stack/data/castHook.generated.json` (GLB models) | generated |
| 2.6 MB ×2 | `nalati-grasslands/{data,boot}/poiPaint.json` | committed |
| 2.0 MB | `nine-dragon-stack/data/glyphs.generated.json` | committed |
| 1.5 MB ×2 | `nalati-grasslands/{data,boot}/grass.generated.json` | generated |
| 1.1 MB | `nine-dragon-stack/data/signAtlas.generated.json` | committed |
| 1.1 / 0.8 / 0.5 MB | `physicsRows.json` / `physics.generated.json` / `physics.baked.json` (Nalati, Pine, Driftwood) | both |
| 0.5 MB ×2 | `public/assets/driftwood-isle/baked/island-plan-*.json` | shipped |

## Rows

| Row | What | Done when |
|---|---|---|
| B1 | **The check:** `scripts/no-binary-json.mjs` refuses any JSON holding a base64 run ≥ 1 KB or a `data:` URI; runs in pre-commit (staged JSON, inside G636's parallel set), the push gate and CI. Today's offenders sit in a burn-down list that only shrinks; anything new is refused | a new JSON with base64 cannot be committed or pushed |
| B2 | **Generator write guard:** the one shared JSON writer the generators use refuses base64 / byte strings, so a generated output fails at `pnpm gen`, not later | `gen` fails on a binary-in-JSON output |
| B3 | **Lint rule** `wildshard/no-base64`: no `toString('base64')`, `btoa`, `atob`, `Buffer.from(…, 'base64')` in src, scripts or generators | rule on; burn-down list for existing sites |
| B4 | Nine: `lightSpill`, `paintArray`, `castHook`, `glyphs`, `signAtlas`, `heldDecals` → `.bin` / `.glb` / `.ktx2` files the next step reads (128 MB of base64 gone) | none left in Nine |
| B5 | Nalati, Pine, Driftwood: `poiPaint`, `grass`, `geography`, `physics*`, `peopleFallback`, `shapeBook`, `heldWeapons`, `riding`, `island-plan` → binary files | burn-down list empty |
| B6 | Shard files: binary sections stay binary end to end (no base64 at run time either) | the runtime has no base64 decode of content |

Order: B1–B3 first (stop the bleeding), then B4 (biggest), then B5–B6. Generator redesign (G648/G650) decides where the
binary files live; until then they go next to today's outputs, outside the TypeScript import graph.
