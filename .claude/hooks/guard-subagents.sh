#!/usr/bin/env bash
# PreToolUse(Agent|Task) guard — subagents are few and short-lived (Jake, E352; AGENTS.md "Subagents are short-lived").
#
# Contract: reads the PreToolUse JSON on stdin (.session_id, .transcript_path, .agent_id, .tool_use_id, .tool_input).
# - called from inside a subagent (.agent_id set)            → exit 2: subagents don't spawn subagents; report back
# - .tool_input.subagent_type == "fork"                       → exit 2: a fork starts with the parent's whole context
# - this main session already has SUBAGENT_CAP (3) live ones  → exit 2: wait for one to finish, or do the work yourself
# A subagent is live while its transcript (<session>/subagents/agent-*.jsonl) has not ended on an end_turn and was
# written in the last 3 h. Spawns allowed in the last 2 min whose transcript isn't there yet count too (parallel calls).
# Escape (rare): SKIP_SUBAGENT_CAP=1 in the environment. A session Jake grants more slots gets ~/.claude/state/subagent-cap/<session>/cap.
# Exits 0 silently otherwise.

set -uo pipefail
[ "${SKIP_SUBAGENT_CAP:-}" = "1" ] && exit 0
input="$(cat)"
# E357 decision 105: the cap is 20 while the GAME-NORMALIZATION lock holds (.github/lock.json "locked": true)
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ -z "${SUBAGENT_CAP:-}" ] && grep -q '"locked": true' "$root/.github/lock.json" 2>/dev/null; then SUBAGENT_CAP=20; fi
HOOK_INPUT="$input" SUBAGENT_CAP_STATE="${SUBAGENT_CAP_STATE:-}" CAP="${SUBAGENT_CAP:-3}" /usr/bin/python3 - <<'PY'
import json, os, sys, time, glob, fcntl

try:
    d = json.loads(os.environ.get("HOOK_INPUT") or "{}")
except Exception:
    sys.exit(0)
cap = int(os.environ.get("CAP") or 3)
ti = d.get("tool_input") or {}
desc = str(ti.get("description") or "")[:60]

def block(msg):
    sys.stderr.write("BLOCKED by .claude/hooks/guard-subagents.sh (E352, AGENTS.md \"Subagents are short-lived\"): " + msg + "\n")
    sys.exit(2)

if d.get("agent_id"):
    block("a subagent may not spawn subagents. Finish your one job, commit it, and report what is left; "
          "the main agent decides what runs next.")
if str(ti.get("subagent_type") or "") == "fork":
    block("no forks: a fork starts with the parent's whole context (500k+ tokens) and re-writes it to cache. "
          "Spawn a general-purpose agent with a short written brief instead.")

tp = d.get("transcript_path") or ""
sid = d.get("session_id") or os.path.basename(tp).replace(".jsonl", "")
if not tp or not sid:
    sys.exit(0)
subdir = tp[:-len(".jsonl")] + "/subagents" if tp.endswith(".jsonl") else os.path.join(os.path.dirname(tp), sid, "subagents")
now = time.time()

def ended(path):
    try:
        with open(path, "rb") as f:
            f.seek(0, 2); size = f.tell(); f.seek(max(0, size - 262144))
            lines = f.read().splitlines()
    except OSError:
        return True
    for raw in reversed(lines):
        try:
            rec = json.loads(raw)
        except Exception:
            continue
        t = rec.get("type")
        if t == "assistant":
            # an API error (a usage limit, 2026-10-03) ends the agent too: it never writes an end_turn
            return rec.get("isApiErrorMessage") is True or (rec.get("message") or {}).get("stop_reason") == "end_turn"
        if t == "user":
            return False
    return False

state = os.path.join(os.environ.get("SUBAGENT_CAP_STATE") or os.path.expanduser("~/.claude/state/subagent-cap"), sid)
os.makedirs(state, exist_ok=True)
# A per-session cap Jake granted one session (2026-10-07, E435: "I green light 5 opus subagent slots" for the
# SHARD-PLATFORM builder) lives in <state>/<session>/cap, outside the repo; every other session keeps the default.
try:
    with open(os.path.join(state, "cap")) as f:
        cap = max(cap, int(f.read().strip()))
except (OSError, ValueError):
    pass
with open(os.path.join(state, ".lock"), "w") as lk:
    fcntl.flock(lk, fcntl.LOCK_EX)
    live, seen_ids, young = [], set(), 0
    for p in glob.glob(os.path.join(subdir, "agent-*.jsonl")):
        try:
            st = os.stat(p)
        except OSError:
            continue
        try:
            seen_ids.add(json.load(open(p[:-len(".jsonl")] + ".meta.json")).get("toolUseId"))
        except Exception:
            pass
        if now - st.st_birthtime < 120:
            young += 1
        if now - st.st_mtime < 3 * 3600 and not ended(p):
            try:
                live.append(json.load(open(p[:-len(".jsonl")] + ".meta.json")).get("description") or os.path.basename(p))
            except Exception:
                live.append(os.path.basename(p))
    pending = []
    for s in glob.glob(os.path.join(state, "pending-*")):
        age = now - os.stat(s).st_mtime
        if age > 120:
            os.unlink(s); continue
        pending.append(os.path.basename(s)[len("pending-"):])
    unmatched = [x for x in pending if x not in seen_ids]
    # slots named by tool_use_id dedupe exactly; unnamed ones (t-<time>) are offset by transcripts born since
    named = [x for x in unmatched if not x.startswith("t-")]
    unnamed = [x for x in unmatched if x.startswith("t-")]
    n = len(live) + len(named) + max(0, len(unnamed) - young)
    if n >= cap:
        block(f"this session already has {n} live subagents (cap {cap}): " + "; ".join(str(x)[:50] for x in live) +
              ". Wait for one to finish (its result arrives as a notification), or do this job in the main agent. "
              "Never hand a new job to a finished subagent: spawn a fresh one when a slot frees up.")
    tid = d.get("tool_use_id") or f"t-{now:.3f}"
    open(os.path.join(state, "pending-" + str(tid)), "w").write(desc)
sys.exit(0)
PY
