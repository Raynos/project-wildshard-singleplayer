# Round 7: training dummy rebuild (E285, 2026-09-29)

Jake: "the models have weird hands and other glitches and they don't really move much … I don't think we animated or
rigged them", then "Fix the models and the graphics by any means necessary." This round rebuilds the three meshes
and gives them a real skeleton. The hit motion itself is round 8 (`../round-8-arena-motion/`).

**Pipeline** (`scripts/practice/build_dummies.sh`):

1. **New references** (`ref-*.jpg`): codex `image_gen` edits of the round-3 refs. Each has closed, solid fists and
   bound, solid straw with no loose strands. The arms hang clear of the body, and each figure stands on a cross-foot
   post. Two takes per figure; the picks were straw take B, wood take A and steel take B. Steel take A was too bulky.
2. **TRELLIS.2** (`1024_cascade`, seed 42), all three figures.
   - I also ran Hunyuan3D-2 (full shape + turbo paint) on the same three refs. Its shapes were cleaner and closed,
     but its textures were flat. It painted the straw olive green and barely drew the target. TRELLIS won on all
     three figures.
3. **Closed bake** (`bake_dummy.py`): o_voxel's narrow-band remesh turns TRELLIS's open crust into closed shells, with
   no see-through straw. Colour, metal and roughness are baked straight from the voxel volume at 2048².
4. **Clean and rig** (`rig_dummy.py`). Cleanup:
   - fill the pinholes;
   - cull the hidden inner walls (27–42k invisible triangles per figure);
   - drop crumbs and relax needle vertices;
   - repaint the face target as clean rings (TRELLIS had smeared it into a lopsided spiral / diamond).

   Then the 18-bone skeleton, bound by geodesic voxel binding (distance measured through the solid). Blender's bone
   heat failed on every figure. The torso bends in height bands, the legs and base stay on the post, and the fists
   are rigid on the hands.
5. **Pack** (`pack_dummy.mjs`): WebP at 1024² (512² before), meshopt, and 8/16-bit UVs, normals and weights. POSITION
   stays float.

| Figure | Generator | Triangles | GLB | Textures |
|---|---|---|---|---|
| wood-wood | TRELLIS.2 | 45,000 | 1.10 MB | base + metal/rough, 1024² WebP |
| straw-cloth | TRELLIS.2 | 42,436 | 1.26 MB | base + metal/rough, 1024² WebP |
| wood-steel | TRELLIS.2 (E289 re-roll, closed great helm) | 43,635 | 1.17 MB | base + metal/rough, 1024² WebP |

Each figure is one skinned mesh and one draw.

**Bones** (glTF names, exactly the contract in `src/practice/TrainingDummy.ts`):
- Root (the post foot at the origin) > Pelvis > Spine > Chest > Neck > Head.
- Chest > {Left,Right}Shoulder > UpperArm > ForeArm > Hand.
- Root > {Left,Right}Thigh > Shin. The legs hang from Root, so a pelvis sway never lifts the feet off the base.
- Left is the figure's own left: +X when it faces +Z.

