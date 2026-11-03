"""OB7 measurement, model comparison and bounded AAC publication.

`measure` and `publish` load no neural model. `clap` and `vocals` each
load one model and must run in separate shared-lock turns. No command
claims an in-game playback pass or an ear-reviewed taste decision.
"""
from __future__ import annotations

import argparse
import difflib
import hashlib
import html
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SCORE = json.loads((HERE / "ob7-score-jobs.json").read_text())
SFX = json.loads((HERE / "ob7-sfx-jobs.json").read_text())["families"]
FOILS = ["music with melody and instruments", "a person speaking", "silence"]


def write(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n")


def score_files(raw: Path, plot: str) -> list[Path]:
    files = [raw / f"ob7-{plot}" / f"minimax3-{seed}.wav" for seed in (701, 702)]
    if any(not file.is_file() for file in files):
        raise ValueError(f"{plot}: both score takes are required")
    return files


def sfx_files(raw: Path, plot: str) -> list[Path]:
    files = []
    for family, row in SFX.items():
        if row["into"] != plot:
            continue
        for model in ("moss", "medium"):
            takes = sorted((raw / model / family).glob("*.wav"))
            if not takes:
                raise ValueError(f"{plot}: both engines for all six sounds are required")
            files.extend(takes)
    return files


def measure(raw: Path, plot: str) -> None:
    from analyze import analyze
    job = SCORE["jobs"][f"ob7/{plot}"]
    for wav in score_files(raw, plot):
        side = json.loads(wav.with_suffix(".json").read_text())
        path = wav.with_suffix(".metrics.json")
        prior = json.loads(path.read_text()) if path.exists() else {}
        write(path, {**prior, **analyze(wav, side, job, None, None)})
        print(f"measured {wav.name}", flush=True)


def vocals(raw: Path, plot: str) -> None:
    import soundfile as sf
    from analyze import Vocals
    model = Vocals()
    for wav in score_files(raw, plot):
        path = wav.with_suffix(".metrics.json")
        metrics = json.loads(path.read_text())
        samples, sr = sf.read(str(wav), always_2d=True)
        metrics["vocals"] = model.score(samples, sr)
        write(path, metrics)
        print(f"vocals {wav.name}: {metrics['vocals']}", flush=True)


def clap(raw: Path, plot: str) -> None:
    import librosa
    import numpy as np
    import soundfile as sf
    import torch
    from transformers import ClapModel, ClapProcessor
    from analyze import CLAP_DIR, _tensor

    model = ClapModel.from_pretrained(str(CLAP_DIR)).eval()
    processor = ClapProcessor.from_pretrained(str(CLAP_DIR))
    descriptions = [row["desc"] for row in SFX.values()] + FOILS
    score_keys = list(SCORE["jobs"])
    music_texts = [SCORE["jobs"][key]["prompt"] for key in score_keys] + FOILS

    def compare(wav: Path, texts: list[str], own: int) -> dict:
        samples, sr = sf.read(str(wav), always_2d=True)
        mono = librosa.resample(samples.mean(1).astype(np.float32), orig_sr=sr, target_sr=48000)
        chunks = [mono[i:i + 480000] for i in range(0, max(len(mono) - 240000, 1), 480000)]
        with torch.no_grad():
            text = torch.nn.functional.normalize(_tensor(model.get_text_features(**processor(text=texts, return_tensors="pt", padding=True))), dim=-1)
            audio = torch.nn.functional.normalize(_tensor(model.get_audio_features(**processor(audio=chunks, sampling_rate=48000, return_tensors="pt"))), dim=-1).mean(0, keepdim=True)
            similarity = (torch.nn.functional.normalize(audio, dim=-1) @ text.T)[0]
            probability = torch.softmax(similarity * model.logit_scale_a.detach().exp(), 0)
        return {"rank": int((similarity > similarity[own]).sum()) + 1,
                "p": round(float(probability[own]), 6), "best": texts[int(similarity.argmax())]}

    result = {"model": "laion/clap-htsat-fused", "sfx": {}, "score": {}}
    families = list(SFX)
    for wav in sfx_files(raw, plot):
        family = wav.parent.name
        model_name = wav.parent.parent.name
        match = {**compare(wav, descriptions, families.index(family)), "seed": wav.stem}
        family_rows = result["sfx"].setdefault(family, {})
        old = family_rows.get(model_name)
        if old is None or (match["rank"], -match["p"]) < (old["rank"], -old["p"]):
            family_rows[model_name] = match
    for wav in score_files(raw, plot):
        result["score"][wav.stem] = compare(wav, music_texts, score_keys.index(f"ob7/{plot}"))
    write(raw / f"{plot}-clap.json", result)
    print(json.dumps(result), flush=True)


def encode_loop(wav: Path, target: Path, lufs: float, kbps: int, scratch: Path, music_metrics: dict | None = None) -> dict:
    import librosa
    import numpy as np
    import soundfile as sf
    from analyze import loop_seam
    from stems import decode_offset, seam

    samples, sr = sf.read(str(wav), always_2d=True)
    mono = librosa.resample(samples.mean(1).astype(np.float32), orig_sr=sr, target_sr=22050)
    loop = music_metrics["loop"] if music_metrics else loop_seam(mono, 22050, 240, len(samples) / sr)
    if loop.get("score", -1) <= 0 or loop.get("end_s", 0) <= loop.get("start_s", 0):
        raise ValueError(f"{wav}: no measured loop seam")
    start, end = loop["start_s"], loop["end_s"]
    # A one-second transition is bounded by the real pre-loop source audio.
    crossfade = min(1.0, start / 2)
    source, _ = seam(samples.T, sr, {"loopStart": start, "loopEnd": end}, crossfade)
    intermediate = scratch / "loop.wav"
    sf.write(str(intermediate), source.T, sr, subtype="FLOAT")
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(intermediate),
                    "-af", f"loudnorm=I={lufs}:TP=-2:LRA=8,aresample=48000,asetpts=N/SR/TB", "-ar", "48000", "-c:a", "aac",
                    "-b:a", f"{kbps}k", "-movflags", "+faststart", str(target)], check=True)
    # Refuse unsupported packets before any public copy or catalogue activation.
    subprocess.run(["node", "--experimental-transform-types", "--input-type=module", "-e",
                    "import {readFileSync} from 'node:fs'; "
                    "import {indexRecordingAac} from './src/format/aacIndex.ts'; "
                    "indexRecordingAac(new Uint8Array(readFileSync(process.argv[1])));", str(target)],
                   cwd=REPO, check=True)
    lag, duration = decode_offset(target, source, sr)
    if not 0 <= start + lag < end + lag <= duration:
        raise ValueError(f"{target}: loop is outside the decoded AAC")
    intermediate.unlink()
    digest = hashlib.sha256(target.read_bytes()).hexdigest()[:12]
    addressed = target.with_name(f"{target.stem}-{digest}{target.suffix}")
    target.rename(addressed)
    return {"file": addressed.name, "loopStart": round(start + lag, 6), "loopEnd": round(end + lag, 6),
            "duration": round(duration, 6), "gain": 1, "seamScore": loop["score"]}


