import type {
    RealtimeAckError,
    RealtimeAckErrorCode,
    RealtimeAckResponse,
    RealtimeAckSuccess,
} from "./realtime.types";

type RealtimeAckSafeErrorDetails = {
    code: RealtimeAckErrorCode;
    message: string;
};

type ForbiddenRealtimeAckErrorFields = {
    accessToken?: never;
    deviceToken?: never;
    deviceTokenHash?: never;
    authorization?: never;
    headers?: never;
    handshake?: never;
    rawAuth?: never;
    payload?: never;
    stack?: never;
    prisma?: never;
    socket?: never;
};

const DEFAULT_ACK_ERROR_MESSAGE =
    "Realtime request could not be processed.";

const DEFAULT_ACK_ERROR_CODE: RealtimeAckErrorCode = "INTERNAL_ERROR";

/**
 * Shared success ack mapper: `{ success: true, data }`.
 */
export const buildRealtimeAckSuccess = <TData>(
    data: TData
): RealtimeAckSuccess<TData> => ({
    success: true,
    data,
});

/**
 * Shared error ack mapper: `{ success: false, error: { code, message } }`.
 * Only safe, caller-provided code/message are emitted.
 */
export const buildRealtimeAckError = (
    details: RealtimeAckSafeErrorDetails & ForbiddenRealtimeAckErrorFields
): RealtimeAckError => ({
    success: false,
    error: {
        code: details.code,
        message: details.message,
    },
});

/**
 * Converts unknown internal errors to a sanitized ack error response.
 * Never exposes stack traces, Prisma internals, socket internals, or token material.
 */
export const buildRealtimeAckInternalError = (
    _error: unknown,
    message: string = DEFAULT_ACK_ERROR_MESSAGE
): RealtimeAckError =>
    buildRealtimeAckError({
        code: DEFAULT_ACK_ERROR_CODE,
        message,
    });

export const toRealtimeAckResponse = <TData>(
    data: TData | RealtimeAckError,
    options?: {
        /**
         * When true, `data` is already an error payload and returned as-is.
         */
        isError?: boolean;
    }
): RealtimeAckResponse<TData> =>
    options?.isError
        ? (data as RealtimeAckError)
        : buildRealtimeAckSuccess(data as TData);
