# SF72: native player-driver seam

This is the generic port for Nalati's next mounted-player slice, not a whole-shard qualification.
An owned active host can install exactly one input/motion driver. Input precedes its one native physics step;
delegated motion follows it, with targeted combat, bodies, systems, health and fixed-post retained. False/no driver
keeps the original motion and continuation bytes. Runtime clocks and native handles remain explicit snapshot adapters.

Raw local directions preserve keyboard holds separately from stick strength. New held/raw fields require command
version 1 and validate before mutation. Both worker paths use one detached forwarder; ordinary page command sampling
is unchanged, while `sampleCommand(1)` explicitly records the raw source.

Proof: 14 focused controls/timing/native checks; eight new cases under coverage in 5.74 s. Root strict, root/touched
lint, ratchet and SF2 green. Actual existing witness recorders produce 15 byte-identical compressed checkpoints;
all four source freshness fences green. Pine/Driftwood outcomes unchanged apart from inputs. No physics geometry,
level recipe or presentation changed. The per-payload SHA table is `payload-equality.json`.

Final fresh clean-export suite: 1,101 files, 5,996 passed / 14 skipped, 116.52 s, from unreferenced proof
`cfdcaa646e9cef66d2adb2b20b18be15b9912416` (parent `adbfbe17be23639d451811b6104a9cb9a597c378`,
including the additive animal-pose leaf). Strict, root lint, ratchet, coupling, graph and all four freshness checks
also pass. SDK→engine +1 type-only sim edge approved by wildshard-new.
The actual Nalati mounted body/crouch, bosses, held-heavy sabre and final canonical witness remain open.
