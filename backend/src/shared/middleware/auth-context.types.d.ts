import type { AuthContext } from "./auth-context";

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

export {};
