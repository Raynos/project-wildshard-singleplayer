"""NALATI-MERGE A3: the Nalati score - measure, rank, preview and build MiniMax Music 3 takes.

    PY=~/ml/music/analysis/.venv/bin/python
    $PY scripts/music/gen/nalati_score.py analyze <raw>              # metrics per take (+ the Kazakh-instrument CLAP check)
    $PY scripts/music/gen/nalati_score.py rank <raw>                 # ranks, previews, art/music/round-4-nalati/index.html
    $PY scripts/music/gen/nalati_score.py build <raw> [--pick grass=minimax3-305 ...]   # the picks -> public/assets/music/nalati/

<raw>/<group>-<name>/minimax3-<seed>.wav + .json come from gen_minimax.py --jobs nalati-jobs.json (test/* = the six-take
instrument test, nalati/<slot> = the score). Nobody can listen from here, so the ranking is measurement (the user picks by ear
on the page; until he does, the game ships the rank-1 take of every slot):
  kazakh   CLAP (laion/clap-htsat-fused): the softmax share of four Kazakh-instrument SOUNDS (a plucked two-string lute, a
           raspy bowed fiddle, a breathy wooden flute, throat singing) against six foils (orchestra, piano, acoustic guitar,
           synths, a rock band, a singer with words)
  groove   htdemucs: drums + bass present across the take (the tension layer is exactly those stems)
  seam     the best bar-aligned loop seam (analyze.loop_seam)
  clean    no clipping, no gap > 2 s, full band
  full     full length, no fade-out
  voice    the separated vocal stem's share: over 20 % disqualifies a take, EXCEPT in the night and the King's slots, where the
           throat drone is wanted (the user, wave 6: the throat drone only in the night + boss cues) and only over 60 % does
Build (stems.py's recipe): htdemucs -> calm = mix - drums - bass/2, tension = drums + bass/2 (in the night / King slots the
voice stays in calm - it is the drone); beat grid, a downbeat loop <= MAX_LOOP_S, the seam crossfade, -18 LUFS, one limiter
curve for both stems; calm stereo AAC 96 kb/s, tension mono 64 kb/s; loop points re-measured on the decoded files. Stings are
cut from the grass theme (death = its last chord, chunk = its biggest downbeat swell, pickup = its brightest onset).
Writes public/assets/music/nalati/music.json (+ files) and scripts/music/gen/nalati-score.json (every take, every score, picks).
"""

from __future__ import annotations

import argparse
import html
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
REPO = HERE.parents[2]
ART = REPO / "art/music/round-4-nalati"
OUT = REPO / "public/assets/music/nalati"
JOBS = json.loads((HERE / "nalati-jobs.json").read_text())
SLOTS = ("grass", "sky", "snow", "night", "storm", "king")
VOICE_OK = ("night", "king")
MAX_LOOP_S = 56.0
# CLAP does not know the instruments' names (dombra, kobyz, sybyzgy): a first pass with them heard "sybyzgy" in every take.
# So each is described by its sound, and the foils are the western timbres MiniMax drifts to.
INSTR = {
    "dombra": "a plucked and strummed two-string folk lute",
    "kobyz": "a bowed string fiddle with a scratchy raspy tone",
    "sybyzgy": "a breathy wooden flute melody",
    "throat": "throat singing, a deep growling overtone chant",
}
FOILS = ["orchestral strings and brass", "piano", "acoustic guitar", "electronic synthesizer music",
         "a rock band with electric guitar and drums", "a person singing a melody with words"]
HEARD = {"dombra": "plucked lute", "kobyz": "bowed fiddle", "sybyzgy": "wooden flute", "throat": "throat singing"}
TEST_TARGET = {"dombra": ["dombra"], "kobyz": ["kobyz"], "sybyzgy": ["sybyzgy"], "throat": ["throat"],
               "ensemble-day": ["dombra", "sybyzgy", "kobyz"], "ensemble-night": ["throat", "kobyz"]}
