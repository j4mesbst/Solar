/** Benchmark policy only. Never alter public/private tests, independent
 * verification, or logs expressly declared immutable by a fixture. */
export function protectedCortexChanges(changes, fixture) {
  return changes.filter(change => {
    const path = String(change.path ?? '').replaceAll('\\', '/');
    if (!path || path.startsWith('/') || path.split('/').includes('..')) return true;
    if (/(?:^|\/)(?:__tests__|tests?)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)(?:public-test|test-private)\.mjs$/i.test(path)) return true;
    if (fixture.id === '07-large-context' && path.startsWith('logs/')) return true;
    return false;
  }).map(change => change.path);
}
