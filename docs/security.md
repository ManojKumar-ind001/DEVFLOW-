# DevFlow Security Boundary

Archive handling must reject traversal paths, absolute paths, unsafe links, device entries, excessive nesting, excessive file counts, oversized entries, oversized total extraction, and suspicious compression ratios.

Extraction happens in a per-job directory. Archive-provided symlinks are disabled. Every output path is normalized and checked against the resolved extraction root before any write. Temporary directories are removed after success, failure, or timeout.

The initial product performs static inspection only. It does not execute uploaded source code, binaries, package scripts, or arbitrary commands.
