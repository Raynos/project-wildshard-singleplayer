# Practice arena lighting diagnosis

## Finding

The reported lighting swing is reproduced on the preserved V57 gait5 app, with the normal renderer and real Lock/strafe input. Its native SHA is7d27737df2bd9b1c7b81fd8eff97fbf5fc4fa02f9eba85faeeacd646cc481dcb; wrapper54662e9d697533877bb2c7cbe0a29ae415769416d6db3223558a1ab67feeb15d. V70's authored-recoil change does not modify these lighting sources.

This is excessive arena art tuning plus expected world-light shading, not evidence of a camera-attached light or corrupted view-space normals. All three directional lights are registered world-sun shadow cascades, parented to Scene. Their direction and intensity stay fixed; camera-following shadow-map positions are expected. The actual sun vector is[.38411064,.76822128,.51214752], intensity2.7; blue hemisphere intensity.9. The real strafe turns enemy yaw from about0 to2.8877rad to follow the player, so the same front face changes its world orientation to the sun. Cream lit bands become deep brown/purple shade under this outdoor look.

The frozen-world orbit keeps every actor/bone world matrix exactly unchanged. Thirteen views complete360degrees; returning to the original camera gives pixel-identical creature pixels. The admitted flat-shaded toon material has no normal map. Its authored roughness.85 exceeds gloss cutoff.72, so sun specular is disabled; the explicit warm toon rim is the remaining intentional view-dependent edge term. The separate DummyStudio shader is not used for this creature.

## One-factor evidence

Normal gameplay+orbit:396actual samples. Matched normal/noAO/no-received-shadow:335samples, six angles and18stills. Matched normal/no-rim:158samples, four angles and8stills. All runs terminated0 with zero runtime/HTTP errors. Controlled views are visibly labelled paused camera-only diagnostics, not real movement proof. The original real movement footage is separately labelled. All four normal post passes and shadows remain enabled in normal views.

The renderer's AO radius2.5m and intensity2.5 are large for this approximately metre-sized creature. Removing AO increases creature-only mean display luminance by5.23–15.27/255 across six matched views; removing received shadows changes0.02–4.20. Removing rim changes−1.02 to−1.79 across four matched views. These are descriptive image differences, not quality scores. Pixel masks use the hash-pinned weighted native and recorded camera/bone matrices, with a2px silhouette erosion. All matched transforms are verified exact. AO and self-shadow effects are view dependent; AO is the larger measured contribution here. Some small self-shadow artifacts remain separate from the large body-lighting swing.

## Recommended bounded candidate

Use an arena-only authored neutral fill, retain the fixed world key and lit facets, replace the purple ambient lift with neutral fill, and modestly reduce the warm rim. Start AO at a contact-scale radius0.4m/intensity1, retaining real contact darkening. Preserve actual vertex palette, topology, camera controls and normal rendering. Do not use emissive/unlit bodies, a camera-following light, actor clamps or global engine/world default changes. Exact candidate values and acceptance require a separately pinned build and matched normal angles plus actual strafe review; no lighting fix is accepted by this diagnosis.

## Artifacts and limits

Receipts preserve exact raw video/capture/source hashes, all sampled scalar rows and all matched shot transforms. The fifteen ordinary WebPs are representative lossless conversions; every original PNG hash is listed, and all raw shots remain locally preserved. The analyzer is a portable copy: pass the clean capture root as its first argument. Capture scripts replace only the browser executable path with CHROMIUM_EXECUTABLE and must run through the browser lane.

Cloud viewport390x844/DPR1 with desktop-class AO is not iPhone performance or renderer parity. The phone tier normally has no AO, so the world-key/fill/rim findings transfer more directly than the measured AO magnitude. No global normal-space/shadow bug is established. The V57/V70 corpse-contact issue remains independent.
