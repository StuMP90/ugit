# Microsoft Store listing

Text and answers for the uGit submission in Partner Center, ready to paste in. Limits in brackets
are Partner Center's. Screenshots are in [`screenshots/`](screenshots/); the Store tile/icon set
is uGit's own generated icons at [`../../src-tauri/icons/`](../../src-tauri/icons/) (see README →
Packaging).

## Product identity

| Field | Value |
|---|---|
| Product name | uGit |
| Developed by / publisher display name | Stuart Millington (must match Partner Center) |
| Category | Developer tools |
| Pricing | Free, no in-app purchases, no ads |
| Markets | All |
| Package | `uGit_<version>_x64.msix` from the release workflow, built with the Partner Center identity values (README → Packaging) |
| Minimum OS | Windows 10 version 1809 (build 17763) or later, x64 |

## Links

| Field | Value |
|---|---|
| Privacy policy URL | <https://github.com/StuMP90/ugit/blob/main/PRIVACY.md> |
| Website | <https://github.com/StuMP90/ugit> |
| Support contact | <https://github.com/StuMP90/ugit/issues> |

The privacy policy is needed because the app signs in to GitHub and stores a token in the OS
credential store. It must be live at that URL, so push `PRIVACY.md` to `main` before submitting.

## Short description [1,000 characters]

> uGit is a free, visual git client for everyday workflows — browsing history, staging and
> committing, branching and merging, resolving conflicts with a real 3-way merge tool, tagging
> releases, and working with GitHub — all without leaving the GUI or dropping to a shell.

## Description [10,000 characters]

> uGit is a free, interactive desktop git client for everyday git workflows: browsing history,
> staging and committing, branching, merging, and resolving conflicts, all from a GUI.
>
> **HISTORY AND COMMITS**
>
> A colored, lane-based commit graph across all branches, in the style of `git log --graph`.
> Click any commit to see its changed files and diffs. Search by message, author, or branch/tag
> ref, with a live match count and Next/Prev navigation.
>
> **BRANCHING, MERGING AND REBASING**
>
> Create, check out and delete local and remote branches, with ahead/behind indicators against
> upstream. Real merge and rebase support with conflict detection, plus a genuine in-app 3-way
> merge tool: Local and Remote reference panes on top, an editable Result pane below. Resolved
> conflicts stay clearly marked and editable, and long unchanged stretches of a file collapse out
> of the way automatically. Soft/mixed/hard reset the current branch to any earlier commit.
>
> **STAGING, STASHING AND TAGS**
>
> Stage or unstage individual files or everything at once, discard working changes, and view
> line-by-line diffs. Save, apply, pop and drop stashes. Create annotated or lightweight tags,
> push them to a remote immediately or later with one click, and delete them locally — everything
> a release needs, without dropping to a shell.
>
> **GITHUB INTEGRATION**
>
> Sign in via GitHub's own Device Flow — no password ever touches uGit, and the token is stored
> in the OS credential store. Create a new GitHub repo and push to it in one step, and
> browse/clone your GitHub repos from the Open Repository screen. Turn an existing tag into a
> GitHub Release (title, notes, draft/pre-release) in one step — a tag that already has a release
> shows a link to view it instead of a duplicate "create" button.
>
> **REMOTES AND AUTHENTICATION**
>
> Add remotes, and fetch/pull/push with SSH-agent, `~/.ssh` key, and git credential-helper
> authentication, tried in that order. If an SSH remote fails, uGit automatically retries over
> HTTPS using a signed-in GitHub account. Generate a new Ed25519 SSH keypair or point uGit at an
> existing key, right from the Help panel — only the public key ever leaves the app. A Test
> Connection button checks SSH auth independently of anything OAuth-related.
>
> **BUILT FOR REAL WORKFLOWS**
>
> Multiple repositories at once as tabs, each keeping its own in-progress work; a background tab
> silently refreshes itself if it's been more than 15 minutes. Reopens the same tabs, folder
> history and window position you had last time. A built-in Help panel covers SSH setup and
> linking repos to remotes with real buttons, not just instructions.
>
> uGit's source is available on GitHub, licensed under AGPLv3 with the Commons Clause (free to
> use, modify and self-host; not for resale as a hosted product).

## What's new in this version [1,500 characters]

For the first submission:

> First Microsoft Store release.

## Product features [up to 20, 200 characters each]

1. Colored, lane-based commit graph across all branches, with search by message, author or ref
2. Stage, unstage, diff and commit, with discard for working changes
3. Create, check out and delete local and remote branches with ahead/behind indicators
4. Real merge and rebase with conflict detection and an in-app 3-way merge tool
5. Soft, mixed and hard reset to any earlier commit
6. Annotated and lightweight tags, pushed with one click
7. Turn tags into GitHub Releases, with title, notes, draft and pre-release
8. Sign in to GitHub with Device Flow — no password ever touches the app
9. Create a GitHub repo and push to it in one step
10. SSH, HTTPS and credential-helper authentication, with automatic HTTPS fallback
11. Generate or select an SSH key right from the app
12. Save, apply, pop and drop stashes
13. Multiple repositories open at once as tabs, each with its own in-progress state
14. Background tabs auto-refresh after 15 minutes
15. Remembers your open tabs, folders and window position between sessions

