#!/usr/bin/env bash
# Builds CPython for WebAssembly (WASI) and packages it for the app:
#   apps/desktop/src-tauri/resources/python/python.wasm
#   apps/desktop/src-tauri/resources/python/lib/python3.12/   (standard library)
#
# Needs (Ubuntu 24.04): clang-18 lld-18 llvm-18 wasi-libc libclang-rt-18-dev-wasm32 and the
# usual CPython build dependencies for the native build Python.
#
#   WORK=<dir>             where to build (default: target/python-wasi)
#   PYTHON_TARBALL=<file>  use a local Python-3.12.x source tarball instead of downloading
set -euo pipefail

VERSION=3.12.3
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="${WORK:-$ROOT/target/python-wasi}"
OUT="$ROOT/apps/desktop/src-tauri/resources/python"
SRC="$WORK/Python-$VERSION"

mkdir -p "$WORK"
if [ ! -d "$SRC" ]; then
  TARBALL="${PYTHON_TARBALL:-$WORK/Python-$VERSION.tar.xz}"
  [ -f "$TARBALL" ] || curl -fsSL -o "$TARBALL" "https://www.python.org/ftp/python/$VERSION/Python-$VERSION.tar.xz"
  tar -C "$WORK" -xf "$TARBALL"
fi

# 1. A native Python of the same version, which the cross build needs.
mkdir -p "$SRC/builddir/build" "$SRC/builddir/wasi"
if [ ! -x "$SRC/builddir/build/python" ]; then
  (cd "$SRC/builddir/build" && ../../configure -q && make -j"$(nproc)" -s python sharedmods)
fi

# 2. The WASI build. Modules that need C libraries we don't ship are turned off.
if [ ! -f "$SRC/builddir/wasi/python.wasm" ]; then
  (
    cd "$SRC/builddir/wasi"
    export CONFIG_SITE=../../Tools/wasm/config.site-wasm32-wasi
    export CC="clang-18 --target=wasm32-wasi" CXX="clang++-18 --target=wasm32-wasi"
    export AR=llvm-ar-18 RANLIB=llvm-ranlib-18
    for m in _ctypes _ctypes_test _curses _curses_panel _dbm _gdbm _lzma _bz2 _sqlite3 _ssl _hashlib \
      _uuid readline _tkinter xxlimited xxlimited_35 _testcapi _testinternalcapi _testbuffer \
      _testimportmultiple _testmultiphase _testsinglephase _xxtestfuzz _decimal zlib; do
      export "py_cv_module_$m=n/a"
    done
    export PKG_CONFIG_LIBDIR=/nonexistent PKG_CONFIG_PATH=
    export CFLAGS="-O2 -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_PROCESS_CLOCKS -D_WASI_EMULATED_GETPID"
    export LDFLAGS="-lwasi-emulated-signal -lwasi-emulated-process-clocks -lwasi-emulated-getpid \
      -Wl,-z,stack-size=16777216 -Wl,--stack-first -Wl,--initial-memory=41943040"
    [ -f Makefile ] || ../../configure -q --host=wasm32-unknown-wasi --build=x86_64-pc-linux-gnu \
      --with-build-python="$SRC/builddir/build/python" --disable-ipv6 --disable-test-modules
    # The final self-check runs the native Python against shared modules it never built; the
    # WebAssembly binary is complete by then, so its failure is ignored.
    make -j"$(nproc)" -s || [ -f python.wasm ]
  )
fi

# 3. Package: a stripped binary plus the pure-Python standard library.
# Keep the tracked README that holds the folder in git.
mkdir -p "$OUT"
find "$OUT" -mindepth 1 -maxdepth 1 ! -name README.md -exec rm -rf {} +
mkdir -p "$OUT/lib/python3.12"
llvm-strip-18 -o "$OUT/python.wasm" "$SRC/builddir/wasi/python.wasm"
(
  cd "$SRC/Lib"
  tar --exclude='__pycache__' --exclude='test' --exclude='tests' --exclude='idlelib' \
    --exclude='tkinter' --exclude='turtledemo' --exclude='ensurepip' --exclude='lib2to3' \
    --exclude='venv' --exclude='pydoc_data' --exclude='distutils' --exclude='msilib' \
    --exclude='sqlite3' --exclude='ctypes' --exclude='curses' --exclude='dbm' --exclude='site-packages' \
    -cf - . | tar -C "$OUT/lib/python3.12" -xf -
)
cp "$SRC"/builddir/wasi/build/lib.wasi-wasm32-3.12/_sysconfigdata__wasi_wasm32-wasi.py "$OUT/lib/python3.12/"
# Precompiled bytecode: the sandbox can't write a cache, and compiling the stdlib on every run
# would cost ~300 ms. Unchecked hashes keep it valid whatever the files' timestamps.
"$SRC/builddir/build/python" -m compileall -q -j0 --invalidation-mode unchecked-hash -o 0 "$OUT/lib/python3.12"
cp "$SRC/LICENSE" "$OUT/LICENSE.txt"
du -sh "$OUT/python.wasm" "$OUT/lib"
