# Graph Draw Cost

**Status:** `unread` (sent 2026-10-15). Why a shader-graph (SF59) material costs 4–5× the CPU per draw of the old hand-written shaders (the engine's per-draw hook, ~25 node updates, a uniform buffer rewritten and rebound every draw, a program-switch cliff), the measured numbers, and the fixes for the engine pass (G436, G437, NEXT row N3).
**Link:** https://claude.ai/artifact/G8PGcag4zvnmraSBjDnXMc
**Plan:** SHARD-PLATFORM (G436, G437) and SHARD-PLATFORM-NEXT N3; source `progress/shard-platform/graph-draw-cost-2026-10-15/` (`63d3b0c9a`)
**Made by:** graph-cost research (Opus) measured it; the plan-status agent (`wildshard-v`) made the page
