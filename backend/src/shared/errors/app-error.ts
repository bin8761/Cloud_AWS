import type { ErrorCode } from "./error-code";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public override readonly message: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.message = message;
    this.details = details;
  }
}
