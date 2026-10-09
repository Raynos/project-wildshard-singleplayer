# img-fallback: the image fallback after a KTX2 probe veto (E435)

2026-10-08, img-fallback builder (Opus). Context: the KTX2 capability probe (`ae79fa22a`) turns the iOS Simulator to images
(sRGB ASTC and ETC2 mips read as zeros), and Pine on the image path peaked at 1,229 MB (WebContent 762 + GL 468) in the
SF57 soak.

## Finding 1: the phone images are already at the KTX2 set's size

Every phone KTX2 stand-in was compared with the image it replaces (KTX2 header vs `magick identify`, all
`ktx2.generated.ts` tables): **111 of 113 have the same dimensions**. The other two differ only by the 4-px block rounding
(Nine Dragon's scroll 1674 → 1676 wide, Nalati's panorama 758 → 760 high). `loadTexture` caps both paths at the same
`maxSize` (the KTX2 path drops top mips, the image path decodes smaller), and `ktx2Layers` / `loadPBRArray` trim both to the
layer size. GLBs: bake-ktx2 encodes embedded images at their own size (`fit(…, 16384)`). So there is no full-resolution RGBA
where the KTX2 texture was half or quarter size, and no smaller image set to generate without changing the look. **The
gap is the format alone**: RGBA8 is 4 bytes a texel (5.3 with mips) against ASTC 4×4's 1 and ETC2's 0.5.

## Finding 2: where the image path's GPU bytes go (Pine standalone, phone, Chromium, `scripts/gpu-texmem.mjs`)

Build `58f493f9` (sp-x4's preview), iPhone UA, 390×844 @3, muted. Files: `chromium-pine-standalone-{img,ktx2}.json.gz`.

| | images | KTX2 |
|---|---:|---:|
| textures (MB) | **466.2** | **148.6** |
| sRGB colour (SRGB8_A8) | 213.5 (89) | 49.0 SRGB_ASTC + 14.3 SRGB8_A8 |
| normal maps (RGBA8) | **168.0** (60): 114 standalone files, 48 GLB-embedded, 6 runtime | 41.4 ASTC (linear, all classes) |
| data planes ARM / ORM (RGBA8) | 48.3 (33) | 5.4 ETC2 + 5.3 RGBA8 |
| render targets | 84 | 84 |

## The change (`linearKtx2Texture`, core/ktx2.ts)

The Simulator's probe reads **linear `RGBA_ASTC_4x4` right at every level**; only the sRGB ASTC and ETC2 targets fail. So
on a page the probe vetoed, a linear UASTC file (bake-ktx2's `normal` / `linear` classes: tangent-space normal maps,
lightmaps, the cloud field) keeps its KTX2 stand-in through its own loader with ASTC on: the same file and look as the
KTX2 path, a quarter of the image's bytes. sRGB colour, ETC1S data planes and GLBs stay images. Anything that does not come
back as linear ASTC is dropped and the image loads. Every other page (KTX2 pages, plain image pages, desktop) is
unchanged: the function returns null unless the probe ran, vetoed and passed linear ASTC.

Expected on Pine (from the table): the 114 MB of standalone normal maps → ~29 MB, about **−85 MB GPU**. Not measured on
the Simulator yet (the only place the veto fires); see "Left".

## Left (the brief's proof list, not done in the 90-minute cap)

- Simulator before / after on the fixed ruler (`native.mjs`, `--vmmap=last`), Pine centre / entry, Nalati, Sky Reach,
  ≥ 3 cold runs: not run (the heavy lane queued every build for > 20 min; the Simulator was not requested).
- The remaining gap is sRGB colour (213 MB) and GLB-embedded normals (48 MB). Neither shrinks without a look change: a
  one-mip-lower colour set on the fallback (¼ the bytes) or 16-bit formats. That is a Developer row + board for Jake.
- GLB decoded images (WebContent): kept, because trophyWall / coats / figureRig read `map.image` of GLB textures.
