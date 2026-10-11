# SF82 BR-1: native stalker presets

`StalkerBrain` now owns the circling skirmish, pack-leader howl and ledge-pounce policies. Driftwood
keeps its existing crab constructor; Nalati keeps its existing howler and pouncer constructors. Each
constructor selects parameters for the same policy owner, with allocation-free perception adapters.
The real native bodies, pack, ledges, paths, shared RNG and encounter clocks remain host-owned.
No boss stage, reward, visual, collision recipe or deferred-spawn binding changes.

The new engine defining path is `@wildshard/engine/ai/stalker`; the old preset paths remain.
Native continuation shapes, parsed field order, atomic restore and callback/read order are preserved.
`think` admits a matching tagged observation; the three `decide*` ports reuse existing observations.
`advance` retains the native frame clock independently of manager perception and contact delivery.

## Proof

- Three 10,000-frame crab traces compare the independently captured shipping law, preset and direct
  parametric policy by SHA-256, including attack-token denial, damage and subordinate scattering.
- Nalati's authenticated page oracles compare 2,400 howl frames and 6,000 pounce frames, with the real
  canid body/pack/ledge inputs and every state, event, damage result and RNG state. Direct parametric
  trace hashes match; the existing malformed-restore and restored-suffix comparisons also pass.
- 22 focused tests in five policy/native-host files passed in 6.32 s; four trusted physics tests
  passed in 8.33 s. Root and layer strict plus root-config typed lint of every touched code file pass.
- A real Node Nalati physics recapture and second `--check` are byte-identical. Relative to the
  committed capture, only source inputs/revision/build change: 35 native actors, 2,694 solids,
  terrain, all placement rows, materials and owners remain exact. The new defining policy is fenced.
- All four native witness checkpoint payloads and recorded outcomes remain exact. Input-only witness
  manifest changes belong to the pusher and are excluded from this commit.

No full suite, browser or Simulator was run. The ratchet's one own downward rise is
`runtime/ledgePouncer.ts` shard-engine-imports 1 → 2 (existing AnimalSim plus the shared policy);
the coordinator's generated receipt is required. No generated debt or graph file is edited.

BR-1 group pack/hunt/herd and the wind diver remain open; authored stalker rows and the BR-2–BR-5
boss/adoption gates are later slices. DIR5's stage host and elite prelude remain sp-x6's ownership.
