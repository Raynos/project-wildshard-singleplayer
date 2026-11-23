# Mark singleplayer release and telemetry probes

> Written by: Codex
> **State:** METRICS MT3, 2026-11-19.

Keep Wildshard requests from the release and records probes marked.
The release browser keeps its phone UA and avoids a global header.

Use repo-kit's Fetch-only portable helper. The release harness does
not replace the socket transport.
