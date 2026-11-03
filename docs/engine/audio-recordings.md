# Shared audio recordings

An own SFX catalogue loop may reference another shipped catalogue's recording
with `file: { set, file }`. `cueFile` admits one hop to a literal filename
already declared by that catalogue and present in the shipped byte table;
missing catalogues/files, nested references and path traversal refuse. The
native counted file list, eager decode and lazy bed reader resolve the same
canonical URL. References reuse the source bytes; loop bounds and gains stay
explicit in the consuming row.

