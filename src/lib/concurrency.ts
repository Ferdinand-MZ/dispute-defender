/**
 * In-memory concurrency and race condition guard for dispute financial mutations.
 * Prevents simultaneous duplicate API requests (e.g. concurrent submits or refunds)
 * from interleaving and executing multiple external financial actions.
 */

const inFlightDisputeActions = new Set<string>();

/**
 * Attempts to acquire an exclusive lock for an action on a dispute.
 * Returns true if the lock was acquired, false if an operation is already in progress.
 */
export function acquireActionLock(disputeId: string, actionType: string): boolean {
  const lockKey = `${disputeId}:${actionType}`;
  if (inFlightDisputeActions.has(lockKey)) {
    return false;
  }
  inFlightDisputeActions.add(lockKey);
  return true;
}

/**
 * Releases the exclusive lock for an action on a dispute.
 */
export function releaseActionLock(disputeId: string, actionType: string): void {
  const lockKey = `${disputeId}:${actionType}`;
  inFlightDisputeActions.delete(lockKey);
}

/**
 * Clears all active locks (primarily for testing purposes).
 */
export function clearAllActionLocks(): void {
  inFlightDisputeActions.clear();
}
