# Conch low-poly style revision

**Unaccepted source study. No new human approval is claimed.**

The original Conch identity was approved. The owner subsequently requested a
style audit against Driftwood's actual low-poly look and continued development
of the same five identities toward 5/5 quality. The coordinator inspected a
revised low-poly AI concept on 2026-10-18, showing broad cream/coral whorls,
clean burgundy anatomy, amber stalk eyes and asymmetric shield/thrust claws.
That revision is a working visual target, not a new owner pick or game capture.

`build_conch_lowpoly_v1.py` is a separate version. It replaces the failed narrow
cone with explicit broad graduated whorl sections and a tilted centerline;
simplifies the flared aperture to major planes; keeps a real excavated cavity;
and uses larger matte palette areas. Existing failed and unrun studies remain
untouched. No runtime assets or old meshes have been replaced.

Run from the repo root after obtaining the shared render lane:

```sh
blender -b -t 2 --python-exit-code 1 \
  -P art/driftwood-isle/approved-conch/build_conch_lowpoly_v1.py -- \
  --out tmp/approved-conch/lowpoly-v1 --render
```

Optional `--clay` suppresses palette; `--view side` / `--view rear` inspect other
angles. All generated GLB, blend and raw PNG outputs stay in ignored scratch.
The single Python source has no dependency on another study, downloads or
external texture files. Blender's bundled Python and mathutils suffice.

Rig, animation, engine admission, Explorer/first-person proof and arena testing
remain open. Quality acceptance remains 0 until actual evidence meets the bar.
