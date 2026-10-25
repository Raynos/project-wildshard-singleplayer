# HI3D-REFINE — State (≤ 3 KB)

**2026-10-24 14:45 Cancun:** H1–H7 done. Jake picked **opt-in per prop** (H6): Hi3D goes on a prop only when its
list row says so, never as a shard default; the winners are rebuilt shard by shard behind Developer.

Open: H8 Driftwood wreck, H9 Pine Hollow ranger + bear (through the shard's NPC / creature bakes), H10 Far Reach roc.
None started. Boards: `art/hi3d-refine/round-1-heroes/`. Tools: `scripts/img2mesh/hi3d_refine.py`, `--geo`,
`build_props.py` `"refine"`; when to use: localai `docs/hi3d.md`, README §4b.

localai `docs/hi3d.md` + setup script and the weights `MODELS.md` row are staged in their repos; they land when Jake
runs `! bash tmp/hi3d-land.sh` (this repo's commit guard blocks `git commit` elsewhere).
