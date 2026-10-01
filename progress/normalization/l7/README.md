# E357 L7 — sol-x3b

J3/B69: final nonrecursive grouping try folds third-party dependencies (including Rapier and postprocessing)
into engine while keeping main.ts outside it. Static check passed, then all seven slugs on phone and desktop
failed with `Export runtime_exports is not defined in module`. Grouping stays disabled. See group-failure.json.

L7.2 follows the lead's revised invariant: no shard runtime code in the cold startup graph, no mixed shard
owners within a lazy chunk, and no static or dynamic chunk import from one shard to another. Multiple lazy
chunks per shard are allowed. The Vercel export gate and deploy Test enforce this; planted cross-shard import
fixtures must fail.


The iOS 26.5 before run cut the engine chunk once and never saw a retry or world boot by 120 s.
The composition root now retries its game/kit/engine and boot-runtime downloads too. Update.ts uses a
page-lifetime Scope and the same hudSlots widget call so App/Three no longer enter the pre-entry graph.
The chunk gate also refuses App or Three on that static graph; a planted regression test proves it.
The iOS selector uses physical module ownership: an ungrouped chunk called three may belong to navcat.

Corrected selector proof: iOS 26.5 also cuts actual Three core once and never requests it again despite the two callback retries. It shows "Importing a module script failed". See ios-after-failed.json. The entry comment claiming WebKit refetches the same failed URL is disproven on this runtime. SW-controlled body buffering and network retries are a separate follow-up; the direct-import probe deliberately uses sw=0. RotateGate also uses a dependency-light page Scope.
