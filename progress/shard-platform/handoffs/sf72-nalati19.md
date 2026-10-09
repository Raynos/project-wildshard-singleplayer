# Handoff (sf72-nalati19) — shipping native mounted body

Coordinator alone pushes. Plan-State: unchanged. Nalati whole-shard compatibility remains fail-closed.

The renderer-free MountedBody in runtime/rideBody.ts owns the shipping lying PLAYER capsule's physical law and explicit world/rider/contact ports. Page ride/Mount.ts delegates step/settle/land/jostle/feet projection only; camera, HUD, taming, equipment and input timing are unchanged. All scalar history and queued reins clocks have strict atomic version-1 restore. Native motor state is separate, caller-owned continuation.

The independent frozen original Mount source and adapted physical oracle live at test/fixtures/nalati-motor-oracle/. Nine tests compare every native tick on flat, rail/deck/ditch/swimming courses, contact throw, invalid-history refusal and a 300-tick restored lying-motor suffix. Longest tape 1800 ticks; coverage 2.93 s total against a 20 s per-case timeout. Strict, touched lint, SF2, ratchet/runtime guards green. No own full suite under the new speed policy.

Actual browser physics rebake on accf09fb4 NPC parent; every gameplay field stays byte-identical, source provenance changes. Physics inputs include rideBody. No own map input changes or generated-output edits. Nalati→engine +3 downward pre-approved; no raw reach/SF2 rise.

NEXT exact step: trusted native mounted adapter through usePlayerDriver with command v1 raw controls. Keep the ordinary standing player motor disabled while riding and allocate the lying motor separately (never put it in the horse.motor body-LOD slot). Save all body/reins state plus strict CharacterMotor.snapshot; physicsRestored reconnects the saved lying collider in host.physics, no duplicate allocation. The motor disposer reads the current motor after replacement, with explicit ownership. Model-free AnimalPoseLaw supplies the actual horse stride phase before reins read it; snapshot its phase history. Expose real trusted mount/dismount interaction, preserve herd.ridden and actor.driven. Then crouch, bosses, sabre and committed qualifying witness.

Scratch /private/tmp/claude-501/sp-builders/sp-x1/nalati19; candidate source and helper logs. extract.py/refine.py are one-time builders, do not rerun over extracted files. No owned browser/Simulator once reported. The temporary bake preview is stopped before landing. Current-HEAD private index, guards/hooks, old-value CAS, exact own paths and subject/stat/ancestor check. NPC/model paths released by x2; preserve foreign audio/look/cost work.
