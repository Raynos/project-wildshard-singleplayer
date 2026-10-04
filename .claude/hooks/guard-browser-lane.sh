#!/usr/bin/env bash
# PreToolUse(Bash) guard — headless game browsers go through the machine-wide lane (E312, scripts/browser-lane.sh).
#
# Contract: reads the PreToolUse JSON on stdin (.tool_input.command, .cwd).
# - `node <script>` / `pnpm <script>` whose script launches a browser (Playwright / Puppeteer), not wrapped in
#   scripts/browser-lane.sh                                   → exit 2 (block): wrap it
# - `agent-browser … open …` on a NEW session while the lane is full → exit 2 (block): `scripts/browser-lane.sh wait`
#   (reusing a session that is already open is always fine)
# Escape (rare): SKIP_BROWSER_LANE=1. Exits 0 silently otherwise.

set -uo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)"
[ -z "$cmd" ] && exit 0
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)"
[ -z "$cwd" ] && cwd="$PWD"
root="${CLAUDE_PROJECT_DIR:-$cwd}"
lane="$root/scripts/browser-lane.sh"
[ -x "$lane" ] || exit 0

case "$cmd" in *SKIP_BROWSER_LANE=1*|*browser-lane.sh*) exit 0;; esac

# ── no vite dev servers (E317): build + preview through scripts/serve-build.sh ─────────────────────────────────────────
if ! printf '%s' "$cmd" | grep -q 'serve-build\.sh' \
  && printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])((pnpm exec|npx|pnpm dlx|bunx)[[:space:]]+vite([[:space:]]|$)|vite/bin/vite\.js)'; then
  if ! printf '%s' "$cmd" | grep -qE '(vite|vite\.js)[[:space:]]+(build|preview|optimize)|[[:space:]]--(version|help)'; then
    cat >&2 <<'EOF'
BLOCKED by .claude/hooks/guard-browser-lane.sh: a vite DEV server.

Nobody runs `vite` dev on this machine any more (Jake, E317). Build and serve the build instead:

    scripts/serve-build.sh [--head] [--hours <h>] [--name <label>]     # prints http://127.0.0.1:<port>/
    scripts/serve-build.sh stop <port>                                  # when you are done

It builds in ~10 s (public/ is symlinked, not copied) and the preview is reaped after --hours (default 4).
EOF
    exit 2
  fi
fi

