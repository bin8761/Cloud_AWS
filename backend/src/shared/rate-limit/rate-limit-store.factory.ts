import { createInMemoryRateLimitStore } from "./in-memory-rate-limit.store";
import { RateLimitStore } from "./rate-limit.store";

export type RateLimitStoreType = "memory" | "redis";

type CreateRateLimitStoreOptions = {
  type: RateLimitStoreType;
};

export const createRateLimitStore = (
  options: CreateRateLimitStoreOptions,
): RateLimitStore => {
  switch (options.type) {
    case "memory":
      return createInMemoryRateLimitStore();
    case "redis":
      throw new Error("Redis rate-limit store is not implemented yet.");
    default: {
      const unsupportedType: never = options.type;
      throw new Error(`Unsupported rate-limit store type: ${unsupportedType}`);
    }
  }
};