| File | What it shows |
|---|---|
| `ref-straw-cloth.jpg`, `ref-wood-wood.jpg`, `ref-wood-steel.jpg` | The new TRELLIS input references |
| `wood-wood-nine-angles-live.jpg`, `straw-cloth-nine-angles-live.jpg`, `wood-steel-nine-angles-live.jpg` | **Live engine**, iPhone portrait 390 × 844 at 3×, Driftwood arena, local dev build: each figure turned in 40° steps in front of a fixed camera, HUD hidden, the other two hidden |
| `wood-wood-approved-vs-live.jpg`, `straw-cloth-approved-vs-live.jpg`, `wood-steel-approved-vs-live.jpg` | A = the approved round-1 sheet's front view, B = the live front |
| `hit-reaction-live.jpg` | Live, one row per figure: rest, 0.18 s and 0.44 s after a 60-damage hit (round 8's springs driving the new bones) |
| `arena-portrait-hud.jpg` | Live arena spawn frame with the HUD, the three rebuilt figures in the lineup |
| `wood-wood-rig-gate.jpg`, `straw-cloth-rig-gate.jpg`, `wood-steel-rig-gate.jpg` | Blender rig gate (working evidence, `dummy_rig_gate.py`), 36 poses per figure: Spine ±25°, Chest ±20°, Head ±35° (pitch and lean / turn), and each arm joint ±60° both ways. Every tile shows its worst edge stretch, the edges over 2×, and the pinched triangles |

**Rig gate, worst across the poses** (triangles pinched below 20 % of rest; edges stretched over 2×; 42–45k triangles):

| Figure | Spine / chest | Head | Upper arm | Forearm | Hand |
|---|---|---|---|---|---|
| wood-wood | 117 edges, 66 tris | 1, 1 | 34, 23 | 12, 8 | 45, 6 |
| straw-cloth | 178, 41 | 26, 16 | 74, 10 | 25, 11 | 124, 15 |
| wood-steel (E289) | 135, 73 | 312, 16 | 48, 23 | 15, 10 | 51, 10 |

Fewer than 0.5 % of the edges stretch past 2× at any extreme, and nothing visibly tears or collapses in the sheets.
The first rig (heat-style distance from the bone centre lines) had 450–1,060 such edges on every arm pose. It
dragged the tassets and the skirt along with the arm.

**What still looks wrong:**
- Steel (E289): the helm is now a closed great helm; see below. Its head-turn gate reads 312 stretched edges: the
  dark plug inside the helm stretches where it meets the collar, which is hidden. The steel reads brighter than
  the approved sheet's dark iron.
- The straw figure's back sleeve flap smears at a 60° backward arm swing. The straw neck and fists keep a little
  surface fuzz.
- The target's centre sits on a small geometric notch on the wood face.
- The cross-foot bases came back lower and blockier than the approved sheets, and the steel base shows a few dark
  specks.
- The studio light (round 8) pushes the wood towards yellow-orange; the texture itself is browner.

## E289: the steel dummy re-rolled with a closed great helm (2026-09-29)

Jake on his iPhone: "The face and open helmet look absolutely terrible … I think your closed helmet design is the
quickest fix."

- **Reference.** A new front reference (`ref-wood-steel.jpg`, replacing the E285 one) came from codex `image_gen`:
  the E285 ref plus the approved sheet, with a flat-topped great helm, an eye slit and breaths, and no face, visor,
  jaw guard or brim. Of three takes, C was the cleanest.
- **Generator.** TRELLIS.2 on all three takes. C came out with the tidiest box helm. Hunyuan3D-2 ran on the same
  cutouts; its paint model failed to load (a missing VAE `.safetensors` in the weight store), so there was nothing
  to compare. TRELLIS.2 C ships.
- **Cleanup.** The usual bake and cleanup, plus a `helm` step in `rig_dummy.py`:
  - every helm face whose outward ray meets another wall (the lining) takes a near-black texel;
  - a dark tube hugs the inside, so the eye slit and breaths show shadow instead of the room.
- **Checked** from 1.7 m in the live engine: no face, no wood and no room through the helm at any angle.

| File | What it shows |
|---|---|
| `wood-steel-helm-before-after.jpg` | **Live engine**, iPhone portrait 390 × 844 at 3×, camera 1.7 m from the figure at head height, turned 0 / 35 / 90 / 150 / 180°. A = the E285 sallet (live `8bbf2bdb`), B = the E289 great helm |

## E289: the minor mesh items (2026-09-29)

These passes are in `scripts/practice/dummy_parts.py`, run from `rig_dummy.py`. All three figures now have:
- the approved cross-foot base (square post, crossed beams, braces, iron caps) built in place of TRELLIS's;
- every face turned to the side it is seen from.

Per figure:
- **Steel:** the metal darkened and rusted towards the approved dark iron, in the texture; no lining on the helm rim.
- **Straw:** the neck and fists smoothed and despeckled, with a straw tube and fist blobs behind the gaps.
- **Wood:** the face under the target smoothed.

The nine-angle, approved-vs-live, hit and rig-gate sheets above were refreshed with these GLBs.

| File | What it shows |
|---|---|
| `e289-bases-before-after.jpg` | **Live engine**, portrait 3×: the three bases, A = live `f20e0db8`, B = E289 |
| `e289-steel-iron-before-after.jpg` | Live: steel full figure and helm at 0° / 35°, A / B |
| `e289-straw-wood-before-after.jpg` | Live: straw collar, straw fist and wood target, A / B |

**Still open:**
- pale leftover flakes by the steel and straw feet (40–120°);
- one small dark nick at the right end of the helm slit;
- the straw rear-sleeve smear at a 60° backward swing.
