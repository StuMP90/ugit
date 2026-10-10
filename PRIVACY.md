# Privacy Policy

Last updated: 2026-10-10

This policy applies to uGit, whether installed from the Microsoft Store or from a release on
GitHub.

## In short

uGit collects nothing itself: no accounts, analytics, telemetry, advertising or crash reporting.
It is a git client — the only network connections it makes are the ones git itself would make
(to the remotes you add to a repository) and, when you choose to sign in, to GitHub's API. The
developer receives nothing from the app.

## Git remotes

uGit runs ordinary git operations (clone, fetch, pull, push) against the remote URLs already
configured in your repositories, or ones you add yourself. Those connections go directly from
your computer to the server you specified (GitHub, GitLab, a self-hosted server, and so on) —
uGit does not proxy, log or see this traffic beyond what's needed to carry out the operation
you asked for.

## Signing in to GitHub

Signing in uses GitHub's own "device flow" (the same flow the `gh` CLI uses): uGit shows you a
code, you enter it at github.com, and GitHub returns an access token directly to uGit. No
password is ever seen by uGit.

The access token (and a refresh token used to renew it) is stored only in your operating
system's secure credential store — the Secret Service / keyring on Linux, Credential Manager on
Windows — never in a plain file, and never sent anywhere except to GitHub's API. uGit uses it
only for actions you explicitly take (listing or creating a GitHub release, checking whether one
already exists for a tag) — never from a background refresh. Signing out deletes it from the
credential store immediately.

## SSH keys

For `git@...` remotes, uGit uses whichever SSH key you already have in `~/.ssh` (or `.ssh` under
your Windows user profile), the same way the `git` and `ssh` command-line tools do, or a key path
you point it at. If you ask uGit to generate a new key, it's written straight to your `.ssh`
folder as an ordinary SSH keypair (`id_ed25519_ugit`) — it is never transmitted anywhere except
as part of normal SSH authentication to the remote you're connecting to.

## Data stored on your computer

uGit keeps a small amount of data in a per-OS app folder (the XDG config directory on Linux,
`%APPDATA%` on Windows):

- **Window position and size**, so the app reopens where you left it.
- **A custom SSH key path**, if you've pointed uGit at one instead of the auto-detected default.

Besides that, uGit only reads and writes the git repositories you open — it doesn't maintain a
separate database, cache or history of its own about your code.

## Children

uGit is a general-purpose developer tool. It is not aimed at children and collects no data from
anyone.

## Third parties

When you install uGit from the Microsoft Store, Microsoft handles the download, licensing and
updates under its own privacy statement: <https://privacy.microsoft.com/privacystatement>. When
you sign in to GitHub, GitHub's own privacy statement applies to that connection:
<https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement>.

## Changes

If this policy changes, the new version will be published at this address with a new date. The
full history of this file is kept in the repository.

## Contact

Questions about privacy can be raised as an issue at <https://github.com/StuMP90/ugit/issues>.
