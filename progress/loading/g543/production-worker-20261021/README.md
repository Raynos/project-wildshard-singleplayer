# Released worker cache policy

Production build `64d85dac0-mvi1u8vt` carries the tiny worker bootstrap.
The live `/sw.js` body is 95 bytes with `no-cache` and a strong ETag.
Origin absent and present return identical bytes and ETags, without
`Vary: Origin`; a conditional request with Origin returns 304 and no body.
The actual content-hashed core returns the immutable cache policy.
The build id was unchanged before and after the requests.

The same-length changed-core update test remains in
`../worker-bootstrap-63dc1e1/`; this read-only live check confirms the
released HTTP policy and does not upload or alter a production worker.
