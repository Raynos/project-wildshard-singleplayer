#!/usr/bin/env python3
"""LTX-2.5 on Apple MPS through a headless ComfyUI (TRAILERS CT1 experiments #9 and #10, E466).

Two graphs, both ports of Lightricks' official two-stage distilled workflows to ComfyUI's API format:

  layout  Layout-To-Render IC-LoRA: a grey playblast (guide video, RoPE frame 0) + one look still (RoPE frame -1)
          -> a rendered clip that keeps the playblast's camera and layout.
          (LTX-2.5_ICLoRA_Layout_To_Render_Two_Stage_Distilled.json, shipped with the LoRA)
  i2v     Image-to-video from a keyframe (ComfyUI-LTXVideo example_workflows/2.5/LTX-2.5_T2V_I2V_Two_Stage_Distilled.json)

Stage 1 samples at half size (8 distilled steps), the x2 latent upsampler lifts it, stage 2 re-samples 3 steps at full
size. --width/--height are the FINAL size (multiples of 64 so stage 1 is a multiple of 32).

This script starts ComfyUI itself (one process per job, killed at the end so the memory is freed) and must run under
the machine-wide model lock; ltx-run.sh does that.

  ltx_comfy.py layout --video grey.mp4 --still look.png --prompt "..." --out out.mp4 [--width 1280 --height 704 --frames 145]
  ltx_comfy.py i2v    --image first.png --prompt "..." --out out.mp4 [--width 1280 --height 704 --frames 145]
"""
import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request

COMFY = os.path.expanduser(os.environ.get("LTX_COMFY", "~/ml/video/ComfyUI"))
PY = os.path.join(COMFY, ".venv/bin/python")
UNET = "ltx-2.5-22b-distilled-transformer-bf16.safetensors"
TE = "gemma4-12b-with-proj-ltx-2.5-bf16.safetensors"
VAE = "ltx-2.5-video-vae-bf16.safetensors"
AUDIO_VAE = "ltx-2.5-audio-vae-bf16.safetensors"
UPSCALER = "ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors"
LAYOUT_LORA = "ltx-2.5-22b-ic-lora-layout-to-render-1.0.safetensors"
SIGMAS_1 = "1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0"
SIGMAS_2 = "0.909375, 0.725, 0.421875, 0.0"


class G:
    def __init__(self):
        self.nodes = {}
        self.n = 0

    def add(self, cls, **inputs):
        self.n += 1
        nid = str(self.n)
        self.nodes[nid] = {"class_type": cls, "inputs": inputs}
        return nid


def out(nid, slot=0):
    return [nid, slot]


def common_loaders(g, args, lora):
    unet = g.add("UNETLoader", unet_name=UNET, weight_dtype="default")
    model, ldf = out(unet), None
    if lora:
        lo = g.add("LTXICLoRALoaderModelOnly", model=model, lora_name=lora, strength_model=args.lora_strength)
        model, ldf = out(lo, 0), out(lo, 1)
    vae = out(g.add("VAELoader", vae_name=args.vae))
    ups = out(g.add("LatentUpscaleModelLoader", model_name=UPSCALER))
    # the prompt was encoded by build_te() in an earlier queue item and the text encoder unloaded
    pos = g.add("LoadConditioningTorch", path=args.cond_pos)
    neg = g.add("LoadConditioningTorch", path=args.cond_neg)
    cond = g.add("LTXVConditioning", positive=out(pos), negative=out(neg), frame_rate=float(args.fps))
    return model, ldf, vae, ups, out(cond, 0), out(cond, 1)


def build_te(args):
    g = G()
    clip = out(g.add("CLIPLoader", clip_name=TE, type="ltxv", device="default"))
    pos = g.add("CLIPTextEncode", clip=clip, text=args.prompt)
    neg = g.add("CLIPTextEncode", clip=clip, text=args.negative)
    g.add("SaveConditioningTorch", conditioning=out(pos), path=args.cond_pos)
    g.add("SaveConditioningTorch", conditioning=out(neg), path=args.cond_neg)
    return g.nodes


