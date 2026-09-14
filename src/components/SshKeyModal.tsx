import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api } from "../api";
import type { SshStatus, SshTestResult } from "../types";

const GITHUB_ADD_KEY_URL = "https://github.com/settings/ssh/new";

interface Props {
  onClose: () => void;
}

export default function SshKeyModal({ onClose }: Props) {
  const [status, setStatus] = useState<SshStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ path: string; publicKey: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<SshTestResult | null>(null);

  function refresh() {
    api
      .sshStatus()
      .then(setStatus)
      .catch((e) => setError(String(e)));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const key = await api.sshGenerateKey();
      setGenerated({ path: key.private_key_path, publicKey: key.public_key });
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleBrowse() {
    // ~/.ssh is a dot-folder, which native file pickers hide by default —
    // open straight into it so "Use existing key…" doesn't first require
    // the user to reveal hidden folders themselves (e.g. Ctrl+H on GTK).
    const picked = await openDialog({
      directory: false,
      multiple: false,
      title: "Select your SSH private key",
      defaultPath: status?.ssh_dir,
    });
    if (typeof picked !== "string") return;
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      await api.sshSetCustomKey(picked);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      await api.sshClearCustomKey();
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      setTestResult(await api.sshTestConnection());
    } catch (e) {
      setError(String(e));
    } finally {
      setTesting(false);
    }
  }

  async function copyPublicKey() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the key is still visible and selectable
      // in the box below, so the user can still copy it manually.
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal ssh-modal" onClick={(e) => e.stopPropagation()}>
        <h3>SSH keys</h3>

        {error && <p className="error-banner">{error}</p>}
        {testResult && (
          <p className={testResult.success ? "info-banner" : "error-banner"}>
            {testResult.success ? "✓ " : "✗ "}
            {testResult.message}
          </p>
        )}

        {!generated && (
          <>
            <p className="empty-hint">
              uGit tries your SSH agent first, then these files, in order:
            </p>
            <div className="ssh-key-list">
              {status?.default_keys.map((k) => (
                <div className="ssh-key-row" key={k.name}>
                  <span>{k.name}</span>
                  <span className={"ssh-key-badge" + (k.exists ? " found" : "")}>
                    {k.exists ? "Found" : "Not found"}
                  </span>
                </div>
              ))}
              {status?.custom_key_path && (
                <div className="ssh-key-row">
                  <span title={status.custom_key_path}>
                    Custom: {status.custom_key_path.split(/[/\\]/).pop()}
                  </span>
                  <span className={"ssh-key-badge" + (status.custom_key_exists ? " found" : "")}>
                    {status.custom_key_exists ? "Active" : "Missing"}
                  </span>
                </div>
              )}
            </div>

            <p className="empty-hint">
              "Test connection" checks SSH only, via a separate process from your signed-in
              GitHub account — a working OAuth sign-in can't hide a real SSH problem here.
            </p>

            <div className="modal-actions">
              {status?.custom_key_path && (
                <button className="toolbar-btn subtle" disabled={busy} onClick={handleClear}>
                  Clear custom key
                </button>
              )}
              <button className="toolbar-btn" disabled={busy || testing} onClick={handleTest}>
                {testing ? "Testing…" : "Test connection"}
              </button>
              <button className="toolbar-btn" disabled={busy} onClick={handleBrowse}>
                Use existing key…
              </button>
              <button className="primary-btn" disabled={busy} onClick={handleGenerate}>
                Generate new key
              </button>
            </div>
          </>
        )}

        {generated && (
          <>
            <p>
              Generated a new key at <code>{generated.path}</code>. Copy the public key below and
              add it to GitHub:
            </p>
            <textarea
              className="ssh-pubkey-box"
              readOnly
              value={generated.publicKey}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
            <div className="modal-actions">
              <button className="toolbar-btn subtle" onClick={copyPublicKey}>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                className="toolbar-btn"
                onClick={() => openUrl(GITHUB_ADD_KEY_URL).catch(() => {})}
              >
                Open GitHub SSH settings…
              </button>
              <button className="toolbar-btn" disabled={testing} onClick={handleTest}>
                {testing ? "Testing…" : "Test connection"}
              </button>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="toolbar-btn subtle" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
