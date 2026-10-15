/**
 * A tag starting with an uppercase "V" followed by a digit is almost always a mis-typed
 * version tag, not a deliberate name — and it's a real trap: GitHub Actions' tag-push
 * triggers (e.g. `tags: ['v*']`) are case-sensitive, so a stray capital silently skips CI
 * instead of erroring.
 */
export function looksLikeMiscasedVersionTag(name: string): boolean {
  return /^V\d/.test(name);
}
