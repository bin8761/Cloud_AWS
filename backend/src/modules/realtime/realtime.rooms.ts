/**
 * Realtime room helpers internals.
 * Not exported through `realtime/index.ts`.
 */
export const tenantRoom = (tenantId: string): string => `tenant:${tenantId}`;

export const computerRoom = (computerId: string): string => `computer:${computerId}`;

