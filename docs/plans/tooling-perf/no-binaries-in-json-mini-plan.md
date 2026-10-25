# No binaries inside JSON: mini plan (G649)

**State:** `in flight` 2026-10-25 (sp-x9, G709). B1/B2 are implemented and reverified;
B3's alias gap is closed in `82060b4664`. B4–B6 remain open. JSON is UTF-8 text. Binary data inside it (base64 strings, data URIs, number arrays standing
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
| B1 | **done (`12623d249c`, reverified 2026-10-25).** `scripts/no-binary-json.mjs` checks exact staged JSON, every pushed revision and CI's full tree; shrinking exact-path debt stays enforced. Current full-tree scan passes. | a new JSON with base64 cannot be committed or pushed |
| B2 | **done (`e1a23e7e74`, reverified 2026-10-25).** Shared JSON serialization rejects typed byte values; shared writer, SDK authoring driver and generation publication check encoded bytes against exact-path debt. | `gen` fails on a binary-in-JSON output |
| B3 | **done (`385b8c14ad` + `82060b4664`).** `wildshard/no-base64` refuses codec calls in source/tools, including native destructuring and detached `Buffer.from` aliases. Hex/ordinary helpers remain allowed; exact source debt can only shrink. | rule on; burn-down list for existing sites |
| B4 | Nine: `lightSpill`, `paintArray`, `castHook`, `glyphs`, `signAtlas`, `heldDecals` → `.bin` / `.glb` / `.ktx2` files the next step reads (128 MB of base64 gone) | none left in Nine |
| B5 | Nalati, Pine, Driftwood: `poiPaint`, `grass`, `geography`, `physics*`, `peopleFallback`, `shapeBook`, `heldWeapons`, `riding`, `island-plan` → binary files | burn-down list empty |
| B6 | Shard files: binary sections stay binary end to end (no base64 at run time either) | the runtime has no base64 decode of content |

Order: B1–B3 first (stop the bleeding), then B4 (biggest), then B5–B6. Generator redesign (G648/G650) decides where the
binary files live; until then they go next to today's outputs, outside the TypeScript import graph.

## Current slices (2026-10-25, G711)

| Slice | Status | Boundary |
|---|---|---|
| B1–B3 verification / alias refusal | done (sp-x9, `82060b4664`) | Existing 34 cases pass; a new hostile alias case reproduces the gap and passes after the syntax fix. Real CLI refuses both browser codecs and Buffer factory aliases. No policy allowance grows. |
| B4 Nine glyph byte handoff | done (sp-x9, `d6ddd4060d` + `2405df3b5f`) | Native authoring WebKit transfers compressed glyph blocks as bounded binary request bodies, without base64 strings or numeric JSON arrays. Native phone/desktop `--check` preserves every `.bin` and metadata byte: 2,097,152 / 8,388,608 decoded bytes; 282,685 / 1,245,438 wire bytes. Remaining optional pre-conversion reference decoding is an oracle only. |
| B4 Nine sign-atlas byte handoff | done (sp-x9, `8c362ceec7`) | Browser-to-Node geometry and PNGs use binary bodies. Native phone/desktop `--native-inputs --check` preserves both geometry bins, four KTX2 files and the metadata exactly. Each tier retains 401 geometries / 370,392 raw geometry bytes, removing 495,456 intermediate base64 characters plus both PNG data URLs. Three codec allowances disappear; generator import count is unchanged. |
| B4 Nine decal byte handoff | done (sp-x9, `dbbe7eec44`) | Native canvas PNG and original RGBA pixels use binary bodies; only dimensions enter the browser result. Both native `--check` outputs stay byte-identical: phone 1024×512 / 98,653 PNG bytes, desktop 2048×1024 / 270,663 PNG bytes. All 10,485,760 original RGBA bytes still match decoded pixels. Removes 14,473,440 intermediate base64 characters and three codec allowances; texture and route cleanup run on errors too. |
| B4–B5 current census / first conversion | in flight (sp-x9) | Current scan: 51 files / 6,155,420 base64 characters. Four exact frozen legacy files hold 2,642,412; they remain held for LD under G606. Five modern generated JSON files hold 55,472; reports/fixtures hold 3,457,536. Thirty-four source/public data URIs remain. Identify the owning producer before conversion; preserve concurrent GR3/GR4 work. |
| B6 named scene-buffer files / Nine portal sparks | done (sp-x9, `9c2ae3bc03`) | Scene buffers accept exactly one inline or verified named binary source. Admission checks declared lengths, bounded paths, alignment and finite words before allocation; geometry copies verified bytes and keeps sharing/disposal laws. Nine's five portals retain all 5,760 float32 bytes as three dependency-tracked binary files, removing 7,680 base64 characters. Existing inline readers remain for unconverted callers. |
| B4/B6 Nine presentation channels | done (sp-x9, this commit) | All 45 original typed-channel slots retain their byte hashes, storage, sharing, instancing and ordered draw metadata. Forty immutable binary files hold 358,276 unique bytes; three descriptors shrink from 491,384 inline bytes to 17,744 metadata bytes. Total metadata plus raw payload is 376,020 bytes; 477,948 base64 characters disappear. Existing identical open/capped rows still share descriptors and binary dependencies. |
| B6 remaining binary section admission | open | Keep content binary through product/runtime boundaries; do not delete a decoder while declared or exact frozen legacy callers still use it. |
