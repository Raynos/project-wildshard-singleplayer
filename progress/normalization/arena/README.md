# E357 — practice custom weapons and G25 sun dressing

Engine runtime candidate: `3620e0a8` (`acf9c6aa` + isolated resident target sources), on `refs/sol-arena/candidate`.
No shard content was edited. The lead lands private candidates and pushes them.

The fan selected only `rt.play.animals.animals`; the whip correctly raycast a dummy but its creature-only resolver
rejected it. Training dummies had the legacy `TargetAnimal` contact path, with no combat Actor. The engine now
registers scoped `CombatTarget` ports: `app.combat.targets()` switches from creatures to the open arena's dummies;
`app.combat.target(hit.animal)` resolves a ray contact to the same port. Ports expose Actor, position, hittable,
hurt and optional impulse. Dummy Actors forward pipeline damage to the existing armour, numbers and reactions.
Opus owns the two weapon callback adapters. Engine queries cannot select a dummy for a custom weapon that uses a
private creature array rather than the query.

`sun.disc:false` now hides the mesh, avoiding three.js's geometry upload before its material visibility check.
`halo:false` hides the sprite. A halo-only sky keeps an independent sprite on the camera-relative sun position;
the default sun hierarchy is unchanged. The unit leak regression checks that a disabled sphere cannot enter
three's visible-node traversal; actual GPU unload checks are included in the capture runner.

Verified on a clean export of `3620e0a8`: whole-tree typecheck and oxlint; all 360 Vitest files / 2,463 tests.
A minimal custom `extends Weapon` test hits all three real TrainingTarget variants, checks armour-adjusted numbers,
motion and stagger, repeated hits, damage events, ray resolution, room isolation, and disposal.
The original four phone fingerprint + pose comparisons are green, with empty `boot.errors`; see `checks.json`.
The earlier all-seven boot also had no errors; its combined comparison was red only because the template's old
baseline has no poses (the two new shards are lane-pending).

## Queued captures (after Opus switches both callbacks)

```sh
node progress/normalization/arena/capture.mjs <lead-commit-sha>
```

This builds a clean export, retains its preview lease, uses the browser lane through `browserPool`, and closes
all contexts, browsers and the preview. It drives real touch taps and holds at 390×844, aims at each of the wood,
straw/cloth and wood/steel figures, and fails any attack without a dummy hit and visible damage numbers. It writes
12 JPEGs (fan/whip × three materials × light/heavy), `hits.json`, and `fan-leak.json` / `whip-leak.json`. Both unloads
must report zero geometry leaks and no disposal errors. Inspect every JPEG before claiming visual verification.

Captures remain pending the two Opus callback adapters; no successful fan/whip screenshot is claimed yet.
