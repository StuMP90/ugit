const LAST_DIR_KEY = "ugit:lastDir";

function parentDir(path: string): string {
  const normalized = path.replace(/[/\\]+$/, "");
  const idx = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  return idx > 0 ? normalized.slice(0, idx) : normalized;
}

export function getLastDir(): string | undefined {
  try {
    return localStorage.getItem(LAST_DIR_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function rememberDir(path: string) {
  try {
    localStorage.setItem(LAST_DIR_KEY, parentDir(path));
  } catch {
    // ignore — falls back to the platform default next time
  }
}
