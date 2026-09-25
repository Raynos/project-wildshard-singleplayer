# Local edit-model bake-off vs codex `image_gen` (E104, 2026-09-24)

The same 10 mockup jobs as round 1 (`../round-1-qwen21-vs-codex/`): the same input frames, the same verbatim prompts,
seed 42 and the same output size, run through every open edit model that runs on the M5 Max.
- Jake judged each model in a blind A/B against codex. The pairs and answer keys are local in `~/ml/imagegen/out/blind-*/`.
- Scores are for **our** job: editing a live game frame into a mockup. Codex is the benchmark.

| Model (release) | Runtime on the M5 Max | Per image | Score /10 | What it does |
|---|---|---|---|---|
| codex `image_gen` | cloud | ~3 min | **9** | Holds the frame, the toon palette, the wooden sword and the small text |
| **Qwen-Image-2.1 + turbo LoRA + edit mask** (2026-09-20 / LoRA 09-24) | diffusers MPS bf16, 6 steps | ~25 s | **8, localised edits only** | The output is composited back over the untouched frame inside a mask, so the world is pixel-identical. The hover pill matched codex (`mask-hud-hover-top-row-A.jpg`), and the feedback sheet is good. The quest chip shows a seam because the box was too big |
| Qwen-Image-2.1 + turbo LoRA (`Viggle/…-viggle-turbo` v0.2.1) | diffusers MPS bf16, 6 steps | 19–36 s | **6** | Looks the same as 40 steps (0 % composition drift) at a quarter of the time. The best value for whole-frame edits |
| SenseNova-U1.5-8B-MoT (2026-08-19) | MLX-Swift `xocialize/sensenova-u1-swift`, 8-bit, 50 steps | 54–74 s | **6** | Keeps the toon palette, the camera and the wooden sword better than Qwen. The texture is crunchy and over-sharpened, small text is garbled, it turned the crossbow into a rifle, and it dropped a boulder |
| Qwen-Image-2.1 (40 steps) | diffusers MPS bf16 | 84–132 s | **6** | Layout and big text are right. It greys the palette, turns the sword to steel and re-composes the camera when given several references |
| FLUX.2-klein-9B (2026-01) | mflux, 4 steps | 15–65 s | **5** | The best fidelity to the input frame of any local model, but it often skips or botches the edit (no lock-on reticle, the quest chip dropped). Small text is garbled |
| FLUX.2-klein-4B (2026-01) | mflux, 4 steps | 9–45 s | **4** | Like the 9B, with worse text |
| Qwen-Image-Edit-2511 (2025-12) | mflux 8-bit + Lightning 8-step LoRA | ~170 s (the 20B is quantised on every load) | **4** | Holds the frame, but mostly leaves the edit undone, and its text is the most garbled of all |
| Qwen-Image-2.1-PE-I2I prompt rewriter | transformers MPS, no-think | ~2 min per prompt | **2** (for us) | Built for vague requests. It restates our already-exact prompts, and 7 of 10 ran past 1,500 tokens without finishing |

**The takeaways**
- **Codex stays the mockup default.**
- For a small, local edit (move a button, add a chip or a panel), **Qwen-2.1 turbo + mask** is a real local option: ~25 s,
  and the world stays untouched.
- The FLUX and 2511 models are the opposite of Qwen: faithful to the frame, but they under-edit.
- No open model yet does whole-frame UI re-layout with correct small text.

Files: `mask-<job>.jpg` shows 4 columns per job: input / codex / Qwen-2.1 turbo / Qwen turbo + mask. The how-to, speeds and
traps are in `~/projects/localai/docs/image-models.md`.
