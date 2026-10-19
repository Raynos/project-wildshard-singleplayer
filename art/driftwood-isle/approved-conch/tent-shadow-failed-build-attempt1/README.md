# Preserved first build adapter

The first bounded build failed before output: generated TypeScript virtual modules lacked the .ts suffix and were parsed as JavaScript. These are the exact failed adapter and review bytes. Attempt2 fixes only virtual module type handling and uses fresh output/pin paths; original fixtures are retained in the adjacent tent-shadow-diagnostic directory. This is failed build evidence, not a rendering result.