def publish(raw: Path, plot: str) -> None:
    with tempfile.TemporaryDirectory(prefix=f'encode-{plot}-', dir=raw) as folder:
        publish_checked(raw, plot, Path(folder))


def publish_checked(raw: Path, plot: str, scratch: Path) -> None:
    comparisons = json.loads((raw / f"{plot}-clap.json").read_text())
    music = scratch / 'music'
    sfx = scratch / 'sfx'
    music.mkdir()
    sfx.mkdir()
    candidates = []
    for index, wav in enumerate(score_files(raw, plot)):
        metrics = json.loads(wav.with_suffix(".metrics.json").read_text())
        voice = metrics["vocals"]["vocal_energy_share"]
        # Mosslight explicitly calls for a wordless low choir pad.
        voice_limit = 0.6 if plot == "mosslight-ruins" else 0.1
        failed = []
        if metrics["duration_s"] < 25:
            failed.append('duration below 25 seconds')
        if voice > voice_limit:
            failed.append(f'vocal check {voice:.1%} exceeds {voice_limit:.0%}')
        if metrics["clipping"]["clipped_frac"] > 0.0001:
            failed.append('clipping check')
        if metrics["silence"]["longest_internal_gap_s"] > 2:
            failed.append('internal silence check')
        match = comparisons["score"][wav.stem]
        rank = 0.5 * match["p"] + 0.35 * max(metrics["loop"]["score"], 0) + 0.15 * min(metrics["duration_s"] / 60, 1)
        encoded = encode_loop(wav, music / f"take-{'ab'[index]}.m4a", -20, 64, scratch, metrics)
        candidates.append({"id": wav.stem, "recommendationScore": rank, "metrics": metrics,
                           "qualified": not failed, "failedChecks": failed, "clap": match, "encoded": encoded,
                           "provenance": json.loads(wav.with_suffix(".json").read_text())})
    qualified = [row for row in candidates if row['qualified']]
    if not qualified:
        raise ValueError(f'{plot}: neither score take passes the shipping checks')
    winner = max(qualified, key=lambda row: row["recommendationScore"])
    slot = {**winner["encoded"], "calm": winner["encoded"]["file"], "bpm": winner["metrics"]["loop"]["grid_bpm"], "beatsPerBar": 4}
    write(music / "music.json", {"genre": plot, "model": "MiniMax Music 3", "credit": "Music: MiniMax-Music3",
                                 "licence": "MiniMax-Music3 Community License",
                                 "slots": {"score": slot}, "stings": {}, "recommendation": winner["id"], "takes": candidates})
    manifest = {"model": "MOSS-SoundEffect v2 · Stable Audio 3 Medium", "credit": "Sound effects: MOSS-SoundEffect v2 · Stable Audio 3 Medium — Powered by Stability AI",
                "licence": "MOSS: Apache-2.0; Stable Audio 3 Medium: Stability AI Community License and Gemma terms",
                "beds": {}, "hums": {}, "oneshots": {}, "provenance": []}
    for family, row in SFX.items():
        if row["into"] != plot:
            continue
        pair = comparisons["sfx"][family]
        engine = min(pair, key=lambda key: (pair[key]["rank"], -pair[key]["p"]))
        if pair[engine]["rank"] > 5:
            raise ValueError(f"{family}: neither engine meets the existing CLAP top-five bar")
        wav = raw / engine / family / f"{pair[engine]['seed']}.wav"
        ident = family.removeprefix("bed.").removeprefix("hum.")
        name = family.rsplit(".", 1)[1]
        entry = encode_loop(wav, sfx / f"{name}.m4a", -24 if row["kind"] == "bed" else -26, 64, scratch)
        manifest["beds" if row["kind"] == "bed" else "hums"][ident] = entry
        manifest["provenance"].append({"file": entry["file"], "winner": engine, "comparison": pair,
                                       "source": json.loads(wav.with_suffix(".json").read_text())})
    write(sfx / "sfx.json", manifest)
    total = sum(path.stat().st_size for folder in (music, sfx) for path in folder.iterdir() if path.is_file())
    if total > 3_000_000 or any(path.stat().st_size > 1_000_000 for folder in (music, sfx) for path in folder.iterdir()):
        raise ValueError(f"{plot}: audio byte budget refused ({total})")
    for staged, destination in [(music, REPO / 'public/assets/music' / plot), (sfx, REPO / 'public/assets/sfx' / plot)]:
        destination.mkdir(parents=True, exist_ok=True)
        for path in staged.iterdir():
            shutil.copyfile(path, destination / path.name)
    print(f"{plot}: {total} bytes, recommended {winner['id']}; native playback bar still open", flush=True)


