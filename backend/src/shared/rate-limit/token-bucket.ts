export type TokenBucketConfig = {
  capacity: number;
  refillTokens: number;
  refillWindowSeconds: number;
};

type BucketState = {
  tokens: number;
  lastRefillAtMs: number;
};

const bucketStates = new Map<string, BucketState>();

export const getBucketState = (key: string): BucketState | undefined => {
  return bucketStates.get(key);
};

export const setBucketState = (key: string, state: BucketState): void => {
  bucketStates.set(key, state);
};

export const refillBucketTokens = (
  key: string,
  config: TokenBucketConfig,
  nowMs: number,
): BucketState | undefined => {
  const state = bucketStates.get(key);

  if (!state) {
    return undefined;
  }

  const refillWindowMs = config.refillWindowSeconds * 1000;
  const elapsedMs = nowMs - state.lastRefillAtMs;
  const elapsedWindows = Math.floor(elapsedMs / refillWindowMs);

  if (elapsedWindows <= 0) {
    return state;
  }

  const nextState: BucketState = {
    tokens: Math.min(state.tokens + elapsedWindows * config.refillTokens, config.capacity),
    lastRefillAtMs: state.lastRefillAtMs + elapsedWindows * refillWindowMs,
  };

  bucketStates.set(key, nextState);
  return nextState;
};

export const consumeToken = (key: string): boolean => {
  const state = bucketStates.get(key);

  if (!state || state.tokens <= 0) {
    return false;
  }

  bucketStates.set(key, {
    ...state,
    tokens: state.tokens - 1,
  });

  return true;
};
