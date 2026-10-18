# Rigged hull resource rows and Pine sky glue

Pine retains its photoreal PBR look. The existing rigged-hull loader now
accepts rig, coat and supplemental-node rows rather than shard callbacks.
Pine and Nalati both use the same admitted tier-book API. Nalati retains
its atlas sampling, vertex-alpha AO, double-sided eagle wings and coat
cache identities; Pine retains its separate maps, bear flaps, fur colours
and thrall eyes/ferns. A missing declared resource or incompatible rig
refuses instead of silently substituting a procedural hull.

The landing deletes six whole modules:

- Pine `runtime/species/hulls.ts` and `runtime/species/rigs.ts`.
- Nalati `species/hulls.ts` and `species/rigs.ts`.
- Pine `look/skyBackdrop.ts` and `data/skyLook.ts`.

The data paths are each product's typed `look/rigged-hulls` section, Nalati's
authored `data/creatureRigs.json`, and Pine's `data/skyLook.json`.
The latter preserves both graph ids verbatim. Weather and the King query
the existing keyed-sky host directly. No material graph, placement,
collider, palette or artistic choice changes.

## Measurement and proof

The exact post-generation candidate is `a3439ec76`, on the tenth-batch
bootstrap/map landing. It passes root/layer types, typed lint, all ten
products and 32 focused tests across five files, including all 17
headless cases and both tiers' complete lossless Nalati coat-page
equality checks. Eight format/policy regressions also pass: 40 focused
cases across eight files in total.

Pine is 4,065 → 4,011 custom source lines (−54). Its disjoint C2 owner
is 347 → 342. The hull loader cut primarily belongs to the ruler's C4
and C9 attribution; it is not presented as a 54-line C2 reduction.
Nalati is 20,485 → 20,333 (−152): net −206 custom shard lines, with
every other shard unchanged. Platform source grows 85 lines (including
one package export row); generators grow 44. No budget rises or
pending-user tags are added: both products
admit the resource contract through the format schema, and both consume
it through the existing SDK hull host. Named private JSON is not used.
The awaited product import names only `loadFirstPartyProduct`; it does
not grant false second users to unrelated presentation/prop exports.

Baseline `be3924670` and final candidate `a3439ec76` are pixel-exact
on all 52 captured frames: Pine's two tiers at midday/night (40,
including eight creature supplements per phase), and Nalati's two
tiers (12). Draws, triangles, GPU bytes, programs, shader
sources and collider census also match. Sanitized hashes and metrics
are in [measurements.json](measurements.json).

The desktop comparison uses 120 live frames per pose on those served
revisions. Candidate spawn/cabin/pond p95 is 16.7/16.7/16.8 ms, versus
baseline 33.4/33.4/33.2 ms. Candidate work p95 is 10.6/11.1/9.5 ms,
versus 13.3/16.4/11.0 ms. Every candidate row passes the desktop floor;
CPU owner budgets pass, maximum frame is 16.8 ms and no context is lost.

Map publication follows G490: this is source intake, not a canonical
map refresh. sp-x10 owns the next cold bake and strict product closure.
The non-strict all-ten product check warns about the stale map stamps;
it is not claimed as a green strict build.

## Counted view code retained

- `runtime/looks/rainFx.ts`: camera-local streaks, lens drops, frame
  drawing and physics-sampled splashes. These are Pine presentation;
  the weather laws and material programs already arrive as data.
- `world/water.ts`: live water-weather and top-down bindings, the
  session-owned pond skyline, and borrowed ripple textures. Surface
  numbers and water graphs already use the existing hosts.
- `look/render.ts`: product admission and Debug-selected sky packing
  and environment size. It is a small view attachment, not a new host.
- `look/dayKeys.ts`: one renderer-free keyed-clock binding consumed by
  both the page and native assembly; named phases remain authored JSON.
- `species/looks.ts`: species/body variants and their page skin/pose
  attachment. Resource fetching and hull construction are now shared;
  the remaining view/body callbacks remain counted.
- The King's material/pose bindings, tree factory and undergrowth
  bindings remain with their C4/C1 owners. Their drawing and frame
  ownership are not moved into a speculative host to claim zero C2.
- Other C2 spans are individual material/sky attachments inside boot,
  combat, cave, roster and lifecycle modules. These modules also own
  their gameplay or assembly; a whole-module look deletion cannot
  remove those bindings independently of their existing owners.

C2 is still 342 counted lines; this landing does not claim zero.
CM1 stays open for Explorer-time specimen release. Its landed cabin
admission reduced actual backing by 66.223 MB, while the worst-case
estimate remains +140.8 MB because every specimen can still be admitted.