def listening_list() -> None:
    """One small phone-friendly list; recordings stay in their plot folders."""
    sections = []
    for job in SCORE["jobs"].values():
        plot = job["slot"]
        path = REPO / "public/assets/music" / plot / "music.json"
        if not path.exists():
            continue
        manifest = json.loads(path.read_text())
        takes = []
        for index, take in enumerate(manifest["takes"]):
            label = "AB"[index]
            recommendation = " · Recommended / shipping" if take["id"] == manifest["recommendation"] else ""
            if not take['qualified']:
                recommendation += ' · Comparison only: ' + html.escape('; '.join(take['failedChecks']))
            source = html.escape(f"{plot}/{take['encoded']['file']}", quote=True)
            takes.append(f'<p><strong>Take {label}{recommendation}</strong> · seed {take["provenance"]["seed"]}</p>'
                         f'<audio controls preload="none" src="{source}"></audio>')
        sections.append(f'<section><h2>{html.escape(plot.replace("-", " ").title())}</h2>{"".join(takes)}</section>')
    if not sections:
        raise ValueError("No real OB7 score recordings have been published")
    page = ('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Open plots · morning listening batch</title><style>body{max-width:440px;margin:24px auto;padding:0 18px;background:#101820;color:#e7eef2;'
            'font:16px/1.5 system-ui}h1{font-size:26px}h2{font-size:21px}section{border-top:1px solid #43505a;padding:16px 0}audio{width:100%}p{color:#c6d3dc}</style>'
            '<h1>Open plots · morning listening batch</h1><p>Two MiniMax Music 3 takes per plot. The measured recommendation ships; your listening steers the pick. '
            'Recommendations use theme match, loop seam, duration and vocal checks; they are not ear-reviewed verdicts.</p>'
            + ''.join(sections) + '<p>Music: MiniMax-Music3</p></html>')
    (REPO / "public/assets/music/ob7-listening.html").write_text(page)


