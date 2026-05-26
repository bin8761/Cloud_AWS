/**
 * Realtime module public API (minimal surface).
 * Socket.IO internals remain private inside the module files.
 */
export { createRealtimeServer } from "./realtime.server";
export type {
    RealtimeGatewayPublicApi,
    RealtimeHealthSnapshot,
    RealtimeServerPublicApi,
} from "./realtime.types";
