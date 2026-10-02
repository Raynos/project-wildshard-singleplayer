# Plan: DECISION-MODELS — Clef / Jev as fast, typed judges in the agent tooling (E394)

**State:** `draft` 2026-10-02 — research and audit done; proposal only, Jake approved none. Open: Jake's go on D1–D4 (local `mlx-community/clef-flash-4bit`, capture QA first).

## Summary

A **decision model** takes a `state` (text or JSON; images and video too for Clef) and a set of typed questions, and
returns a probability for every allowed answer. It does this in one prefill pass and writes no text. There are three
question types:
- `noul`: yes / no, returns P(yes);
- `choice`: one of named options;
- `score`: an ordered rubric.

It is a cheap, calibrated "fuzzy if" for code. It does not replace the LLM in Claude Code or Codex: TypeSafe's own
docs say there is no `model: jev` setting for a coding agent. The win in this repo is to move **repeated, bounded
judgements out of the agents' context** into scripts that call the model. The agent then reads the image or log only
when the model flags it or isn't sure.

- **Jev** (TypeSafe, 2026-09-15): hosted only, text only, `POST https://api.typesafe.ai/v1/systemone`,
  $0.042 / M input tokens. Its 64k context allows 32k for the state. Pin `jev-1.13.0`, not `jev-latest`.
- **Clef / Clef-flash** (Cloudflare, 2026-10-01): open weights under Apache-2.0, with a vision encoder.
  - Architecture: a merged Qwen3.8-27B / Qwen3.5-9B backbone plus a 256 MB "joint schema head" that reads the final
    hidden states.
  - Hosted on Workers AI as `@cf/cloudflare/clef` and `clef-flash` ($0.24 / M input, 65k context).
  - Claims to be Jev-API compatible: the same request body.

## Audit: what the launch posts don't say

1. **"Jev-compatible" doesn't extend to the numbers.** The request body is the same, but:
   - **Confidence.** Jev computes confidence from the spread of the probabilities. For a Choice it is
     `(n × max − 1) / (n − 1)`, and Score uses a distance-weighted variant. Clef's reference `systemone_answer`
     (`joint_schema_model.py`) returns the raw max probability. On a 2-option choice at 0.6 / 0.4, Jev reports
     0.2 and Clef reports 0.6. **Thresholds don't port between the two.** Recompute confidence from `probabilities`
     in our own code.
   - **Joint scoring.** Jev documents that questions are evaluated "in parallel and in isolation". Clef scores all
     fields together: the questions share the causal prompt, and the head's decoder layers attend field to field.
     Adding, removing or reordering a question can therefore move the other answers. Freeze each question set as a
     file and re-calibrate when it changes. Jev's "speculative fan-out" pattern is not safe on Clef until it has been
     tested.
2. **Silent truncation.** The reference `encode_record` defaults to `max_length=16384` and cuts the **tail** of the
   state when it doesn't fit. For logs and transcripts the newest lines are what matter, so trim the state to its tail
   before sending it.
3. **Where each model is weak.** Cloudflare's Decision Index table is Cloudflare's own internal run.
   - Jev still wins the reasoning-heavy rows: GPQA 78 vs 48, BBH 93 vs 74, MMLU-Pro 83 vs 66, When2Call 81 vs 72.
   - Clef-flash collapses on out-of-scope detection (CLINC150+OOS 66.8 vs Clef 97.4) and on hallucination spotting
     (RAGTruth 35.6 vs 79.4). Use flash for routing among known options, and the 27B for "is this claim supported".
4. **Accuracy on real coding-agent decisions is about 70 %, not 95 %.** In an independent test (dev.to, 42 decisions
   taken from a coding agent):
   - overall, Jev scored 71.4 % and Clef-flash 66.7 %, and they agreed on 83 % of the decisions;
   - on agent-supervision calls, both scored 8 / 12.

   Use it as a filter with a confidence threshold, never as an unattended gate on its own.