def activation(raw: Path, plot: str) -> None:
    """Emit an exact HEAD patch; peer loose JSON never enters this landing."""
    music_dir = REPO / "public/assets/music" / plot
    sfx_dir = REPO / "public/assets/sfx" / plot
    music = json.loads((music_dir / "music.json").read_text())
    sfx = json.loads((sfx_dir / "sfx.json").read_text())
    if len(music["takes"]) != 2 or music["credit"] != "Music: MiniMax-Music3" or "Powered by Stability AI" not in sfx["credit"]:
        raise ValueError("Both score candidates and required credits must exist before activation")
    selected = [row for row in music['takes'] if row['id'] == music['recommendation'] and row['qualified']]
    if len(selected) != 1 or music['slots']['score']['calm'] != selected[0]['encoded']['file']:
        raise ValueError('Only the qualified recommended score may be activated')
    if len(sfx["provenance"]) != 6 or any(set(row["comparison"]) != {"moss", "medium"} for row in sfx["provenance"]):
        raise ValueError("Both engines must be compared for all six sounds")
    anchors = json.loads((REPO / "src/shards/open-plots/data/audioAnchors.json").read_text())[plot]
    files = {"score": music["slots"]["score"]["calm"], "ambience": sfx["beds"][f"{plot}.ambience"]["file"],
             **{row["id"]: sfx["hums"][f"{plot}.{row['id']}"]["file"] for row in anchors}}
    for key, file in files.items():
        folder = music_dir if key == "score" else sfx_dir
        if Path(file).name != file or not (folder / file).is_file():
            raise ValueError(f"Missing or unconfined recording: {file}")
    binding = {"idea": plot, "source": {"dir": f"/assets/music/{plot}/", "manifestKey": plot},
               "sfxDir": f"/assets/sfx/{plot}/", "files": files, "spots": anchors}
    patches = []

    def edit(name: str, mutate) -> None:
        before = subprocess.run(["git", "show", f"HEAD:{name}"], cwd=REPO, check=True, capture_output=True, text=True).stdout
        data = json.loads(before)
        mutate(data)
        after = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
        patches.append(f"diff --git a/{name} b/{name}\n" + ''.join(difflib.unified_diff(
            before.splitlines(keepends=True), after.splitlines(keepends=True), fromfile=f"a/{name}", tofile=f"b/{name}")))

    edit("src/shards/open-plots/data/audioBindings.json", lambda data: data.update({plot: binding}))
    base = json.loads((REPO / "src/shards/open-plots/manifest.json").read_text())

    def manifest(row: dict) -> None:
        metadata = row["manifest"]
        metadata["audio"] = {"catalogue": True, "ambience": f"ambience.{plot}", "score": f"score.{plot}", "bed": "none"}
        metadata["assetGlobs"] = list(dict.fromkeys([*metadata.get("assetGlobs", base["assetGlobs"]),
                                                    f"public/assets/music/{plot}/**", f"public/assets/sfx/{plot}/**"]))

    def output(data: dict) -> None:
        rows = [row for row in data["outputs"] if row["idea"] == plot]
        if len(rows) != 1:
            raise ValueError("Plot activation requires exactly its own output row")
        manifest(rows[0])

    edit("src/shards/open-plots/outputs.json", output)
    edit(f"src/shards/open-plots/data/templates/{plot}.json", lambda data: manifest(data["output"]))
    destination = raw / f"{plot}-activation.patch"
    destination.write_text(''.join(patches))
    print(f"Exact activation patch: {destination}; native playback bar remains open")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["measure", "vocals", "clap", "publish", "listening", "activate"])
    parser.add_argument("raw", type=Path, nargs="?")
    parser.add_argument("--plot")
    args = parser.parse_args()
    if args.command in ("clap", "vocals") and (REPO / '.git/quiet').exists():
        raise SystemExit('Official Simulator quiet window is open; no model loaded')
    if args.command == "listening":
        listening_list()
        return
    if args.raw is None:
        parser.error("raw directory is required")
    if f"ob7/{args.plot}" not in SCORE["jobs"]:
        parser.error("unknown plot")
    {"measure": measure, "vocals": vocals, "clap": clap, "publish": publish, "activate": activation}[args.command](args.raw.resolve(), args.plot)


if __name__ == "__main__":
    main()
