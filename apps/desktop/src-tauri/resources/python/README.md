# Bundled Python (WebAssembly)

`scripts/build-python-wasi.sh` puts `python.wasm` and `lib/python3.12/` here. They are not in git.

Without them the app still builds and runs, but Python solutions run on the computer's own
`python3` instead of the sandboxed WebAssembly build.
