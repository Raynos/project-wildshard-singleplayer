"""E357 S1.5: Nine Dragon's listening board, in ph_page.py's house style, with MP3 players only.

    python3 scripts/music/gen/nd_page.py <raw-score-dir> <raw-sfx-dir> [--round 1] [--out <artifact-folder>]

Reads nd-score.json, sfx-nd-<model>.json, sfx-best.json and the shipped Nine Dragon manifests.
Writes calm then calm+tension for each slot, one runner-up, the three stings, both engines per SFX family
(beds: 15 s), and each shipped bed. No ranking or models. --dry prints the encode plan without writing.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from audio_jobs import read_sfx
from build_page import PAGE_CSS
from ph_page import CSS_EXTRA, MODELS, RAW_DIR, audio, esc, ff

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
SET = "nine-dragon-stack"
SLOTS = ("nd-market", "nd-well", "nd-fight")


def build(raw: Path, sfx_raw: Path, art: Path, dry: bool = False) -> dict:
    music_dir = REPO / "public/assets/music" / SET
    sfx_dir = REPO / "public/assets/sfx" / SET
    man = json.loads((music_dir / "music.json").read_text())
    sfx = json.loads((sfx_dir / "sfx.json").read_text())
    score = json.loads((HERE / "nd-score.json").read_text())
    ranks = {m: json.loads((HERE / f"sfx-nd-{m}.json").read_text())["families"] for m in MODELS}
    decisions = json.loads((HERE / "sfx-best.json").read_text())["families"]
    families = read_sfx(HERE / "sfx-nd-jobs.json")["families"]
    plan = []

    def enc(inputs: list[Path], relative: str, filt: str, *, mono: bool = False, lufs: float | None = None) -> str:
        dest = art / relative
        norm = "anull" if lufs is None else f"loudnorm=I={lufs}:TP=-1.5"
        args = []
        for path in inputs:
            if not path.is_file():
                raise FileNotFoundError(path)
            args += ["-i", str(path)]
        args += ["-filter_complex", f"{filt};[out]{norm}[o]", "-map", "[o]", "-ac", "1" if mono else "2",
                 "-ar", "48000", "-c:a", "libmp3lame", "-b:a", "96k", str(dest)]
        plan.append({"file": relative, "args": args})
        if not dry:
            dest.parent.mkdir(parents=True, exist_ok=True)
            ff(args)
        return relative

    sections = []
    for slot in SLOTS:
        p = man["slots"][slot]
        length = p["loopEnd"] - p["loopStart"]
        start, end = p["loopStart"], p["loopEnd"]
        built = enc([music_dir / p["calm"], music_dir / p["tension"]], f"score/{slot}-built.mp3",
                    f"[0]atrim={start}:{end},asetpts=N/SR/TB,aloop=loop=1:size={round(length * 48000)}[c];"
                    f"[1]atrim={start}:{end},asetpts=N/SR/TB,aloop=loop=1:size={round(length * 48000)},"
                    f"volume='if(lt(t,{length:.6f}),0,1)':eval=frame[t];[c][t]amix=inputs=2:normalize=0[out]")
        clips = [audio(built, "As shipped: calm, then calm + tension", f"{p['bpm']:.0f} bpm, two {length:.1f} s loops")]
        rec = score["slots"][slot]
        pick = next((r["take"] for r in man.get("provenance", []) if r["file"] == p["calm"]), rec["pick"])
        alts = sorted((t for t in rec["takes"] if t.get("rank") and t["id"] != pick), key=lambda t: t["rank"])
        if alts:
            alt = alts[0]
            seed = alt["side"]["seed"]
            path = enc([raw / f"nd-{slot}" / f"{alt['id']}.wav"], f"score/{slot}-alt-{seed}.mp3",
                       "[0]atrim=0:45,afade=t=out:st=42:d=3[out]", lufs=-18.0)
            clips.append(audio(path, f"Runner-up, seed {seed}", f"score {alt['score']:.2f}"))
        sections.append(f'<section class="style" id="{slot}"><h2>{esc(slot)}</h2>{"".join(clips)}</section>')

    clips = []
    for sting in ("pickup", "death", "chunk"):
        path = enc([music_dir / man["stings"][sting]], f"score/sting-{sting}.mp3", "[0]anull[out]")
        clips.append(audio(path, sting))
    sections.append(f'<section class="style"><h2>Market stings, as shipped</h2>{"".join(clips)}</section>')

    clips = []
    for name in ("nd.market", "nd.well"):
        bed = sfx["beds"].get(name)
        if bed is None:
            clips.append(f'<p class="empty">{esc(name)}: neither take shipped; synth fallback.</p>')
            continue
        # Repeat from measured loop points if the built bed's loop is shorter than 15 seconds.
        length = bed["loopEnd"] - bed["loopStart"]
        path = enc([sfx_dir / bed["file"]], f"beds/{name}.mp3",
                   f"[0]atrim={bed['loopStart']}:{bed['loopEnd']},asetpts=N/SR/TB,"
                   f"aloop=loop=-1:size={round(length * 48000)},atrim=0:15,afade=t=out:st=13.5:d=1.5[out]")
        clips.append(audio(path, name, "15 s, as shipped"))
    sections.append(f'<section class="style" id="beds"><h2>Ambience beds, as shipped</h2>{"".join(clips)}</section>')

    rows = []
    for family, job in families.items():
        cells = []
        winner = decisions.get(family, {}).get("winner")
        for model in MODELS:
            takes = ranks[model].get(family, [])
            if not takes:
                cells.append('<td class="empty">Not rendered yet.</td>')
                continue
            take = takes[0]
            cut = ",atrim=0:15,afade=t=out:st=13.5:d=1.5" if job["kind"] == "bed" else ""
            path = enc([sfx_raw / RAW_DIR[model] / family / f"{take['seed']}.wav"], f"sfx/{model}/{family}.mp3",
                       f"[0]anull{cut}[out]", mono=True, lufs=-20.0)
            note = f"CLAP rank {take['rank']}, {take['p']:.0%}" + ("; ships" if winner == model else "")
            cells.append(f"<td>{audio(path, MODELS[model], note)}</td>")
        note = "Synth fallback" if winner == "synth" else ""
        rows.append(f"<tr><th scope='row'>{esc(family)}<br><span class='meta'>{esc(job['desc'])} {note}</span></th>{''.join(cells)}</tr>")
    sections.append(f'<section class="style" id="sfx"><h2>Both sound engines</h2><div class="tablewrap"><table class="grid">'
                    f'<thead><tr><th>Family</th>{"".join(f"<th>{esc(m)}</th>" for m in MODELS.values())}</tr></thead><tbody>{"".join(rows)}</tbody></table></div></section>')
    page = f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nine Dragon, the sound</title><style>{PAGE_CSS}{CSS_EXTRA}</style><div class="wrap"><header>
<h1>Nine Dragon, the sound</h1><p class="lede">A neon night market: guzheng and erhu over a soft analog pad, rising in fights.
Rain on tiled roofs, lantern hum, crowd and hawkers, wind chimes in the Well. Keep or re-roll: name any slot or family.</p>
<div class="brief"><p>Each score plays calm first, then calm + tension. A runner-up follows. Every sound has both engines side by side.</p>
<small>MP3 previews · shipped music retains its level · raw alternatives −18 LUFS · SFX comparisons −20 LUFS</small></div>
<nav class="jump">{"".join(f'<a href="#{s}">{s}</a>' for s in SLOTS)}<a href="#beds">Beds</a><a href="#sfx">Sound effects</a></nav></header>
{"".join(sections)}<section class="notes"><h2>Credits</h2><p>Music: MiniMax-Music3. Sound effects: MOSS-SoundEffect v2 and Stable Audio 3 Medium — Powered by Stability AI.</p></section></div>'''
    if not dry:
        art.mkdir(parents=True, exist_ok=True)
        (art / "index.html").write_text(page)
    return {"out": str(art), "encodes": plan, "html": page}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("raw", type=Path)
    ap.add_argument("sfx_raw", type=Path)
    ap.add_argument("--round", type=int, default=1)
    ap.add_argument("--out", type=Path, help="override the board folder, e.g. a scratchpad Artifact folder")
    ap.add_argument("--dry", action="store_true", help="validate inputs and print the encode plan; no writes")
    args = ap.parse_args()
    if args.round < 1:
        ap.error("--round must be positive")
    art = args.out or REPO / f"art/music/round-{args.round}-{SET}"
    plan = build(args.raw, args.sfx_raw, art, args.dry)
    print(json.dumps(plan, indent=2, ensure_ascii=False) if args.dry else f"page -> {art / 'index.html'} ({len(plan['encodes'])} MP3 previews)")


if __name__ == "__main__":
    main()
