# Scene interaction and view proofs

Author commands may contain `{kind: "interact", id: "beacon"}`. The data-only native worker looks up that declared
`targets.interactions` row and uses the same prompt picker as the page: actual eye position 1.68 m above the feet,
strict distance, native world LOS, and stable page registration order for equally near targets. A farther or occluded
prompt does not queue its scene; an unknown identity refuses the tick. Scenes still use their admitted AssemblyScript
hook. Trusted-runtime witnesses retain their own interaction owner and refuse this data-only command.

Use the command in `HeadlessSimulation.step` and author proof tapes. Prove negative routes as well as the successful
beacon route. Numeric script events remain the lower-level script ABI; they are not evidence that a prompt was reachable.

For views, enter your built author client and call `proveSceneClient(page, {creatures, selectedInteraction})` from
`@wildshard/sdk/headless`; a Playwright Page supplies the browser port. The function invokes the fixed client's read-only
scene evidence, rather than accepting author-supplied counts. Every named creature must have a real native/view pair,
a simulation-bound skin, visible scene attachment, triangle geometry, bones, finite pose matrices and the native body
as its live position authority. At least one native tick and one actual renderer frame must have occurred. A spawn declaration,
detached mesh, invisible material, empty geometry or missing skin cannot pass. The selected scene prompt is sampled
from the actual page camera against all live competing prompts using the shipping picker.

`visibleCreaturesExample` is the retained primitive-view fixture for this functional proof. It proves view ownership
and rendering inputs; it makes no claim about art quality, screenshots or the species' final graphical look. Choose
an in-game pose where the required creatures are visible. The helper never moves the player, installs a fake view,
changes collision or dispatches an interaction on your behalf. Browser captures use the repository browser lane and
respect quiet windows; the helper accepts an existing browser and owns no browser lifetime.