def sampler(g, model, pos, neg, latent, sigmas, seed):
    noise = g.add("RandomNoise", noise_seed=seed)
    guider = g.add("CFGGuider", model=model, positive=pos, negative=neg, cfg=1.0)
    samp = g.add("KSamplerSelect", sampler_name="euler_ancestral")
    sig = g.add("ManualSigmas", sigmas=sigmas)
    return g.add("SamplerCustomAdvanced", noise=out(noise), guider=out(guider), sampler=out(samp), sigmas=out(sig),
                 latent_image=latent)


def decode_save(g, vae, latent, args):
    img = g.add("VAEDecodeTiled", samples=latent, vae=vae, tile_size=args.tile, overlap=64, temporal_size=128,
                temporal_overlap=32)
    g.add("SaveImage", images=out(img), filename_prefix=args.prefix)


def ic_guide(g, pos, neg, vae, latent, image, frame_idx, crop, ldf):
    return g.add("LTXAddVideoICLoRAGuide", positive=pos, negative=neg, vae=vae, latent=latent, image=image,
                 frame_idx=frame_idx, strength=1.0, latent_downscale_factor=ldf, crop=crop,
                 use_tiled_encode=False, tile_size=256, tile_overlap=64)


def build_layout(args):
    g = G()
    model, ldf, vae, ups, pos, neg = common_loaders(g, args, LAYOUT_LORA)
    w1, h1 = args.width // 2, args.height // 2
    # The guide video is pre-resized by ffmpeg to the stage-1 size (the official graph resizes it to its short side).
    vid = g.add("LoadVideo", file=args.video_name)
    comps = g.add("GetVideoComponents", video=out(vid))
    frames = out(comps, 0)
    still = out(g.add("LoadImage", image=args.still_name))
    empty = g.add("EmptyLTXVLatentVideo", width=w1, height=h1, length=args.frames, batch_size=1)
    a = ic_guide(g, pos, neg, vae, out(empty), frames, 0, "disabled", ldf)
    b = ic_guide(g, out(a, 0), out(a, 1), vae, out(a, 2), still, -1, "center", ldf)
    s1 = sampler(g, model, out(b, 0), out(b, 1), out(b, 2), SIGMAS_1, args.seed)
    c1 = g.add("LTXVCropGuides", positive=out(b, 0), negative=out(b, 1), latent=out(s1, 0))
    if args.one_stage:
        decode_save(g, vae, out(c1, 2), args)
        return g.nodes
    up = g.add("LTXVLatentUpsampler", samples=out(c1, 2), upscale_model=ups, vae=vae)
    # Stage 2 re-adds the guides at the new size, from the encoded prompt (not stage 1's guide-carrying conditioning).
    c = ic_guide(g, pos, neg, vae, out(up), frames, 0, "disabled", 1.0)
    d = ic_guide(g, out(c, 0), out(c, 1), vae, out(c, 2), still, -1, "center", 1.0)
    s2 = sampler(g, model, out(d, 0), out(d, 1), out(d, 2), SIGMAS_2, args.seed)
    c2 = g.add("LTXVCropGuides", positive=out(d, 0), negative=out(d, 1), latent=out(s2, 0))
    decode_save(g, vae, out(c2, 2), args)
    return g.nodes