5. **Adversarial state.** Text in the state that argues for its own label moves the answer (TypeSafe's jev-1.13
   failure-mode list, #6). Never let an agent's own prose be the state of a gate on that agent's work, for example
   "is my HUD change only a bug fix?". Feed the raw diff instead.
6. **Known failure modes (both models):** counting, dates, numbers given as hex or RGB, multi-hop questions, a large
   state full of unrelated detail, and a question and its negation not summing to 1. Do the arithmetic and filtering
   in code.
7. **The GGUF quants are a trap.** The `bartowski` / `prithivMLmods` GGUFs have over 3k downloads, but llama.cpp
   loads only the backbone. With no joint head the output is meaningless text. Only the MLX ports that ship
   `clef_mlx.py` and `joint_head.safetensors` run Clef.

## 4-bit on this Mac

| Repo | Size | Vision | Measured | Note |
|---|---|---|---|---|
| `mlx-community/clef-flash-4bit` | 6.2 GB | yes (tower kept bf16) | **M5 Max 128 GB: 311 ms median**, same top answer as bf16 on 96.4 % of 15,915 answers, about −1 Decision Index point | **the pick**; `mlx-vlm`, no torch |
| `mlx-community/clef-4bit` (27B) | 16.3 GB | yes | M5 Max: 1.03 s median, 98.1 % agreement with 8-bit | for "is this claim supported" checks |
| `TrevorJS/clef-flash-mlx-4bit` | 5.3 GB | **no** (vision dropped) | M2: 2.9 s | text only |
| `Cloudflare/clef-flash` bf16 | 19 GB | yes | none published on Apple Silicon | torch MPS works with `~/ml/imagegen/.venv` (transformers 5.17 has `qwen3_5`); DeltaNet falls back to plain-torch kernels, speed unmeasured |

`mlx-vlm 0.6.4` is already installed in `~/.venv-vllm-metal`. A dedicated venv is the house way.

## Where it fits in this repo (audit of 5 hooks, 8 skills, about 40 scripts and 427 local transcripts)

Nothing in the dev tooling uses a small classifier today. Every bounded decision is made by one of four things: a regex
(hooks, lint), CLAP (audio), an LLM turn reading text or a PNG, or Jake.

| # | Decision | Today | Volume / cost | Fit |
|---|---|---|---|---|
| 1 | **Capture QA**: still loading? black / NaN square? HUD drifted from the reference? garbled text? invented landmark? which Qwen seed did the edit? | an agent Reads every PNG (AGENTS.md "Look at every image", mockup seeds 2–3 per edit) | ~5.7k image Reads in the transcripts, 85 % of all Reads; each image stays in context and is re-sent every turn. 24 art rounds log re-rolls. Progress and timelapse captures have no check at all | **Clef vision**, `noul` per defect, local batch |
| 2 | **WorldClaw judges, T12** (not built): the per-asset style check on "every placed asset", gate lines, sizing | planned as J1 Claude + J2 `codex exec -i` + J3 on splits, scoring 1–10 per rubric line | the highest-volume judging in any plan | a cheap **J0 first pass** for the batched style check: only fails and low-confidence items reach J1 / J2. Picks stay with J1 / J2 |
| 3 | **Ask status in the session brief** | regex `^(done\|dropped\|closed)` (`.claude/hooks/session-brief.sh:20`), so "folded into", "parked" and "superseded" print as open; 156 lines, ~110 asks | every session start | fix the regex first. Then a `choice` "done / still open / folded / stale" over the ask plus the commits that name its id, shown as a suggestion |
| 4 | **Inbox triage** (`drain-inbox`): duplicate? already fixed at this build sha? which code area owns it? | an agent reads each report | 103 reports, 23 distinct, 63 of one `[lifecycle]` message | `choice` over the owner table, on the JSON, the stack and the JPEG |
| 5 | **Model self-review** (`mockup-to-model`): which way the front faces after TRELLIS, floating parts, holes, the better of TRELLIS vs Hunyuan | an agent looks at four views | every model | `choice` of facing, `noul` per defect |

**Not recommended**
- **The Bash guard hooks** (sweep guard, browser lane, bash safety, subagent cap). They run on every call, must be
  deterministic, and the commands they read are partly agent-written (finding 5). Keep them as regexes.
- **Council seats and Jake's picks.** These are the judgements we want from the strongest reader. At most, a model
  could pre-flag a broken frame before a board reaches Jake.
- **An MCP tool that lets Claude or Codex "ask Jev what to do"** (the master-jev-hook / jev-mcp style). The agent is
  the stronger reasoner, so this adds latency and a weaker opinion. The savings come from keeping images and logs out
  of the agent's context, not from second-guessing it.
- **In-game use.** The game has no runtime model, it is an offline-capable phone PWA, and NPC talk is scripted.
- **Audio.** Neither model takes audio. CLAP keeps that job.

## How it plugs into Claude Code and Codex

One plain CLI, so that both agents, every skill and every script use the same path, and Codex reads it from this
same AGENTS.md:

```
scripts/decide/decide.py <questions.json> --state <file|-> [--image a.jpg …] [--backend clef-mlx|workers-ai|jev]
  → stdout: the Jev response body + our own confidence + "flag": true|false per the set's thresholds
```

- **The request and response body are Jev's.** The backend is a switch, so we can compare models on the same calls.
- **Question sets are frozen files** in `scripts/decide/sets/<name>.json`. Each holds its questions, its thresholds,
  the model version it was calibrated on, and the ask it serves.
- **Every call is logged** to `~/.cache/wildshard-decide/log.jsonl`: the set, the state hash, the answers and the
  model id. Calibration and review read that log.
- **Batches run local under the model lock.** For example `~/ml/imagegen/run-locked.sh <log> scripts/decide/decide.py
  --batch <dir>`: load once (~6 GB), score every frame, exit. No resident server, so the "one model at a time"
  rule holds.
- **Hooks are only for cheap advisory work.** SessionStart, for example, can show the ask-status suggestions from a
  batch run's cache. A hook never blocks a command on a model answer.

## Rows

| Row | What | Done when | Status |
|---|---|---|---|
| D1 | Fetch `mlx-community/clef-flash-4bit` with `~/projects/weights/bin/fetch-repo.sh`, add a MODELS.md row and a venv with `mlx-vlm`. Smoke test under the lock: one 390×844 capture, 5 questions | the latency, peak memory and a NaN check written in a localai doc | todo |
| D2 | `scripts/decide/`: the CLI above, the Jev-style confidence recomputed from `probabilities`, tail trimming, the call log, a `--batch` mode, and a fixture test | a dry run on fixtures prints the Jev body for every backend it can reach | todo |
| D3 | Calibrate capture QA on a labelled set: the re-rolled vs kept frames from the art rounds' READMEs and ≥ 150 good progress captures; pick a threshold per question | ≥ 90 % recall on bad frames while flagging ≤ 20 % of good ones, or a written no-go | todo |
| D4 | Wire it in: `mockup-local.sh` seed picking and the shard progress / timelapse captures write `<frame>.qa.json`; the skills say to open the PNG only when it is flagged. An image that goes to Jake is still read by the agent (the AGENTS.md mockup rule stays) | one shard's progress run writes QA sidecars, and the skill text is updated | todo |
| D5 | WorldClaw T12's batched style check gets the J0 pass | agreed and edited in WORLDCLAW-SHARD (its owner's row, not this plan's) | proposal |
| D6 | Text triage: the session-brief status regex fix, then the ask-status and inbox-owner sets | the brief stops listing folded or parked asks; the inbox owner set reaches ≥ 85 % on 50 labelled reports | proposal |

## Picks for Jake

1. **Go on D1–D4, local MLX 4-bit, capture QA first.** Recommended: free, keeps vision, measured on this exact
   machine, ~6 GB under the model lock. The alternatives are Workers AI (needs a Cloudflare account and token) and
   Jev (text only, so it cannot do capture QA).

## Sources

- Cloudflare: https://blog.cloudflare.com/clef-decision-models/ · https://developers.cloudflare.com/workers-ai/models/clef/
  · https://huggingface.co/Cloudflare/clef (and `joint_schema_model.py`) · https://huggingface.co/Cloudflare/clef-flash
- TypeSafe: https://typesafe.ai/blog/introducing-system-one-models-and-jev · https://docs.typesafe.ai/llms.txt
  (models, confidence, jev-1.13 jaggedness, coding agents, agent skill)
- MLX ports: https://huggingface.co/mlx-community/clef-flash-4bit · https://huggingface.co/mlx-community/clef-4bit
  · https://huggingface.co/TrevorJS/clef-flash-mlx-4bit
- Independent test: https://dev.to/prodbymarcu/i-benchmarked-cloudflares-new-open-decision-model-against-the-hosted-api-its-trying-to-replace-2ded
- Agent integrations, for reference: https://github.com/shitianfang/jev-use · https://github.com/sophia-phillipa/master-jev-hook
