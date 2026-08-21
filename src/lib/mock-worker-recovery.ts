const MOCK_WORKER_RECOVERY_KEY = 'open-platform:mock-worker-recovery';

export function clearMockWorkerRecovery(): void {
  try {
    sessionStorage.removeItem(MOCK_WORKER_RECOVERY_KEY);
  } catch {
    // sessionStorage may be unavailable; the next request can still use the normal error path.
  }
}

/**
 * Reload once after a stale MSW worker is detected. The session flag prevents
 * an unavailable worker from causing an infinite reload loop.
 */
export function reloadForMockWorkerRecovery(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    if (sessionStorage.getItem(MOCK_WORKER_RECOVERY_KEY) === '1') return false;
    sessionStorage.setItem(MOCK_WORKER_RECOVERY_KEY, '1');
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}
