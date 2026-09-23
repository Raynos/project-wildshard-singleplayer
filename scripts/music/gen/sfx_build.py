"""MUSIC.md v3 row 6 (E33): rank the Stable Audio 3 sound-effect takes with CLAP, ship the best per family and model,
and build the side-by-side snippets page.

    ~/ml/music/analysis/.venv/bin/python scripts/music/gen/sfx_build.py <sfx-raw-dir>

Reads <raw>/<model>/<family>/<seed>.wav + .json (gen_sfx.py). For every take:
  CLAP (laion/clap-htsat-fused, the model's own logit scale): softmax of its own family description against every
  other family's description plus three foils ("music with melody and instruments", "a person speaking", "silence").
  `p` = the share its own description gets, `rank` = where it places among all of them (1 = best match).
  Beds / hums also need a loop: the best seam on a 1 s grid (analyze.loop_seam), made seamless like the music
  (stems.seam: the last second crossfaded into the second before loopStart), loop points measured on the decoded file.
The best take per (model, family) ships if it ranks <= SHIP_MAX_RANK (5); one-shots get their best 2 takes as variants
when both rank <= 3. A family whose best take ranks lower is listed in sfx.json's `synth_keeps` and not shipped.
Writes public/assets/sfx/<model>/ (<model> = sa3 for small-sfx, sa3-medium for medium): the files + sfx.json
  { model, credit, beds: {forest: {file, loopStart, loopEnd, duration, gain}}, hums: {...},
    oneshots: {<Audio method / AnimalSound id>: {files: [...], gain}}, provenance: [...] }
Beds / hums: stereo AAC 96 kb/s; one-shots: mono AAC 64 kb/s, trimmed to the sounding part. Levels: beds -24 LUFS,
hums -26 LUFS, one-shots -18 LUFS (the game applies its own gains on top: beds 0.5, pickup hum 0.35, shrine 0.6).
Also writes scripts/music/gen/sfx-<model>.json (every take, every score) and art/sfx/round-1-two-models/ (MP3 snippets
of each family's pick from both models, side by side).
"""

from __future__ import annotations

import html
import json
import subprocess
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from analyze import CLAP_DIR, _tensor, loop_seam  # noqa: E402
from stems import decode_offset, encode, lufs, seam, shipped_name  # noqa: E402

REPO = HERE.parents[2]
OUT = REPO / "public/assets/sfx"
ART = REPO / "art/sfx/round-1-two-models"
MODELS = {"small-sfx": "sa3", "medium": "sa3-medium"}
MODEL_TITLE = {"small-sfx": "Stable Audio 3 Small-SFX", "medium": "Stable Audio 3 Medium"}
LICENCE = "Stability AI Community License (free < USD 1M revenue; register for commercial use; 'Powered by Stability AI') + Gemma terms (T5Gemma encoder)"
FOILS = ["music with melody and instruments", "a person speaking", "silence"]
LEVEL = {"bed": -24.0, "hum": -26.0, "oneshot": -18.0}
SHIP_MAX_RANK = 5  # a family ships from a model only if its own description ranks in CLAP's top 5 (of every family + the foils)
GAIN = {"bed-forest": 0.5, "bed-island": 0.5, "bed-underwater": 0.5, "hum-pickup": 0.35, "hum-shrine": 0.6}