# ── iOS Simulators through the sim lane (E316) ───────────────────────────────────────────────────────────────────────
if ! printf '%s' "$cmd" | grep -q 'sim-lane\.sh' && printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])(xcrun[[:space:]]+simctl[[:space:]]+boot|open[[:space:]]+-a[[:space:]]+"?Simulator)'; then
  cat >&2 <<EOF
BLOCKED by .claude/hooks/guard-browser-lane.sh: booting an iOS Simulator outside the sim lane.

A booted Simulator costs ~6 GB; at most ${SIM_LANES:-1} runs machine-wide, and idle ones are shut down (E316):

    scripts/sim-lane.sh run [--max <min>] <device> <cmd …>     # boot, run, shut down
    scripts/sim-lane.sh lease <device> [<min>]                 # drive it by hand; renew with the same command
    scripts/sim-lane.sh release <device>                       # done: shut it down

See .claude/skills/ios-simulator/SKILL.md.
EOF
  exit 2
fi

# ── agent-browser: a new session only while the lane has room ────────────────────────────────────────────────────────
if printf '%s' "$cmd" | grep -qE '(^|[;&|[:space:]])agent-browser([[:space:]][^;&|]*)?[[:space:]]open([[:space:]]|$)'; then
  s="$(printf '%s' "$cmd" | grep -oE -- '--session[= ]+[^ ;&|]+' | head -1 | sed -E 's/--session[= ]+//')"
  if [ -n "$s" ] && agent-browser session list 2>/dev/null | grep -qE "^[[:space:]]+$s\$"; then exit 0; fi
  if ! bash "$lane" free; then
    cat >&2 <<EOF
BLOCKED by .claude/hooks/guard-browser-lane.sh: the browser lane is full ($(bash "$lane" status | head -1)).

At most ${BROWSER_LANES:-3} headless game browsers run on this Mac at once, across every agent and repo (E312).
Wait for room, then open:

    scripts/browser-lane.sh wait && agent-browser --session <s> open "<url>"

Or reuse a session you already have open. \`scripts/browser-lane.sh status\` shows who holds what.
Close your session (\`agent-browser --session <s> close\`) the moment you are done.
EOF
    exit 2
  fi
  exit 0
fi

# ── node / pnpm scripts that launch a browser must run inside the lane ───────────────────────────────────────────────
launches="$(python3 - "$cmd" "$cwd" "$root" <<'PY'
import json, os, re, sys
cmd, cwd, root = sys.argv[1:4]
LAUNCH = re.compile(r"chromium\.launch|launchPersistentContext|webkit\.launch|firefox\.launch|puppeteer\.launch|connectOverCDP")
def launches(path):
    try:
        # This entry point wraps both workers in their machine-wide lanes itself.
        if '--worker' not in cmd and os.path.realpath(path) == os.path.realpath(os.path.join(root, 'scripts/frame-floor.mjs')): return False
        with open(path, errors="ignore") as f: return bool(LAUNCH.search(f.read()))
    except OSError: return False
hits = []
# every `cd <dir>` seen so far moves where relative paths resolve
for seg in re.split(r"&&|\|\||;|\|", cmd):
    seg = seg.strip()
    m = re.match(r"cd\s+(\S+)", seg)
    if m:
        d = os.path.expanduser(m.group(1).strip("'\""))
        cwd = d if os.path.isabs(d) else os.path.join(cwd, d)
        continue
    for m in re.finditer(r"(?:^|\s)(?:node|tsx|bun)\s+(?:--[\w-]+(?:[= ]\S+)?\s+)*['\"]?([^\s'\"]+\.(?:mjs|cjs|js|ts))", seg):
        p = m.group(1); p = p if os.path.isabs(p) else os.path.join(cwd, p)
        if launches(p): hits.append(m.group(1))
    m = re.search(r"(?:^|\s)(?:pnpm|npm)\s+(?:run\s+)?([\w:.-]+)", seg)
    if m and m.group(1) not in ("exec", "add", "install", "i", "test", "vitest", "dlx"):
        try: scripts = json.load(open(os.path.join(root, "package.json"))).get("scripts", {})
        except Exception: scripts = {}
        body = scripts.get(m.group(1), "")
        for f in re.findall(r"[\w./-]+\.(?:mjs|cjs|js|ts|sh)", body):
            p = os.path.join(root, f)
            if launches(p): hits.append(f"pnpm {m.group(1)} ({f})")
            elif f.endswith(".sh"):
                try: sh = open(p).read()
                except OSError: sh = ""
                for g in re.findall(r"[\w./-]+\.(?:mjs|cjs|js)", sh):
                    if launches(os.path.join(root, g)): hits.append(f"pnpm {m.group(1)} ({g})")
    if re.search(r"(?:^|\s)(?:pnpm exec|npx|pnpm dlx)\s+playwright\s+test", seg): hits.append("playwright test")
print("\n".join(hits))
PY
)"
if [ -n "$launches" ]; then
  cat >&2 <<EOF
BLOCKED by .claude/hooks/guard-browser-lane.sh: this command opens a headless browser outside the lane:
$(printf '%s\n' "$launches" | sed 's/^/    /')

Headless game browsers share one machine-wide lane (at most ${BROWSER_LANES:-3} at once, every agent and repo — E312).
Wrap the command; it waits for a free slot, releases it when the command exits, and kills it after --max minutes
(default 60):

    scripts/browser-lane.sh [--max <min>] <your command>

e.g. scripts/browser-lane.sh node scripts/nalati-chunk-views.mjs --out …
Escape (rare, e.g. a non-game page that closes in seconds): SKIP_BROWSER_LANE=1.
EOF
  exit 2
fi
exit 0
