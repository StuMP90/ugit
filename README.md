# uGit

An interactive, GitKraken-style desktop git client built with Tauri (Rust + `git2`) and React.

## Development

```bash
npm install
npm run tauri dev
```

`npm run tauri` runs through `scripts/tauri-env-fix.sh`, which strips a few GTK/GDK environment
variables that a snap-packaged terminal (e.g. snap VS Code) leaks into the process. Without it,
the built binary can crash on launch with a `libpthread.so.0` symbol-lookup error. This is only
needed in that kind of terminal — it's a harmless no-op everywhere else.

## Building for Linux

```bash
npm run tauri build
```

This produces three package formats under `src-tauri/target/release/bundle/`:

| Format     | Path                                                             |
|------------|-------------------------------------------------------------------|
| `.deb`     | `deb/uGit_<version>_amd64.deb`                                     |
| `.rpm`     | `rpm/uGit-<version>-1.x86_64.rpm`                                  |
| `.AppImage`| `appimage/uGit_<version>_amd64.AppImage`                           |

The internal package name is `u-git` (Tauri normalizes `uGit` for package-manager naming rules).

### Installing on Linux

Pick whichever matches your distro:

```bash
# Debian / Ubuntu
sudo apt install ./uGit_<version>_amd64.deb

# Fedora / RHEL and derivatives
sudo dnf install ./uGit-<version>-1.x86_64.rpm

# Any distro — portable, no installation
chmod +x uGit_<version>_amd64.AppImage
./uGit_<version>_amd64.AppImage
```

Using `apt`/`dnf` to install the local file (rather than raw `dpkg -i`/`rpm -i`) gets you proper
dependency resolution and cleaner upgrades.

### Updating on Linux

Build a new bundle (bump the version in `src-tauri/tauri.conf.json` and `package.json` first) and
install it the same way:

```bash
# deb
sudo apt install ./uGit_<new-version>_amd64.deb

# rpm
sudo dnf install ./uGit-<new-version>-1.x86_64.rpm
```

Both package managers detect the existing `u-git` package and upgrade it in place — no need to
uninstall first.

For the **AppImage**, there's no package manager involved: just replace the old file with the
newly built one (same filename or not — it's just a standalone executable).

### Uninstalling on Linux

```bash
sudo apt remove u-git      # deb
sudo dnf remove u-git      # rpm
rm uGit_<version>_amd64.AppImage   # AppImage — just delete the file
```

## Building for Windows (cross-compiled from Linux)

uGit can be cross-compiled for Windows from this Linux machine, but it needs some one-time setup
beyond plain `rustup`, because the default `x86_64-pc-windows-gnu` target's linker (GNU `ld`) hits
a hard PE/COFF format limit (65535 exported symbols max) on a dependency tree this size.
`x86_64-pc-windows-gnullvm`, which links with LLVM's `lld` instead, does not have that problem.

One-time setup:

```bash
rustup target add x86_64-pc-windows-gnullvm
```

Download the [llvm-mingw](https://github.com/mstorsjo/llvm-mingw) toolchain (UCRT build, matches
`gnullvm`) and extract it somewhere reusable, e.g. `~/toolchains/`:

```bash
curl -sL -o llvm-mingw.tar.xz \
  https://github.com/mstorsjo/llvm-mingw/releases/latest/download/llvm-mingw-<version>-ucrt-ubuntu-22.04-x86_64.tar.xz
mkdir -p ~/toolchains
tar -xf llvm-mingw.tar.xz -C ~/toolchains/
```

`src-tauri/.cargo/config.toml` already points the `x86_64-pc-windows-gnullvm` target at that
toolchain's linker/ar — update the path there if you extract it somewhere other than
`~/toolchains/llvm-mingw-*-ucrt-ubuntu-22.04-x86_64/`. This config only applies to that one
target triple; it has no effect on the normal Linux build.

Then build:

```bash
cd src-tauri
TC=~/toolchains/llvm-mingw-*-ucrt-ubuntu-22.04-x86_64
PATH="$TC/bin:$PATH" cargo build --release --target x86_64-pc-windows-gnullvm --bin ugit
```

Output: `src-tauri/target/x86_64-pc-windows-gnullvm/release/ugit.exe` — a standalone,
self-contained executable (no installer is produced by this path; see below).

Note: the library crate's `crate-type` in `src-tauri/Cargo.toml` was trimmed to
`["staticlib", "rlib"]` (dropping `"cdylib"`) to make this possible — `cdylib` is only needed for
Tauri mobile (Android/iOS) targets, which this project doesn't use, and Windows' PE export table
can't hold the symbol count a `cdylib` build of this dependency tree produces.

### Installing / updating on Windows

There's currently no installer (`.msi`/NSIS) — just the portable `ugit.exe` above. "Installing" is
copying it wherever you like; "updating" is replacing it with a newly built one. No registry
entries, shortcuts, or uninstaller are created.

**Requires Windows 11** (or an updated Windows 10) — uGit needs the Microsoft Edge WebView2
runtime to render its UI, which ships preinstalled on those. Building a proper installer that can
bootstrap WebView2 automatically for older systems is possible later via Tauri's
`bundle.windows.webviewInstallMode` config, but needs the build to run through Tauri's own bundler
with Windows-native tooling (WiX or NSIS) — not attempted yet from this Linux setup.

The produced `.exe` has not been run on an actual Windows machine — cross-compiling only verifies
it builds and links correctly, not that it behaves correctly at runtime.
