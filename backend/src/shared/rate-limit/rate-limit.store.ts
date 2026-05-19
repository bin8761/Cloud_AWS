export type RateLimitBucketState = {
  tokens: number;
  lastRefillAtMs: number;
};

export interface RateLimitStore {
  get(key: string): RateLimitBucketState | undefined;
  set(key: string, state: RateLimitBucketState): void;
  delete(key: string): void;
}