def build_i2v(args):
    g = G()
    model, _, vae, ups, pos, neg = common_loaders(g, args, None)
    avae = out(g.add("VAELoader", vae_name=AUDIO_VAE))
    w1, h1 = args.width // 2, args.height // 2
    img_small = out(g.add("LoadImage", image=args.image_small_name))
    img_full = out(g.add("LoadImage", image=args.image_name))
    pre = g.add("LTXVPreprocess", image=img_small, img_compression=args.img_compression)
    empty = g.add("EmptyLTXVLatentVideo", width=w1, height=h1, length=args.frames, batch_size=1)
    i2v1 = g.add("LTXVImgToVideoInplace", vae=vae, image=out(pre), latent=out(empty), strength=args.i2v_strength,
                 bypass=False)
    aud = g.add("LTXVEmptyLatentAudio", audio_vae=avae, frames_number=args.frames, frame_rate=int(args.fps),
                batch_size=1)
    av = g.add("LTXVConcatAVLatent", video_latent=out(i2v1), audio_latent=out(aud))
    s1 = sampler(g, model, pos, neg, out(av), SIGMAS_1, args.seed)
    sep1 = g.add("LTXVSeparateAVLatent", av_latent=out(s1, 0))
    if args.one_stage:
        decode_save(g, vae, out(sep1, 0), args)
        return g.nodes
    up = g.add("LTXVLatentUpsampler", samples=out(sep1, 0), upscale_model=ups, vae=vae)
    i2v2 = g.add("LTXVImgToVideoInplace", vae=vae, image=img_full, latent=out(up), strength=1.0, bypass=False)
    av2 = g.add("LTXVConcatAVLatent", video_latent=out(i2v2), audio_latent=out(sep1, 1))
    s2 = sampler(g, model, pos, neg, out(av2), SIGMAS_2, args.seed)
    sep2 = g.add("LTXVSeparateAVLatent", av_latent=out(s2, 0))
    decode_save(g, vae, out(sep2, 0), args)
    return g.nodes


