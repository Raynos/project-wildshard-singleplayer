# Local Qwen-Image-2.1 vs codex `image_gen`: 10 mockups (E100, 2026-09-24)

Each JPEG puts two images side by side. **Left** is the codex `image_gen` mockup already in `art/`. **Right** is the
same mockup remade locally on the M5 Max with **Qwen-Image-2.1**.
- Both sides got the **same input frame(s)** and the **same prompt**. The prompts are verbatim from the codex run logs
  in old session scratchpads, cut at "TASK FOR CODEX". `pine-pond-stag`'s prompt is rebuilt from the blocks in
  `art/README.md`.
- The local side is one take per image: seed 42, 40 steps, about 1 MP, no re-rolls and no cherry-picking.

**Setup**
- Weights: `~/projects/weights/manual/Qwen/Qwen-Image-2.1`, bf16, 33 GB.
- Runtime: diffusers main (`QwenImage21Pipeline`) on PyTorch MPS.
- Runner: `~/ml/imagegen/`, which holds the shared `~/projects/localai/.model.lock` for each batch.

**Cost**
- 84–132 s per image; 2.0–2.9 s per step, the slow end being the 4-reference job. Load is 7–10 s.
- 57–63 GB of MPS memory.
- Jobs run one at a time under the machine-wide lock, so 10 images took about 16 minutes of lock time.

**Licence:** Qwen Research Licence, which covers research and evaluation only. Nothing here may ship.

| File | What | Local vs codex |
|---|---|---|
| `feedback-desktop-sheet-A.jpg` | desktop feedback sheet over the pier | **The closest HUD match.** The panel, the tag chips, the 3-line note text and the field grid are all legible and correct. The world goes greyer. |
| `hud-hover-top-row-A.jpg` | iPhone, HOVER pill in the top row | Close. The top row, "GLYPH SHARDS 0/3 \| SEA CAVE 281 M" and the low-poly palms all hold. The minimap is blank and "ATTACK" reads "ATTASK". |
| `pine-pond-stag.jpg` | Pine Hollow pond, stag, crossbow | Close in look (photoreal shard). The HUD blocks are legible; the compass text is mush. |
| `quest-compact-chip-G.jpg` | iPhone, compact quest chip | The layout and the quest chip are right. The sky is desaturated, the boulder is gone, and "HOLD = HEAVY" and "VITALS" are garbled. |
| `driftwood-asset-hut.jpg` | stilt hut on white (3D reference) | Same prop and style, with muddier colours and a less clean silhouette. Usable as a TRELLIS input. |
| `hud-look-zone-E.jpg` | phone look-zone HUD | Every big label is right. The low-poly island turns painterly and the VITALS bar is dropped. |
| `combat-lockon-N.jpg` | crab lock-on, quest card | The lock-on reticle and layout are good. The world turns grey-brown and realistic, the quest text is garbled ("DRIFTWORD ISLE"), and SWITCH became LOOK. |
| `combat-dodge-T2.jpg` | dodge motion blur on the pier | Blur OK. The whole frame goes grey, the wooden sword becomes steel with a realistic hand, DODGE is missing, and the quest pill is garbled. |
| `driftwood-remaster-diag-front.jpg` | remaster concept, 4 references | A good-looking low-poly island, but **not the capture's camera**: with 4 references it composes its own shot. |
| `driftwood-horizon-day-h000.jpg` | horizon matte segment | Darker, more realistic sea with palm-topped stacks. The toon turquoise is lost; it would not stitch with the other segments. |

**The pattern**
- Qwen keeps the layout and the large UI text well.
- It garbles text below about 10 px.
- It drifts Driftwood's bright toon palette toward grey realism. It turned the wooden sword into steel in 4 of the 6 frames that show it.
- With several references it takes liberties with the camera.
- Codex holds the input frame noticeably closer.

The first pass left 8 of 10 frames pure black: NaNs in one process running many jobs. One fresh process per job plus
an fp32 VAE made 8/8 clean (`~/ml/imagegen/run_each.sh`).