W_LOOP = {"kazakh": 0.35, "groove": 0.2, "seam": 0.2, "clean": 0.15, "full": 0.1}
SLOT_TITLE = {"grass": "Nalati Grasslands", "sky": "Sky Grassland", "snow": "Snow Lotus Valley", "night": "Night on the steppe",
              "storm": "The storm (Jel Ata)", "king": "The Golden King"}
SLOT_NOTE = {"grass": "the green Kunes valley and the camp: the calm exploration theme",
             "sky": "the golden bowl: the same theme, higher and wider", "snow": "the snow ring: the theme, cold and sparse",
             "night": "every zone after dusk: the throat drone lives here", "storm": "a storm rolling in, and Jel Ata's fight",
             "king": "the kurgan: a dirge that rises into battle (the tension stem is the battle)"}


def takes(raw: Path, folder: str) -> list[dict]:
    out = []
    for side_p in sorted((raw / folder).glob("minimax3-*.json")):
        if side_p.name.endswith(".metrics.json"):
            continue
        mp = side_p.with_name(side_p.stem + ".metrics.json")
        out.append({"id": side_p.stem, "folder": folder, "wav": str(side_p.with_suffix(".wav")), "side": json.loads(side_p.read_text()),
                    "metrics": json.loads(mp.read_text()) if mp.exists() else None})
    return out


