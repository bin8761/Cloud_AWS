import type { AuthContext } from "./auth-context";

type RequestAuthContext = AuthContext;

declare global {
  namespace Express {
    interface Request {
      authContext?: RequestAuthContext;
    }
  }
}

export {};
