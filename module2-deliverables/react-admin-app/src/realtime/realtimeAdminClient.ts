import { io, Socket } from "socket.io-client";
import type { ComputerControlPayload } from "./controlPayload";

type Ack =
  | { success: true; data: { accepted: true } }
  | { success: false; error: { code: string; message: string } };

export class RealtimeAdminClient {
  private readonly socket: Socket;

  constructor(serverUrl: string, accessToken: string) {
    this.socket = io(serverUrl, {
      transports: ["websocket"],
      auth: {
        clientType: "admin",
        accessToken,
      },
    });
  }

  public emitComputerControl(payload: ComputerControlPayload): Promise<Ack> {
    return new Promise((resolve) => {
      this.socket.emit("admin:computer-control", payload, (ack: Ack) => {
        resolve(ack);
      });
    });
  }
}
