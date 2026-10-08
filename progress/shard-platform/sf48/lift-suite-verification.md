# Lift proof full-suite verification (E435, SF8c)

The clean export started at `0f07e0b10e1f1d2282d721309e8a2b60f951a916`, with only the two lift proof fixtures and then the repository CLI fixture overlaid from the source changes. Workspace packages were linked with `scripts/link-node-modules.mjs`; `pnpm gen` preceded `pnpm exec vitest run`. No browser, Simulator or full Vercel gate participated.

- `dbda69cae`: inspect `ScriptHost.failureCount` instead of copying both WASM memories into a checkpoint on every native physics tick. Disabled modules already imply a positive failure count. All ride, call, gate, return and collision assertions remain.
- `311490edb`: retain the first actual cold CLI subprocess build, then reuse the CLI's cached tooling bundle for the deterministic second build and all validations. Seven tooling bundles become two; both builds, the 60-tick/92-lane proof and all four obstruction/water refusals remain. The existing 120-second test timeout is unchanged.

The first full suite took 148.78 seconds: 759 files, 4,659 passing tests, 14 skipped, three failures. The lift fixtures passed; the CLI wrapper exceeded 120 seconds. After the CLI fix the full suite took 80.61 seconds: 759 files, 4,660 passing tests, 14 skipped, two failures, no timeout. Every lift fixture and the CLI proof passed.

The two remaining failures were outside these changes: the export's pending approved graph regeneration (`game → engine` 685 → 696), and its old Pine manifest lazy-loader contract. Both were sent to the coordinator; this is not a claim that the whole export was green. The coordinator owns regeneration and the serialized push.
