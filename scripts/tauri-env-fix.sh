#!/usr/bin/env bash
# When run from a snap-packaged VS Code terminal (or any snap app's shell),
# the environment carries GTK/GDK/GIO variables pointing into that snap's
# bundled runtime (e.g. GDK_PIXBUF_MODULE_FILE, GTK_PATH). A Tauri binary
# launched with those inherited loads mismatched GTK modules and crashes
# with something like:
#   symbol lookup error: .../libpthread.so.0: undefined symbol: __libc_pthread_init
# Stripping them before running `tauri` fixes it; unset is a no-op if unset.
exec env \
  -u GTK_PATH \
  -u GTK_EXE_PREFIX \
  -u GDK_PIXBUF_MODULE_FILE \
  -u GDK_PIXBUF_MODULEDIR \
  -u GIO_MODULE_DIR \
  -u GIO_EXTRA_MODULES \
  -u GSETTINGS_SCHEMA_DIR \
  -u LOCPATH \
  -u GTK_IM_MODULE_FILE \
  -u SNAP_LIBRARY_PATH \
  -u LD_LIBRARY_PATH \
  npx tauri "$@"
