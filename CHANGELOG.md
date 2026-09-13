# Changelog

All notable changes to uGit are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [0.1.5] - 2026-09-13

### Fixed
- **Windows build showed "localhost refused to connect" instead of the app.**
  The documented cross-compile command built the app in Tauri's *dev* mode
  (`generate_context!()` bakes in `dev: cfg!(not(feature = "custom-protocol"))`),
  so the exe tried to load the Vite dev server at `http://localhost:1420`
  instead of the frontend bundled into the binary. `npm run tauri build`
  (used for the Linux bundles) adds `--features tauri/custom-protocol`
  automatically; the raw `cargo build` cross-compile command documented for
  Windows did not. Fixed by adding that feature flag to the documented
  command — confirmed via the rebuilt exe embedding this build's actual
  hashed asset filenames (`index-*.js`/`.css`), which the previous build did
  not.

## [0.1.4] - 2026-09-13

### Fixed
- **Windows build failed to start with a missing `libunwind.dll` error.** The
  `x86_64-pc-windows-gnullvm` cross-compile target linked the `llvm-mingw`
  toolchain's unwind runtime dynamically by default, pulling in a DLL that
  Windows doesn't ship and that wasn't distributed alongside `ugit.exe`.
  Fixed by statically linking the CRT/unwind runtime
  (`-C target-feature=+crt-static`) — confirmed via the built exe's import
  table that the dependency is gone.

### Documentation
- The README's Windows section now explains that `WebView2Loader.dll` (built
  automatically next to `ugit.exe`) must be copied alongside it — this was
  always required (every WebView2 app needs it) but wasn't previously
  documented, leading to a confusing missing-DLL error on first run.

## [0.1.3] - 2026-09-13

### Fixed
- After a push succeeded via the SSH→HTTPS fallback (new in 0.1.2), the local
  `origin/<branch>` tracking ref didn't move — GitHub had the real commit,
  but uGit kept showing `origin/<branch>` behind. Pushing through a named
  remote updates the local tracking ref automatically (via its configured
  refspec); the fallback's anonymous remote has no such refspec, so it never
  did. Fixed by updating the tracking ref explicitly after a successful
  fallback push.

## [0.1.2] - 2026-09-13

### Fixed
- **SSH auth could hang the whole app for close to a minute.** The credentials
  callback kept re-offering the same already-failed method (e.g. an SSH agent
  with no loaded keys) every time libgit2 retried, instead of remembering
  what it had already tried. It now converges to a definitive failure in
  well under a second.
- Added explicit network timeouts (10s to connect, 30s per operation) as a
  safety net against any future stalled connection, regardless of cause.

### Added
- **Automatic HTTPS fallback for GitHub SSH remotes.** If a `github.com` SSH
  remote (e.g. one set up by GitKraken or another tool) fails, fetch/pull/push
  now transparently retry over HTTPS using your signed-in GitHub token —
  without ever modifying the repo's actual configured remote, so other tools
  reading the same repo are completely unaffected.
- **Reusable "Sign in to GitHub…" entry point** on the Open Repository screen
  (shown only when not already signed in). Fetch/Pull/Push failures that
  specifically need GitHub auth now open this same flow and automatically
  retry the action once you're signed in.
- A `LICENSE` (AGPLv3 with the Commons Clause — open source, but not for
  resale) and this changelog, both linked from the README.

## [0.1.1] - 2026-09-13

### Fixed
- A staged, genuinely empty new file showed a confusing "No changes" diff
  message. It now shows "Empty file added" (or "Empty file deleted"),
  distinguishing "nothing to diff" from "nothing happened."
- The "Create a brand-new remote" Help topic still described GitHub repo
  creation as unsupported, after it had actually been built — updated to
  describe the real **Create on GitHub…** flow.

### Added
- The Help panel footer now shows the running app version (read live via
  Tauri, so it can't drift out of sync) and a link to the GitHub repo.

## [0.1.0] - 2026-09-12

Initial usable release. uGit is a GitKraken-style desktop git client built
with Tauri (Rust + `git2`) and React, targeting Linux and Windows.

### Added
- Core git workflow: status, staging, commits, diffs, branch create/checkout/
  delete, stashing, and a colored commit-graph view with lane visualization.
- Merge and rebase support with real conflict detection, plus a genuine
  in-app 3-way merge tool (Local/Remote reference panes, an editable Result
  pane, collapsible unchanged sections for large files).
- Branch reset (soft/mixed/hard) to any earlier commit.
- Multiple repositories open at once as tabs, each with fully isolated state.
- Remote support: add remotes, fetch/pull/push with SSH-agent, SSH-key, and
  git credential-helper authentication.
- **GitHub integration**: Device Flow sign-in (no password ever touches
  uGit), creating a new GitHub repo and pushing to it in one step, and
  browsing/cloning your GitHub repos — token stored via the OS keychain
  (Windows Credential Manager / Linux Secret Service).
- Commit search (message, author, ref) with match count and Next/Prev
  navigation.
- Session memory: reopens the same tabs and active tab on relaunch,
  remembers the last folder browsed to, and restores window size/position.
- Built-in Help panel covering SSH multi-account setup, creating a local
  repo, and linking/creating remotes — with real buttons behind the last two,
  not just instructions.
- A dedicated app icon (previously the default Tauri template logo).
- Linux packaging (`.deb`, `.rpm`, `.AppImage`) and a cross-compiled Windows
  build (`x86_64-pc-windows-gnullvm`, from Linux).