def cmd_analyze(raw: Path, force: bool) -> None:
    import librosa
    import torch
    from analyze import CLAP_DIR, Vocals, _tensor, analyze
    from transformers import ClapModel, ClapProcessor

    clap = ClapModel.from_pretrained(str(CLAP_DIR)).eval()
    proc = ClapProcessor.from_pretrained(str(CLAP_DIR))
    scale = float(clap.logit_scale_a.detach().exp())
    names = list(INSTR)
    texts = [INSTR[k] for k in names] + FOILS
    with torch.no_grad():
        te = torch.nn.functional.normalize(_tensor(clap.get_text_features(**proc(text=texts, return_tensors="pt", padding=True))), dim=-1)
    vocals = Vocals()
    for wav in sorted(raw.glob("*/minimax3-*.wav")):
        out = wav.with_suffix(".metrics.json")
        if out.exists() and not force:
            continue
        side = json.loads(wav.with_suffix(".json").read_text())
        key = wav.parent.name.replace("-", "/", 1)
        bpm = JOBS["jobs"].get(key, {}).get("bpm") or 100
        m = analyze(wav, side, {"bpm": bpm}, None, vocals)
        y, sr = sf.read(str(wav), always_2d=True)
        y48 = librosa.resample(y.mean(1).astype(np.float32), orig_sr=sr, target_sr=48000)
        seg = 48000 * 10
        chunks = [y48[i:i + seg] for i in range(0, max(len(y48) - seg // 2, 1), seg)]
        chunks = [c for c in chunks if np.sqrt((c ** 2).mean()) > 1e-3] or chunks[:1]
        with torch.no_grad():
            a = proc(audio=chunks, sampling_rate=48000, return_tensors="pt")
            ae = torch.nn.functional.normalize(_tensor(clap.get_audio_features(**a)), dim=-1).mean(0, keepdim=True)
            sims = (torch.nn.functional.normalize(ae, dim=-1) @ te.T)[0]
        p = torch.softmax(sims * scale, 0).tolist()
        m["kazakh"] = {"instrument_prob": {k: round(p[i], 3) for i, k in enumerate(names)},
                       "foil_prob": {FOILS[i]: round(p[len(names) + i], 3) for i in range(len(FOILS))},
                       "kazakh_prob": round(sum(p[: len(names)]), 3), "best_match": texts[int(sims.argmax())]}
        out.write_text(json.dumps(m, indent=2))
        print(f"{wav.parent.name}/{wav.name}: kazakh {m['kazakh']['kazakh_prob']} {m['kazakh']['instrument_prob']} voice "
              f"{m['vocals']['vocal_energy_share']} seam {m['loop'].get('score')} len {m['duration_s']}", flush=True)


def clean_part(m: dict) -> float:
    c = 1.0
    if m["clipping"]["clipped_frac"] > 1e-4:
        c -= 0.5
    if m["silence"]["longest_internal_gap_s"] > 2.0:
        c -= 0.3
    if m["spectrum"]["rolloff95_hz"] < 7000:
        c -= 0.2
    return max(c, 0.0)


def score(m: dict, slot: str) -> tuple[float, dict, str | None]:
    v = m.get("vocals", {})
    voice = v.get("vocal_energy_share", 0.0)
    lim = 0.6 if slot in VOICE_OK else 0.2
    if voice > lim:
        return -1.0, {}, f"voice {voice * 100:.0f}% of the energy"
    parts = {
        "kazakh": m.get("kazakh", {}).get("kazakh_prob", 0.0),
        "groove": 0.5 * v.get("groove_active_frac", 0.0) + 0.5 * v.get("drums_active_frac", 0.0),
        "seam": max(0.0, min(1.0, (m["loop"].get("score", -1) - 0.1) / 0.6)) if m["loop"].get("score", -1) > 0 else 0.0,
        "clean": clean_part(m),
        "full": max(0.0, min(1.0, (m["duration_s"] - m["silence"]["tail_silence_s"] - 45) / 20)),
    }
    pen = 0.0 if slot in VOICE_OK else 0.5 * max(0.0, voice - 0.03)
    return round(sum(W_LOOP[k] * parts[k] for k in W_LOOP) - pen, 3), {k: round(x, 3) for k, x in parts.items()}, None


def preview(wav: Path, m: dict, dest: Path) -> int:
    """AAC 64 kb/s stereo, the first 60 s, gain-matched to -18 LUFS (the page's players)"""
    dest.parent.mkdir(parents=True, exist_ok=True)
    gain = min(-18.0 - (m["loudness"]["lufs"] or -18.0), -1.0 - (m["loudness"]["true_peak_dbfs"] or -1.0))
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-t", "60", "-af", f"volume={gain:.2f}dB,afade=t=out:st=58:d=2",
                    "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", str(dest)], check=True)
    return dest.stat().st_size


def cmd_rank(raw: Path, verdict: dict) -> dict:
    for old in ART.glob("*/*.m4a"):  # this folder holds only this script's output
        old.unlink()
    rec: dict = {"test": {}, "slots": {}, "weights": W_LOOP, "voice": {"disqualify": 0.2, "disqualify_night_king": 0.6}}
    for name, targets in TEST_TARGET.items():
        for t in takes(raw, f"test-{name}"):
            if t["metrics"] is None:
                continue
            k = t["metrics"].get("kazakh", {})
            t["target_prob"] = round(sum(k.get("instrument_prob", {}).get(x, 0.0) for x in targets), 3)
            t["m4a"] = f"test/{name}-{t['side']['seed']}.m4a"
            t["bytes"] = preview(Path(t["wav"]), t["metrics"], ART / t["m4a"])
            rec["test"].setdefault(name, []).append(t)
    for slot in SLOTS:
        ts = [t for t in takes(raw, f"nalati-{slot}") if t["metrics"] is not None]
        for t in ts:
            t["score"], t["parts"], t["dq"] = score(t["metrics"], slot)
        ts.sort(key=lambda t: -t["score"])
        ok = [t for t in ts if t["dq"] is None]
        for i, t in enumerate(ok[:3]):
            t["rank"] = i + 1
            t["m4a"] = f"{slot}/{slot}-{t['side']['seed']}.m4a"
            t["bytes"] = preview(Path(t["wav"]), t["metrics"], ART / t["m4a"])
        rec["slots"][slot] = ts
        print(f"{slot:6s} {len(ts)} takes, {len(ok)} ok, ranked {[t['id'] for t in ok[:3]]}", flush=True)
    slim = lambda t: {k: v for k, v in t.items() if k not in ("wav",)}  # noqa: E731
    doc = {"rule": "rank 1 of each slot ships until the user picks (art/music/round-4-nalati/index.html)", "weights": W_LOOP,
           "verdict": verdict, "test": {k: [slim(t) for t in v] for k, v in rec["test"].items()},
           "slots": {s: {"pick": next((t["id"] for t in v if t.get("rank") == 1), None), "takes": [slim(t) for t in v]} for s, v in rec["slots"].items()}}
    (HERE / "nalati-score.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    (ART / "index.html").write_text(page(rec, verdict))
    total = sum(p.stat().st_size for p in ART.glob("*/*.m4a"))
    print(f"previews {total / 1e6:.1f} MB -> {ART}")
    return doc


# ---------------------------------------------------------------- page

def esc(x: object) -> str:
    return html.escape(str(x), quote=True)


def chips(t: dict, slot: str | None) -> str:
    from build_page import chip

    m, v, k = t["metrics"], t["metrics"].get("vocals", {}), t["metrics"].get("kazakh", {})
    kp = k.get("kazakh_prob", 0.0)
    ip = k.get("instrument_prob", {})
    out = [chip("length", f"{m['duration_s']:.0f} s"),
           chip("Kazakh instruments", f"{kp * 100:.0f}%", "good" if kp >= 0.6 else ("warn" if kp < 0.35 else "")),
           chip("heard as", ", ".join(f"{HEARD[n]} {ip.get(n, 0) * 100:.0f}%" for n in sorted(ip, key=lambda n: -ip[n])[:2])),
           chip("tempo", f"{m['tempo']['estimated_bpm']:.0f} bpm"),
           chip("loop seam", f"{m['loop'].get('score', -1):.2f}", "" if m["loop"].get("score", -1) > 0.35 else "warn")]
    if "target_prob" in t:
        tp = t["target_prob"]
        out.insert(1, chip("the asked instrument", f"{tp * 100:.0f}%", "good" if tp >= 0.5 else ("warn" if tp < 0.25 else "")))
    share = v.get("vocal_energy_share", 0)
    wanted = slot in VOICE_OK or (slot is None and "throat" in t["folder"] or "night" in t["folder"])
    out.append(chip("voice", f"{share * 100:.1f}%", "good" if wanted and share > 0.05 else ("bad" if share > 0.10 and not wanted else "")))
    if slot is not None:
        g = v.get("drums_active_frac", 0)
        out.append(chip("groove", f"drums in {g * 100:.0f}%", "good" if g >= 0.7 else ("warn" if g < 0.4 else "")))
    return "".join(out)


def card(t: dict, label: str, slot: str | None, rank: int | None) -> str:
    sc = f'<span class="score" title="measured, not a verdict">{t["score"]:.2f}</span>' if "score" in t else ""
    return f"""
      <article class="take">
        <div class="take-head">
          <span class="rank">{rank if rank is not None else '·'}</span>
          <div><h3>{esc(label)} <span class="seed">seed {esc(t['side']['seed'])}</span></h3>
          <p class="meta">MiniMax Music 3 &middot; {esc(t['side']['gen_time_s'])} s to render</p></div>
          {sc}
        </div>
        <audio controls preload="none" src="{esc(t['m4a'])}"></audio>
        <div class="chips">{chips(t, slot)}</div>
      </article>"""


def page(rec: dict, verdict: dict) -> str:
    from build_page import PAGE_CSS

    test_names = {"dombra": "Dombra (solo)", "kobyz": "Kobyz (solo)", "sybyzgy": "Sybyzgy (solo)", "throat": "Throat-sung drone",
                  "ensemble-day": "Ensemble, day", "ensemble-night": "Ensemble, night (drone + kobyz)"}
    tests = "".join(card(t, test_names[n], None, None) for n, ts in rec["test"].items() for t in ts)
    vt = "".join(f"<li><b>{esc(k)}</b>: {esc(v)}</li>" for k, v in verdict.get("instruments", {}).items())
    secs = []
    for slot in SLOTS:
        ts = [t for t in rec["slots"].get(slot, []) if t.get("rank")]
        n, dq = len(rec["slots"].get(slot, [])), sum(1 for t in rec["slots"].get(slot, []) if t.get("dq"))
        cards = "".join(card(t, "Pick (ships now)" if t["rank"] == 1 else "Alternate", slot, t["rank"]) for t in sorted(ts, key=lambda t: t["rank"]))
        prompt = JOBS["jobs"].get(f"nalati/{slot}", {}).get("prompt", "")
        secs.append(f"""
  <section class="style" id="{slot}">
    <header class="style-head"><h2>{esc(SLOT_TITLE[slot])}</h2><p class="ref">{esc(SLOT_NOTE[slot])}</p>
      <p class="spec"><span>{n} takes</span><span>{dq} out for a voice</span><span>pick first</span></p></header>
    <div class="takes">{cards or '<p class="empty">Not rendered yet.</p>'}</div>
    <details><summary>Prompt</summary><p class="prompt">{esc(prompt)}</p></details>
  </section>""")
    nav = "".join(f'<a href="#{s}">{esc(SLOT_TITLE[s])}</a>' for s in SLOTS)
    return f"""<title>Nalati Score Round 4</title>
<meta name="description" content="The Nalati Grasslands score: a MiniMax Music 3 instrument test (dombra, kobyz, sybyzgy, throat drone) and the takes for each slot, for the user's pick.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
{PAGE_CSS}
.verdict {{ margin-top: 16px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }}
.verdict p, .verdict li {{ max-width: 75ch; }}
</style>
<div class="wrap">
  <header>
    <h1>The Nalati score, round 4</h1>
    <p class="lede">One Kazakh-folk score for the Nalati Grasslands, whatever the music-style setting. First, a six-take test of whether MiniMax Music 3 can play the steppe's instruments. Then the score itself: a theme for each of the three zones, the night, the storm and the Golden King. Each slot has up to three takes, ranked by measurement because nobody could listen while ranking. Until you pick, the game plays each slot's first take. To choose another, name the slot and its seed.</p>
    <div class="brief"><p>&ldquo;Wonder first, adventure second: a dombra's gallop under an open sky; the throat drone only at night and at the King's barrow.&rdquo;</p><small>players gain-matched to -18 LUFS &middot; the first 60 s of each take &middot; in the game every theme loops as two layers: calm alone, plus its drums + bass when danger is near</small></div>
    <nav class="jump"><a href="#test">Instrument test</a>{nav}</nav>
  </header>
  <section class="style" id="test">
    <header class="style-head"><h2>Instrument test</h2><p class="ref">Can MiniMax play a dombra, a kobyz, a sybyzgy and a throat-sung drone convincingly?</p></header>
    <div class="verdict"><p><b>Verdict (by measurement; your ear decides):</b> {esc(verdict.get('summary', 'pending'))}</p><ul>{vt}</ul></div>
    <div class="takes">{tests or '<p class="empty">Not rendered yet.</p>'}</div>
  </section>
  {''.join(secs)}
  <section class="notes">
    <h2>How the takes were ranked</h2>
    <p>Kazakh instruments {int(W_LOOP['kazakh'] * 100)}%: the share CLAP gives the sounds of four Kazakh instruments (a plucked two-string lute, a raspy bowed fiddle, a breathy wooden flute, throat singing) against six foils (an orchestra, piano, acoustic guitar, synths, a rock band, a singer with words). CLAP does not know the instruments by name, so each is described by its sound. Groove {int(W_LOOP['groove'] * 100)}%: drums and bass across the take (htdemucs), because the game's tension layer is exactly those stems. Loop seam {int(W_LOOP['seam'] * 100)}%, clean audio {int(W_LOOP['clean'] * 100)}%, full length with no fade-out {int(W_LOOP['full'] * 100)}%. A take whose separated vocal stem holds over 20% of the energy is out, except in the night and the King's slots, where the throat drone is wanted; there the limit is 60%.</p>
  </section>
</div>
"""


# ---------------------------------------------------------------- build

def cmd_build(raw: Path, picks: dict[str, str]) -> None:
    from stems import CALM_LUFS, LICENCE, PEAK_DB, STING_LUFS, _fade, decode_offset, downbeat, encode, find_loop, grid, limiter, lufs, seam, separate, shipped_name

    import librosa

    doc = json.loads((HERE / "nalati-score.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.m4a"):  # this folder holds only this script's output
        old.unlink()
    tmpd = Path(tempfile.mkdtemp())
    man: dict = {"style": "nalati", "model": "MiniMax-Music3", "credit": "Music: MiniMax-Music3", "slots": {}, "stings": {}, "provenance": []}
    report: dict = {"slots": {}}
    total, grass = 0, None
    for slot in SLOTS:
        pid = picks.get(slot) or doc["slots"].get(slot, {}).get("pick")
        if pid is None:
            print(f"{slot}: no usable take - the chain falls back in the game", flush=True)
            continue
        take = next(t for t in doc["slots"][slot]["takes"] if t["id"] == pid)
        x, sr = sf.read(str(raw / f"nalati-{slot}" / f"{pid}.wav"), always_2d=True)
        x = x.T.astype(np.float64)
        g = grid(x, sr)
        st = separate(x, sr)
        db = downbeat(st["drums"] + st["bass"], sr, g["beats"])
        loop = find_loop(x, sr, g["beats"], db, MAX_LOOP_S)
        bar = (loop["loopEnd"] - loop["loopStart"]) / loop["bars"]
        resid = x - sum(st.values())
        voice = float((st["vocals"] ** 2).sum() / ((x ** 2).sum() + 1e-12))
        tension = st["drums"] + 0.5 * st["bass"]
        keep_voice = slot in VOICE_OK or voice <= 0.03  # the drone is the point of the night / King cues
        calm = x - tension if keep_voice else st["other"] + resid + 0.5 * st["bass"]
        calm_f, _ = seam(calm, sr, loop, bar)
        ten_f, _ = seam(tension, sr, loop, bar)
        L, _ = lufs(calm_f, sr)
        k = 10 ** ((CALM_LUFS - L) / 20)
        r = np.minimum(limiter((calm_f + ten_f) * k, sr, PEAK_DB), limiter(calm_f * k, sr, PEAK_DB))[None]
        calm_o, ten_o = calm_f * k * r, ten_f * k * r
        encode(calm_o, sr, tmpd / "c.m4a")
        encode(ten_o, sr, tmpd / "t.m4a", mono=True)
        lag_c, len_c = decode_offset(tmpd / "c.m4a", calm_o, sr)
        lag_t, len_t = decode_offset(tmpd / "t.m4a", ten_o, sr)
        assert abs(len_c - len_t) < 0.05 and abs(lag_c - lag_t) < 0.002, f"{slot}: stems decode apart"
        name = f"steppe-{slot}"
        cn, tn = shipped_name(OUT, tmpd / "c.m4a", f"{name}-calm"), shipped_name(OUT, tmpd / "t.m4a", f"{name}-tension")
        nc, nt = (OUT / cn).stat().st_size, (OUT / tn).stat().st_size
        total += nc + nt
        man["slots"][name] = {"calm": cn, "tension": tn, "bpm": loop["bpm"], "beatsPerBar": 4, "loopStart": round(loop["loopStart"] + lag_c, 4),
                              "loopEnd": round(loop["loopEnd"] + lag_c, 4), "duration": round(min(len_c, len_t), 4)}
        assert loop["loopEnd"] + lag_c <= min(len_c, len_t)
        side = take["side"]
        for f, part in ((cn, "calm: mix - drums - bass/2" + (" (the voice kept: the drone)" if slot in VOICE_OK else "")), (tn, "tension: drums + bass/2 (htdemucs), mono")):
            man["provenance"].append({"file": f, "model": "MiniMaxAI/MiniMax-Music3", "diffusers": "0.40.0", "prompt": side["prompt"], "lyrics": side["lyrics"],
                                      "seed": side["seed"], "steps": side["steps"], "licence": LICENCE, "take": pid, "stem": part})
        report["slots"][slot] = {"take": pid, "loop": loop, "voice_share": round(voice, 4), "bytes": {"calm": nc, "tension": nt}}
        if slot == "grass":
            grass = (x, loop, take)
        print(f"{slot}: {pid} bpm {loop['bpm']:.1f} loop {loop['loopStart']:.2f}-{loop['loopEnd']:.2f} ({loop['bars']} bars) {(nc + nt) / 1e6:.2f} MB", flush=True)
    if grass is not None:  # stings cut from the grass theme (the score's own instruments)
        x, loop, take = grass
        env = np.abs(x).max(0)
        last = int(np.where(env > env.max() * 10 ** (-40 / 20))[0][-1])
        cuts = {"death": (_fade(x[:, max(0, last - int(4.5 * sr)):last], sr, 0.35, 0.6), "its last 4.5 s")}
        y = librosa.resample(x.mean(0), orig_sr=sr, target_sr=22050)
        rms = librosa.feature.rms(y=y, hop_length=512)[0]
        fps = 22050 / 512
        bar = (loop["loopEnd"] - loop["loopStart"]) / loop["bars"]
        best, tb, t = -1.0, 1.0, loop["loopStart"] % bar
        while t + 3.5 < x.shape[1] / sr - 5:
            i = int(t * fps)
            pre = rms[max(0, i - int(bar * fps)):i].mean() if i > 0 else 0.0
            rise = rms[i:i + int(bar * fps)].mean() / (pre + 1e-6)
            if t > 2 and rise > best:
                best, tb = rise, t
            t += bar
        a = int(max(0.0, tb - 0.25) * sr)
        cuts["chunk"] = (_fade(x[:, a:a + int(3.5 * sr)], sr, 0.25, 1.0), f"a {best:.1f}x swell at {tb:.1f} s")
        on = librosa.onset.onset_strength(y=y, sr=22050)
        cen = librosa.feature.spectral_centroid(y=y, sr=22050)[0][: len(on)]
        sc = on[: len(cen)] * cen
        sc[: int(3 * fps)] = 0
        sc[-int(4 * fps):] = 0
        a = max(0, int((int(np.argmax(sc)) / fps - 0.03) * sr))
        cuts["pickup"] = (_fade(x[:, a:a + int(2.0 * sr)], sr, 0.01, 0.9), f"its brightest onset at {a / sr:.1f} s")
        for sting, (y2, why) in cuts.items():
            L, _ = lufs(y2, sr)
            k = 10 ** ((STING_LUFS - L) / 20)
            y2 = y2 * k * limiter(y2 * k, sr, PEAK_DB - 1.0)[None]
            encode(y2, sr, tmpd / "s.m4a")
            name = shipped_name(OUT, tmpd / "s.m4a", f"sting-{sting}")
            total += (OUT / name).stat().st_size
            man["stings"][sting] = name
            man["provenance"].append({"file": name, "model": "MiniMaxAI/MiniMax-Music3", "prompt": take["side"]["prompt"], "seed": take["side"]["seed"],
                                      "licence": LICENCE, "take": take["id"], "cut_from": f"grass: {why}"})
    (OUT / "music.json").write_text(json.dumps(man, indent=2, ensure_ascii=False) + "\n")
    report["total_bytes"] = total
    (HERE / "nalati-score-build.json").write_text(json.dumps(report, indent=2, default=float) + "\n")
    print(f"nalati: {total / 1e6:.2f} MB -> {OUT}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["analyze", "rank", "build"])
    ap.add_argument("raw")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--verdict", default=None, help="a JSON file: {summary, instruments: {name: text}} for the page")
    ap.add_argument("--pick", nargs="*", default=[], help="slot=take-id overrides (the user's picks)")
    a = ap.parse_args()
    raw = Path(a.raw)
    if a.cmd == "analyze":
        cmd_analyze(raw, a.force)
    elif a.cmd == "rank":
        cmd_rank(raw, json.loads(Path(a.verdict).read_text()) if a.verdict else {})
    else:
        cmd_build(raw, dict(p.split("=", 1) for p in a.pick))


if __name__ == "__main__":
    main()
