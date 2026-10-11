# Client proofs inside an isolated author seat (OS-G7)

The seat keeps its read-deny sandbox and API-only network proxy. A maintainer owns one
muted iPhone 16 Pro browser outside that sandbox; the author controls that browser
through a POSIX file pipe. The seat receives no CDP address, network permission,
checkout source, credentials or arbitrary JavaScript evaluator.

## Prepare the driver (maintainer)

Use the seat's version-matched installed SDK and its exact built product. Copy
`scripts/oneshot/{seat-browser,browser-channel}.{mjs,d.mts}` into a read-only `tools/browser/`
inside the seat before sandbox entry. Keep the relay directory writable and separate
from those tools and packages. Do not alter the original read/network denial profile.
The relay path must be fresh, and both the product and relay must belong to this seat.

From the repository, outside the sandbox:

```sh
scripts/browser-lane.sh --max 20 node scripts/oneshot/browser-broker.mjs \
  /absolute/seat /absolute/seat/project/dist /absolute/seat/browser-channel seat-client-proof
```

Wait for `Browser relay ready:` before starting the seat. The driver serves only regular
files beneath the built product, enters its normal loaded card and waits for real
native ticks and rendered frames. It uses the installed SDK's two read-only proof
callbacks, not observations supplied by an author. Browser HTTP requests are limited
to that product origin; other origins, WebSockets, downloads and service workers are
blocked. The author sandbox still refuses even direct requests to the product origin.

The parent checks `.git/quiet`; the browser lease closes its own process group at the
deadline. A normal `close` request or signal closes the owned browser and static server.
No Simulator is used, and this driver makes no cadence or phone-memory claim.

## Use the driver (author, inside the sandbox)

These are the permitted operations; no URL or host-command operation exists:

```sh
node tools/browser/seat-browser.mjs /absolute/seat/browser-channel text
node tools/browser/seat-browser.mjs /absolute/seat/browser-channel scene
node tools/browser/seat-browser.mjs /absolute/seat/browser-channel equipment
node tools/browser/seat-browser.mjs /absolute/seat/browser-channel key ArrowUp 500
```

Keys are bounded to movement, Enter, Space and `e`, with at most 10 seconds held per
request. They reach the actual browser keyboard and ordinary game clock. Text and
evidence are reads, never gameplay grants. Requests are atomic and bounded to 4 KiB;
replies are bounded to 2 MiB and delivered only to verified reply FIFOs.

For an executing proof, bundle your retained entry using the
[installed-pack recipe](../../scripts/docs/standalone-author.md). In that entry,
`seatProofPage(channel)` from `tools/browser/seat-browser.mjs` is the real
`AuthorProofPage` argument to `proveSceneClient`, `proveEquippedItemClient` or
`proveMesaOutpost`. Supply the actual product, asset bytes and authored route as usual.
The SDK validates actual client evidence; it still refuses hidden, unbound,
wrong-asset or native-mismatched views. Importing a proof function alone is not a pass.
The portable declaration imports only the installed SDK, with no checkout type path.

Finish explicitly:

```sh
node tools/browser/seat-browser.mjs /absolute/seat/browser-channel close
```

## Maintainer milestone

```sh
scripts/browser-lane.sh --max 10 node scripts/test-oneshot-browser.mjs \
  /absolute/seat /absolute/seat/project/dist /absolute/original-isolation.sb
```

This retained Mesa fixture proof checks real client views and equipped commons spear
through SDK calls executed inside the original sandbox. It also checks denied checkout
reads, direct Internet and loopback network attempts, a forbidden renderer request,
arbitrary page evaluation, real key delivery and owned-browser cleanup. The product
must already be a built Mesa fixture with the admitted body/head creature contract.
It restores its own temporary network-test image injection in `finally`. This is a
driver milestone; it does not retroactively turn either earlier one-shot run into a pass.
