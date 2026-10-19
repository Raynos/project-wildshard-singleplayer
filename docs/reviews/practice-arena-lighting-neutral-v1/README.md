# Arena neutral-fill v1 runtime study

Unaccepted lighting candidate. The purple cast is reduced, but dark-side cream still reads ochre/olive in real movement; this is not a completed lighting fix or overall model/animation acceptance. Native cream/palette bytes are unchanged. Independent review and separate hemisphere/toon-lift isolation determine the next bounded choice.

## Identity and parity

Source checkpoint: 06ce127f51cd8663bca67166b62b6e35d9f1c184, on top of the authored-recoil source a617d3d718e34437104d28842f97d2d713772479. The existing clean engine baseline remains c4339d90a93ccc289540e3a72c1e9cbf221d98fb. V70 gait5 uses neutral-studio-v1 fill and optional contact-v1 AO. Product sourceHash42dfa4fffc90e251320c760e83a4e11b2d887e4b792edffb3204550cd2514fd7; profile SHA0e39d9246fd4e547fc5ef087fb2bd3467538aef2d3a5966885ad4d112e729765. The preview receipt carries the exact original/weighted native, dimensions, measurement, rig, packed body and unchanged gait-wrapper pins.

App inventory:137files,9,148,319bytes; inventory SHAe36e446bf3e9be2ac019977224f3b2019092f0c868c9c99a68a44af7009adeff. Build terminal0. Regenerating with profiles omitted preserved all50 prior product/pack/receipt files byte-for-byte, including preview SHAc5aa8a779e7a688e034eeb46c1e2a1322d51cc4048c443be39f66ccbba637134. Previous live/fallback apps and baseline evidence remain intact.

## Actual normal renderer and inputs

Both runs use real Start, W approach, Lock, right and left strafe before Pause. Those three real screenshots and the raw videos show the actual candidate renderer with no pose or actor-state clamp. The later views are explicitly labelled paused camera-only old/new profile diagnostics. They keep the exact actor, all bone-world matrices, camera and fixed-world key for each pair. The old-profile control restores only the old hemisphere, toon lift/rim and optional desktop AO values; it does not substitute a mesh or a historical app.

Desktop cloud:480actual rendered-frame samples,18matched stills,three real stills;390x844 buffer,DPR1,three shadow cascades,four enabled normal passes including AO. Contact AO radius0.4m/intensity1 retains the prior sample/denoise/half-resolution settings.

Phone-policy emulation in cloud Chromium:387actual rendered-frame samples,12matched stills,three real stills. iPhone UA on Linux,deviceDPR3,rendererDPR2,780x1688 drawing buffer,one shadow cascade,three enabled normal passes and no AO. This proves the selected policy and preserved2x render setting, not real iPhone hardware/Safari behavior or performance. Native screenshot raster is1170x2532 because the emulated display DPR is3; the renderer remains2x. Encoded video frame counts are not the reported actual rendered-frame counts.

Both runs terminated0 with no page/HTTP errors and empty localStorage,sessionStorage,IndexedDB,CacheStorage,service workers and cookies. This candidate coverage is app-root only; mounted-prefix QA and promotion remain pending. Combat/recoil source and packed geometry remain unchanged, but this lighting run is not a new full combat/death audit. The known V70 corpse floor failure remains unresolved.

## Matched measurements and image encoding

All captured paused bone matrices are exact; the sun and CSM direction have zero measured variation. Exact native-projected masks compare raw PNGs, eroding2CSSpixels from the silhouette. Neutral lighting alone changes mean desktop creature luminance by+7.65 to+12.90/255; with the separate AO adjustment the change is+20.14 to+24.31. Phone-policy change is+8.25 to+15.98. No masked pixel clips all three channels at250or above. These descriptive metrics do not establish cream color fidelity, shadow quality or visual acceptance.

The ordinary desktop WebPs are lossless. The larger phone screenshots use WebP quality90 at their full native screenshot dimensions to meet repository image limits; original PNG hashes remain pinned and raw files are retained. Numerical comparisons use the original PNGs. Compact receipts retain every scalar sample and full matched-shot transforms; raw video/capture hashes are preserved. The portable capture script differs from the executed source only by replacing the local Chromium executable path with CHROMIUM_EXECUTABLE. Run it through the browser lane. The analyzer takes the clean capture root as its argument.
