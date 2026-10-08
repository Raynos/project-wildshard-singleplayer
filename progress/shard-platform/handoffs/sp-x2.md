# sp-x2 handoff — SF68 data pipeline, 2026-10-08

Active assigned Codex lane: SF68 / E462 data only; the coordinator owns pushes, the Opus lane owns the admin UI, and the coordinator creates the separate `wildshard-admin` Vercel project before any deployment. Never message wildshard-v.

**This source slice:** `scripts/admin-data.mjs` + `scripts/admin-data/`: pinned committed-tree collector, portable JSON schemas, typed bundle, semantic validators, source SHA-256 provenance, content-hashed media, playtest/plan Markdown extraction, explicit clean-export adapter and atomic output. `test/admin-data.test.ts` uses synthetic reports and a temporary Git repo, not progress-dependent Vercel fixtures. CLI / contract: `scripts/admin-data/README.md` and `types.d.mts`.

`node scripts/admin-data.mjs --rev=HEAD --out=NEW_DIR` produces bundle.json + schemas + media; no game build/browser/Simulator/live connection. The same pinned tree produces byte-identical JSON. Explicit `--snapshot-root=ARCHIVE --rev=FULL_SHA` is for deployment hosts without Git; its producer must guarantee clean-archive provenance and retain the report folders omitted from the game deploy. It never falls back to the shared working tree.

Real committed inventory at validation: 2 memory reports, 2 playtests (10 findings each), 251 G decisions, 106 SF rows, 95 unique media files. Loading is honestly unavailable. State percentages (53 / 70 / 99 / 88 / 47) stay separate from the dated effort table. Memory native WC+GL, raw allocator totals, storage capacities, legacy confidence and missing poses remain distinct. Original report/build provenance is preserved; overlapping memory reports are never additive.

**Open / exact next step:** Opus UI consumes the bundle and media mapping; coordinator wires the separate project/build/deploy. SF67 benchmark remains unbuilt: the approved `loading-benchmark/1` contract + validator + synthetic fixture are in scripts/admin-data and linked from sp-x5's handoff. Unknown/invalid reports fail build; unavailable loading stays a reason, never zero. No report output artifacts need committing; deployment rebuilds from committed sources.

**SF64 capture work remains open, separately:** fresh Driftwood/template/Sky/Signal centres and fully observed worst crossing. Follow `progress/memory/sf64-report/capture-plan.md`; Nine Dragon explicitly unavailable (not in grid catalogue). Original report APIs landed 6f5ca1ae4 / b7f559d5d / 4da5ae9c2; receipt 16c927650, protocol fa0238f05 / 46d696223. x1 owns attribution. Earlier audio cohort closed 5d6e1d41b + bb91db4b0, native saving ZERO.

**Resources:** no owned preview/browser/Simulator/Inspector/sampler or queued build/full suite. Scratch only `/private/tmp/claude-501/sp-builders/sp-x2/land-source.py` and SF68 landing specs worth keeping. Two byte-identical validation outputs are retained at `.../sf68-output-1/` and `.../sf68-output-2/` (pin 3f098fde5); automatic command review blocked recursive scratch cleanup. They are samples for the UI lane, never deployment inputs; source is the durable contract.

Plan-State: unchanged. This handoff records local landing, not a push/deploy claim.