def http(path, data=None, port=8199):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}",
                                 data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def ffmpeg(*a):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *a], check=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("mode", choices=["layout", "i2v"])
    p.add_argument("--video")
    p.add_argument("--still")
    p.add_argument("--image")
    p.add_argument("--prompt", required=True)
    p.add_argument("--negative", default="")
    p.add_argument("--out", required=True)
    p.add_argument("--width", type=int, default=1280)
    p.add_argument("--height", type=int, default=704)
    p.add_argument("--frames", type=int, default=145)
    p.add_argument("--fps", type=float, default=24)
    p.add_argument("--seed", type=int, default=42)
    p.add_argument("--lora-strength", type=float, default=1.0)
    p.add_argument("--i2v-strength", type=float, default=0.7)
    p.add_argument("--img-compression", type=int, default=18)
    p.add_argument("--vae", default=VAE)
    p.add_argument("--tile", type=int, default=512)
    p.add_argument("--one-stage", action="store_true", help="stage 1 only (half size), for smoke tests")
    p.add_argument("--port", type=int, default=8199)
    p.add_argument("--attn", default="pytorch", choices=["pytorch", "quad"])
    p.add_argument("--dump", action="store_true", help="print the API graph and exit")
    args = p.parse_args()
    assert args.width % 64 == 0 and args.height % 64 == 0, "final size must be a multiple of 64"
    assert (args.frames - 1) % 8 == 0, "frames must be 8n+1"

    tag = f"ltx{os.getpid()}"
    args.prefix = tag
    # a per-job input / output directory next to --out, so nothing lands in the ComfyUI install
    job = os.path.abspath(args.out) + ".job"
    inp, outdir = os.path.join(job, "input"), os.path.join(job, "output")
    os.makedirs(inp, exist_ok=True)
    os.makedirs(outdir, exist_ok=True)
    args.cond_pos, args.cond_neg = os.path.join(job, "cond-pos.pt"), os.path.join(job, "cond-neg.pt")
    w1, h1 = args.width // 2, args.height // 2
    vf = f"scale={w1}:{h1}:force_original_aspect_ratio=increase:flags=lanczos,crop={w1}:{h1}"
    vff = f"scale={args.width}:{args.height}:force_original_aspect_ratio=increase:flags=lanczos,crop={args.width}:{args.height}"
    if args.mode == "layout":
        args.video_name = f"{tag}-guide.mp4"
        args.still_name = f"{tag}-still.png"
        if not args.dump:
            # constant 24 fps, first N frames, stage-1 size (pad by holding the last frame if the clip is short)
            ffmpeg("-i", args.video, "-vf", f"fps={args.fps},{vf},tpad=stop_mode=clone:stop=200", "-frames:v",
                   str(args.frames), "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", "-an",
                   os.path.join(inp, args.video_name))
            shutil.copy(args.still, os.path.join(inp, args.still_name))
        graph = build_layout(args)
    else:
        args.image_name = f"{tag}-full.png"
        args.image_small_name = f"{tag}-small.png"
        if not args.dump:
            ffmpeg("-i", args.image, "-vf", vff, os.path.join(inp, args.image_name))
            ffmpeg("-i", args.image, "-vf", vf, os.path.join(inp, args.image_small_name))
        graph = build_i2v(args)
    if args.dump:
        print(json.dumps(graph, indent=1))
        return

    cmd = ["/usr/bin/time", "-l", PY, "main.py", "--listen", "127.0.0.1", "--port", str(args.port),
           "--disable-auto-launch", "--dont-print-server", "--input-directory", inp, "--output-directory", outdir]
    cmd.append("--use-pytorch-cross-attention" if args.attn == "pytorch" else "--use-quad-cross-attention")
    t0 = time.time()
    log = open(args.out + ".comfy.log", "w")
    srv = subprocess.Popen(cmd, cwd=COMFY, stdout=log, stderr=subprocess.STDOUT)

    def run(g):
        r = http("/prompt", {"prompt": g, "client_id": tag}, port=args.port)
        pid = r["prompt_id"]
        while True:
            time.sleep(3)
            h = http(f"/history/{pid}", port=args.port)
            if pid in h:
                st = h[pid].get("status", {})
                if st.get("status_str") == "error" or not st.get("completed", True):
                    print(json.dumps(st, indent=1)[-4000:])
                    sys.exit("generation failed")
                return h[pid]["outputs"]
            if srv.poll() is not None:
                sys.exit("ComfyUI died mid-run; see " + log.name)

    try:
        for _ in range(300):
            try:
                http("/system_stats", port=args.port)
                break
            except Exception:
                if srv.poll() is not None:
                    sys.exit("ComfyUI exited during start; see " + log.name)
                time.sleep(1)
        t_ready = time.time()
        print(f"server up in {t_ready - t0:.0f}s; encoding the prompt", flush=True)
        run(build_te(args))
        # drop the Gemma encoder (and its cached outputs) before the transformer loads
        http("/free", {"unload_models": True, "free_memory": True}, port=args.port)
        time.sleep(3)
        t_te = time.time()
        print(f"prompt encoded in {t_te - t_ready:.0f}s; sampling", flush=True)
        outs = run(graph)
        t_done = time.time()
        files = []
        for o in outs.values():
            for im in o.get("images", []):
                if im.get("type") != "output" or not im["filename"].startswith(tag + "_"):
                    continue  # LoadVideo / LoadImage report their inputs here too
                files.append(os.path.join(outdir, im.get("subfolder", ""), im["filename"]))
        files.sort()
        print(f"{len(files)} frames, generation {t_done - t_te:.0f}s", flush=True)
        frames_dir = args.out + ".frames"
        os.makedirs(frames_dir, exist_ok=True)
        for i, f in enumerate(files):
            shutil.move(f, os.path.join(frames_dir, f"{i + 1:04d}.png"))
        ffmpeg("-framerate", str(args.fps), "-i", os.path.join(frames_dir, "%04d.png"), "-c:v", "libx264", "-crf",
               "16", "-pix_fmt", "yuv420p", args.out)
        json.dump({"mode": args.mode, "width": args.width, "height": args.height, "frames": args.frames,
                   "seed": args.seed, "prompt": args.prompt, "server_start_s": round(t_ready - t0),
                   "text_encode_s": round(t_te - t_ready), "generation_s": round(t_done - t_te), "graph": graph},
                  open(args.out + ".run.json", "w"), indent=1)
    finally:
        srv.send_signal(signal.SIGINT)
        try:
            srv.wait(60)
        except subprocess.TimeoutExpired:
            srv.kill()
        log.close()


if __name__ == "__main__":
    main()
