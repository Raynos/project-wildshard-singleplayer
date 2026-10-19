# Shared enemy arena integration

This bounded developer candidate puts the four exact published WIP enemies into
one engine bundle, Game, canvas, physics world and TrainingArena. Bellback remains
unavailable pending its separate admission. No production game or existing exact
host has been modified.

## Gates

- Current SDK validates all four byte-identical retained products.
- Exact source/product/asset admission and tamper rejection: 3/3 tests.
- Existing encounter, damage parity, player loot, equipment and root-flinch tests:
  30/30 tests.
- Standard-config page lifecycle seam: 1/1 test, without module mocks; failure
  retry, serialized Start, selection change, Retry, Back/re-entry and teardown.
- Existing practice boot/isolation coverage: 5/5 tests.
- Strict TypeScript and focused runtime/Node-tool/test lint: clean, no exemptions.
- Predecessor build2 actual muted portrait cloud-browser probe: 28/28 checks,
  including real outgoing and incoming damage for all four enemies, one retained
  game/canvas across changes, fresh encounters, Retry, Back/re-entry, reload,
  empty persistent stores and Bellback unavailable. Its immutable report is
  `predecessor-build2-qa.json`.

A first build2 browser run completed green, but its wrapper re-entered the command
and overwrote its mutable report. Its printed result was retained; no overwritten
partial report is used as acceptance evidence. The QA now refuses reused output
directories and writes a separate immutable completion report. The complete
predecessor probe was repeated into a fresh directory after that correction.

- Final build3 actual browser probe: 28/28 checks, repeating the complete
  four-enemy/lifecycle/storage coverage after the controller seam and tooling
  relocation. Exact evidence: `build3-qa.json`; four portrait images alongside.
  `source-build-manifest.json` pins all 17 source/test/tool files and 283 build
  files. The final browser command completed; its wrapper attempted to re-enter,
  and the fresh-directory guard refused before starting another browser. The
  owned wrapper was then closed. Immutable evidence remained intact.

## Limits

The probes verify integration and basic actual combat, not every attack phase,
kill/reward cycle, animation-quality threshold, long soak, mobile Safari or
physical-phone performance. Existing candidate acceptance failures remain open.
Diagnostic player placement is recorded; actor health, clocks, AI and strike state
are never injected. Full-game persistence and world content remain uninstalled.

## Publication footprint

Build3: 9,911,245 bytes total; 6,328,954 bytes have exact SHA256 duplicates in the
existing Site; 3,582,291 bytes are new. `build3-asset-map.json` lists every file and
same-content existing path. These totals include three equivalent HTML aliases.
Publication is owned by the coordinator and has not been performed here. Do not
delete retained exact hosts or redirect to an untested mixture of engine chunks.

The runtime is already normally production-minified. Exact duplicate reuse alone
adds about 3.58 MB, exceeding the reported remaining Site allowance; publication
requires a coordinator-approved storage/hosting strategy. No untested engine
chunk substitution, retained-host deletion, or independent publication occurred.
