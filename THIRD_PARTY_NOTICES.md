# Third-Party Notices

uGit's own source is licensed as described in [LICENSE](LICENSE). This file covers third-party
binary components distributed alongside the built app that are **not** covered by that license.

## Microsoft Edge WebView2 (`WebView2Loader.dll`)

The Windows build of uGit ships a small loader stub, `WebView2Loader.dll`, next to `ugit.exe`.
This file is © Microsoft Corporation, distributed as part of the Microsoft Edge WebView2 SDK
(via the `Microsoft.Web.WebView2` NuGet package), and is governed by Microsoft's own license
terms for that SDK — not by uGit's AGPLv3/Commons Clause license.

`WebView2Loader.dll` is a bootstrap stub only (roughly 160 KB); it does not contain the WebView2
Runtime (the actual browser engine) itself. uGit relies on the WebView2 Runtime already present
on the OS (preinstalled on Windows 11 and up-to-date Windows 10), and does not bundle it.

Microsoft's WebView2 SDK license terms explicitly permit redistributing `WebView2Loader.dll` as
part of a third-party application — this is the file's intended purpose, and every WebView2-based
app (regardless of framework) ships it the same way. See Microsoft's official distribution
documentation, "Distribute your app and the WebView2 Runtime"
(learn.microsoft.com/microsoft-edge/webview2/concepts/distribution), and the license terms bundled
with the `Microsoft.Web.WebView2` NuGet package on nuget.org, for the authoritative terms.

uGit obtains this file via the `webview2-com-sys` Rust crate (MIT-licensed for its own binding
code; the vendored `WebView2Loader.dll` binary itself remains Microsoft's, under Microsoft's
terms as described above), a dependency of the Tauri framework uGit is built on.
