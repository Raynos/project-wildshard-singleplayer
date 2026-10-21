# Native worker HTTP revalidation

A standalone HTTP probe, through sim-lane on iPhone 16 Pro Simulator Safari.
This tests the browser mechanism, not a game first-frame or memory limit.
Every worker response has the same no-cache freshness policy and an ETag.

| Registration mode | Unchanged same process | Unchanged after restart | Changed body |
|---|---|---|---|
| imports (default) | 200 / 148 bytes | 200 / 148 bytes | 200 / 169 bytes |
| all | 304 / 0 bytes | 304 / 0 bytes | 200 / 169 bytes |

Default imports sends max-age=0 without If-None-Match. All sends the ETag;
the changed response's new ETag differs and its complete body is fetched.
The compact receipt retains only relevant request headers, never cookies.
The tested original probe hash is recorded. Its maintained reproduction is
scripts/loading-benchmark/worker-revalidation-safari.mjs (requires sim-lane
and --out=receipt.json); strict lint and the real preview HTTP-policy test
pass. Production registration changes in 8e3d697c79; its full served warm
proof remains separate from this browser-only diagnostic.