def trim(x: np.ndarray, sr: int, max_s: float) -> np.ndarray:
    env = np.abs(x).max(0)
    idx = np.where(env > env.max() * 10 ** (-45 / 20))[0]
    a, b = max(int(idx[0]) - int(0.005 * sr), 0), min(int(idx[-1]) + int(0.03 * sr), x.shape[1], int(idx[0]) + int(max_s * sr))
    y = x[:, a:b].copy()
    n = min(int(0.04 * sr), y.shape[1] // 4)
    y[:, -n:] *= np.linspace(1.0, 0.0, n)[None]
    return y


def main() -> None:
    import torch
    from transformers import ClapModel, ClapProcessor

    raw = Path(sys.argv[1])
    fams = json.loads((HERE / "sfx-jobs.json").read_text())["families"]
    clap = ClapModel.from_pretrained(str(CLAP_DIR)).eval()
    proc = ClapProcessor.from_pretrained(str(CLAP_DIR))
    scale = float(clap.logit_scale_a.detach().exp())
    names = list(fams)
    texts = [fams[f]["desc"] for f in names] + FOILS
    with torch.no_grad():
        te = torch.nn.functional.normalize(_tensor(clap.get_text_features(**proc(text=texts, return_tensors="pt", padding=True))), dim=-1)

    picks: dict[str, dict[str, list[dict]]] = {}
    for model, short in MODELS.items():
        takes = []
        for wav in sorted((raw / model).glob("*/*.wav")):
            side = json.loads(wav.with_suffix(".json").read_text())
            fam = side["family"]
            x, sr = sf.read(str(wav), always_2d=True)
            y = x.mean(1).astype(np.float32)
            y48 = librosa.resample(y, orig_sr=sr, target_sr=48000)
            seg = 48000 * 10
            chunks = [y48[i:i + seg] for i in range(0, max(len(y48) - seg // 2, 1), seg)] or [y48]
            with torch.no_grad():
                a = proc(audio=chunks, sampling_rate=48000, return_tensors="pt")
                ae = torch.nn.functional.normalize(_tensor(clap.get_audio_features(**a)), dim=-1).mean(0, keepdim=True)
                sims = (torch.nn.functional.normalize(ae, dim=-1) @ te.T)[0]
            i = names.index(fam)
            p = float(torch.softmax(sims * scale, 0)[i])
            rank = int((sims > sims[i]).sum()) + 1
            r = {"family": fam, "seed": side["seed"], "wav": str(wav), "side": side, "p": round(p, 3), "rank": rank,
                 "best_match": texts[int(sims.argmax())], "peak": round(float(np.abs(x).max()), 3)}
            if fams[fam]["kind"] in ("bed", "hum"):
                y22 = librosa.resample(y, orig_sr=sr, target_sr=22050)
                r["seam"] = loop_seam(y22, 22050, 240.0, len(y) / sr)  # 240 BPM: a "bar" is 1 s
            takes.append(r)
        by_fam: dict[str, list[dict]] = {}
        for r in takes:
            by_fam.setdefault(r["family"], []).append(r)
        for fam, rs in by_fam.items():
            def key(r: dict) -> tuple:
                seam_ok = r.get("seam", {}).get("score", 1.0)
                return (r["rank"] <= 3, r["p"] * (0.7 + 0.3 * max(seam_ok, 0.0)))
            rs.sort(key=key, reverse=True)
        picks[model] = by_fam
        (HERE / f"sfx-{short}.json").write_text(json.dumps(
            {"model": MODEL_TITLE[model], "families": {f: [{k: v for k, v in r.items() if k not in ("wav",)} for r in rs] for f, rs in by_fam.items()}},
            indent=2) + "\n")

        # ---- ship
        dest = OUT / short
        for old in dest.glob("*.m4a"):  # this folder holds only this script's output
            old.unlink()
        man: dict = {"model": MODEL_TITLE[model], "credit": f"SFX: {MODEL_TITLE[model]} — Powered by Stability AI",
                     "beds": {}, "hums": {}, "oneshots": {}, "provenance": []}
        total = 0
        skipped = []
        for fam, rs in sorted(by_fam.items()):
            kind = fams[fam]["kind"]
            if rs[0]["rank"] > SHIP_MAX_RANK:  # this model's best take sounds more like some other family: the synth keeps it
                skipped.append(fam)
                continue
            chosen = rs[:1] if kind != "oneshot" else [r for r in rs[:2] if r is rs[0] or r["rank"] <= 3]
            for n_var, r in enumerate(chosen, 1):
                x, sr = sf.read(r["wav"], always_2d=True)
                x = x.T.astype(np.float64)
                if kind in ("bed", "hum"):
                    s = r["seam"]
                    y, _ = seam(x, sr, {"loopStart": s["start_s"], "loopEnd": s["end_s"]}, 1.0)
                else:
                    y = trim(x, sr, 3.0)
                L, tp = lufs(y, sr)
                gain = min(LEVEL[kind] - L, -1.0 - tp)
                y = y * 10 ** (gain / 20)
                dest.mkdir(parents=True, exist_ok=True)
                tmp = dest / ".tmp.m4a"
                total += encode(y, sr, tmp, mono=(kind == "oneshot"))
                lag, dlen = decode_offset(tmp, y, sr) if kind in ("bed", "hum") else (0.0, 0.0)
                fname = shipped_name(dest, tmp, f"{fam}-{r['seed']}")  # content-addressed: the SW caches audio cache-first
                if kind in ("bed", "hum"):
                    entry = {"file": fname, "loopStart": round(r["seam"]["start_s"] + lag, 4), "loopEnd": round(r["seam"]["end_s"] + lag, 4),
                             "duration": round(dlen, 4), "gain": GAIN[fam]}
                    assert entry["loopEnd"] <= dlen
                    man["beds" if kind == "bed" else "hums"][fam.split("-", 1)[1]] = entry
                else:
                    man["oneshots"].setdefault(fam, {"files": [], "gain": 1.0})["files"].append(fname)
                man["provenance"].append({"file": fname, "model": r["side"]["repo"], "code": r["side"]["code_commit"], "prompt": r["side"]["prompt"],
                                          "seed": r["seed"], "steps": r["side"]["steps"], "licence": LICENCE, "clap_p": r["p"], "clap_rank": r["rank"]})
        man["synth_keeps"] = sorted(skipped)
        (dest / "sfx.json").write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n")
        print(f"{short}: {total / 1e6:.2f} MB, {len(man['oneshots'])} one-shot families, beds {list(man['beds'])}, hums {list(man['hums'])}, synth keeps {len(skipped)}: {skipped}")

    # ---- snippets page: each family's pick from both models
    for old in ART.glob("*/*.mp3"):
        old.unlink()
    rows = []
    for fam in names:
        cells = []
        for model, short in MODELS.items():
            rs = picks.get(model, {}).get(fam)
            if not rs:
                cells.append("<td class='empty'>not rendered</td>")
                continue
            r = rs[0]
            mp3 = ART / short / f"{fam}-{r['seed']}.mp3"
            mp3.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", r["wav"], "-t", "20", "-af", "loudnorm=I=-18:TP=-1.5",
                            "-c:a", "libmp3lame", "-b:a", "128k", str(mp3)], check=True)
            tone = "good" if r["rank"] == 1 else ("warn" if r["rank"] <= SHIP_MAX_RANK else "bad")
            ship = "in the game" if r["rank"] <= SHIP_MAX_RANK else "not shipped: the synth plays"
            cells.append(f"<td><audio controls preload='none' src='{short}/{mp3.name}'></audio>"
                         f"<div class='chips'><span class='chip {tone}'><b>CLAP</b> rank {r['rank']} &middot; {r['p'] * 100:.0f}%</span>"
                         f"<span class='chip'>{ship}</span></div></td>")
        rows.append(f"<tr><th scope='row'>{html.escape(fam)}<br><span class='meta'>{html.escape(fams[fam]['desc'])}</span></th>{''.join(cells)}</tr>")
    from build_page import PAGE_CSS

    (ART / "index.html").write_text(f"""<title>Wildshard Sound Effects</title>
<meta name="description" content="Every Wildshard sound effect, rendered by Stable Audio 3 Small-SFX and Stable Audio 3 Medium, side by side.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
{PAGE_CSS}
.grid td, .grid th {{ white-space: normal; vertical-align: top; }}
.grid th[scope=row] {{ text-transform: none; letter-spacing: 0; font-size: 13px; color: var(--ink); min-width: 150px; }}
.grid audio {{ width: 220px; max-width: 100%; }}
</style>
<div class="wrap">
  <header>
    <h1>Wildshard sound effects, round 1</h1>
    <p class="lede">Every sound the game makes that is not music, rendered locally by two Stable Audio 3 models. Each cell is that model's best take for the family out of three, ranked by CLAP against the description; "rank 1" means the audio matched its own description better than any of the other {len(names) - 1} families and the three foils. A take ships only when it ranks in the top {SHIP_MAX_RANK}; otherwise that set leaves the family on the synth. Both sets are in the game (Settings switches between them); say which model should win each family, or which to leave on the synth.</p>
    <div class="brief"><p>Licence: Stability AI Community. Free under USD 1M revenue; register with Stability for commercial use; "Powered by Stability AI" in the credits.</p><small>TangoFlux was the other candidate but its licence is non-commercial (research only), so it was not used</small></div>
  </header>
  <section class="style"><div class="tablewrap"><table class="grid">
    <thead><tr><th>family</th>{''.join(f'<th>{html.escape(MODEL_TITLE[m])}</th>' for m in MODELS)}</tr></thead>
    <tbody>{''.join(rows)}</tbody>
  </table></div></section>
</div>
""")
    print(f"page -> {ART / 'index.html'}")


if __name__ == "__main__":
    main()
