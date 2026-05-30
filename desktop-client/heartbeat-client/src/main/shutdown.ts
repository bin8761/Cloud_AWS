let heartbeatCleanupHandler: (() => Promise<void> | void) | null = null;

export const registerHeartbeatCleanupHandler = (
  handler: (() => Promise<void> | void) | null
): void => {
  heartbeatCleanupHandler = handler;
};

export const runHeartbeatCleanup = async (): Promise<void> => {
  if (!heartbeatCleanupHandler) {
    return;
  }

  await heartbeatCleanupHandler();
};