## Search terms [up to 7, 30 characters each, 21 words in total]

1. git client
2. git gui
3. version control
4. github
5. merge conflict
6. commit graph
7. git tags

That's 13 words.

## Copyright and trademark info [200 characters]

> © 2026 Stuart Millington. Source-available under AGPLv3 with the Commons Clause (no resale as a
> hosted product); see LICENSE.

## Additional licence terms

Leave this empty to use the standard Microsoft application licence terms. uGit's own licence
(AGPLv3 + Commons Clause) ships inside the package as `LICENSE`.

## Screenshots [up to 10; PNG; 1366×768 or larger; captions 200 characters]

All are 1600×1000. They show a small example project with made-up names (Jane Doe,
"Example Notes", example.com) and no real credentials — the GitHub remote shown is a placeholder
URL that was never actually contacted.

| File | Caption |
|---|---|
| `01-overview.png` | Browse history with a lane-based commit graph, branches, tags, remotes and stashes |
| `02-create-tag.png` | Tag a release and push it in one step, without dropping to a shell |
| `03-create-release.png` | Turn a tag into a GitHub Release, with title and notes, right from the app |

Use 01 as the first screenshot; the Store uses it as the hero image.

The screenshots are rendered on Linux (Xephyr) at the app's default dark theme, which looks the
same on Windows since the UI is themed by the app, not the OS. Retake on Windows if a reviewer
wants a native-chrome comparison, though uGit's window currently has no native title bar on either
platform.

To regenerate them after UI changes: temporarily widen the window in
`src-tauri/tauri.conf.json` (`app.windows[0].width`/`height`, e.g. 1600×1000), run the app
against a throwaway repo with a few branches/tags/commits, and screenshot the states listed
above — then revert the width/height change before shipping (see README → Packaging).

## Store logos

Partner Center → Store listing → Store logos wants these uploaded separately from the package
(it doesn't read them out of the `.msix`): [`StoreLogo-300x300.png`](StoreLogo-300x300.png)
(required), plus the 150 and 71 sizes — all three are in this folder, generated from
`src-tauri/icons/icon.png`. The tile and taskbar icons the OS itself uses are inside the package
already (`src-tauri/icons/`), separate from these.

## Additional system requirements

| | Minimum |
|---|---|
| Memory | 4 GB |
| Disk | 100 MB |

## Product declarations

| Declaration | Answer |
|---|---|
| This app allows users to make purchases, but does not use the Microsoft Store commerce system | No |
| This app has been tested to meet accessibility guidelines | No; it hasn't been formally tested |
| Customers can install this app to alternate drives or removable storage | Yes |
| This app depends on non-Microsoft drivers or NT services | No |
| Windows can include this app's data in automatic backups to OneDrive | Yes |
| This app collects, stores or transmits personal information | No; see the privacy policy |

## Age rating (IARC questionnaire)

Choose the "Utility, productivity, communication or other" category, then answer:

- Violence, fear, sexuality, nudity, gambling, drugs, alcohol, tobacco, crude humour, bad
  language: **No**. The app contains no content of its own.
- Users can interact or exchange content with each other: **No**. Nothing is shared or uploaded
  by the app itself (git push/pull goes directly to remotes you configure).
- Shares the user's location: **No**.
- Digital purchases: **No**.
- Unrestricted internet access (a web browser or search): **No**.

The expected result is 3+ / Everyone.

## Capabilities and their justification

The package declares only one capability ([`AppxManifest.xml`](../msix/AppxManifest.xml)):

| Capability | Type | Why |
|---|---|---|
| `runFullTrust` | Restricted | uGit is a Tauri (Rust + WebView2) desktop Win32 app packaged as MSIX, not a UWP app. Every packaged desktop app needs this capability to run. |

Paste this into **Submission options → Restricted capabilities** for `runFullTrust`:

> uGit is a desktop (Win32) application built with Tauri, packaged with MSIX. runFullTrust is
> required for any packaged desktop app to run at all — the app uses it to read and write git
> repositories on disk, make outbound network connections to git remotes and the GitHub API that
> the user configures or signs in to, and store a GitHub OAuth token in the Windows Credential
> Manager.

## Privacy policy summary (for Partner Center's own form, if asked to paraphrase)

uGit does not collect, sell or share personal data. It has no accounts, analytics, telemetry,
advertising or crash reporting of its own. Its only network use is: (1) ordinary git operations
against remotes the user configures, and (2) the GitHub API, only after the user explicitly signs
in via GitHub's Device Flow, with the token stored in the Windows Credential Manager. Full policy:
[`../../PRIVACY.md`](../../PRIVACY.md).
